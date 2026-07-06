const User = require('../models/User');
const bookService = require('./bookService');
const bookCacheService = require('./bookCacheService');
const { getContentScores } = require('../utils/contentModel');
const {
  filterRecommendationCandidates,
  shouldExcludeFromRecommendations,
} = require('../utils/bookDeduplication');
const { jaccardSimilarity, normalizeScores } = require('../utils/similarity');

const CONTENT_WEIGHT = 0.6;
const COLLABORATIVE_WEIGHT = 0.4;
const MAX_CANDIDATES = 200;
const SEARCH_RESULT_LIMIT = 10;
const DEFAULT_LIMIT = 8;
const LOAD_MORE_LIMIT = 8;
const MIN_CANDIDATE_POOL = 40;
const SEARCH_BATCH_SIZE = 2;
const SEARCH_BATCH_DELAY_MS = 400;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getCollaborativeScores = async (user, candidateIds) => {
  const candidateSet = new Set(candidateIds);
  const scores = Object.fromEntries(candidateIds.map((id) => [id, 0]));

  if (candidateIds.length === 0) {
    return scores;
  }

  const users = await User.find({ _id: { $ne: user._id } }).select('likedBooks dislikedBooks');
  const userLikes = new Set(user.likedBooks);
  const userDislikes = new Set(user.dislikedBooks);
  const userNextRead = new Set(user.nextReadBooks || []);
  const seenBooks = new Set([...userLikes, ...userDislikes, ...userNextRead]);

  users.forEach((otherUser) => {
    const otherLikes = new Set(otherUser.likedBooks);
    const userSimilarity = jaccardSimilarity(userLikes, otherLikes);

    if (userSimilarity === 0) {
      return;
    }

    otherUser.likedBooks.forEach((bookId) => {
      if (!seenBooks.has(bookId) && candidateSet.has(bookId)) {
        scores[bookId] += userSimilarity;
      }
    });
  });

  user.likedBooks.forEach((likedId) => {
    users.forEach((otherUser) => {
      if (!otherUser.likedBooks.includes(likedId)) {
        return;
      }

      otherUser.likedBooks.forEach((bookId) => {
        if (bookId !== likedId && !seenBooks.has(bookId) && candidateSet.has(bookId)) {
          scores[bookId] += 1;
        }
      });
    });
  });

  return scores;
};

const uniqueById = (books) => {
  const seen = new Set();

  return books.filter((book) => {
    if (!book?.id || seen.has(book.id)) {
      return false;
    }

    seen.add(book.id);
    return true;
  });
};

const toDiscoveryQuery = (category) => {
  const cleaned = category.replace(/\(.*?\)/g, '').trim();
  return cleaned ? `subject:${cleaned}` : '';
};

const buildDiscoveryQueries = (likedBooks) => {
  const queries = new Set();

  likedBooks.forEach((book) => {
    (book.categories || []).slice(0, 3).forEach((category) => {
      const query = toDiscoveryQuery(category);
      if (query) {
        queries.add(query);
      }
    });
  });

  [
    'science fiction',
    'fantasy',
    'mystery',
    'thriller',
    'historical fiction',
  ].forEach((category) => queries.add(`subject:${category}`));

  return [...queries].slice(0, 8);
};

const searchForRecommendations = (query) => (
  bookService.searchBooks(query, { limit: SEARCH_RESULT_LIMIT, softFail: true })
);

const runSearchesInBatches = async (queries) => {
  const results = [];

  for (let index = 0; index < queries.length; index += SEARCH_BATCH_SIZE) {
    const batch = queries.slice(index, index + SEARCH_BATCH_SIZE);
    const batchResults = await Promise.all(batch.map(searchForRecommendations));
    results.push(...batchResults);

    if (index + SEARCH_BATCH_SIZE < queries.length) {
      await sleep(SEARCH_BATCH_DELAY_MS);
    }
  }

  return results;
};

const appendFilteredCandidates = (candidates, books, excludedBooks, excludeSet) => {
  const filtered = books
    .filter((book) => !excludeSet.has(book.id))
    .filter((book) => !shouldExcludeFromRecommendations(book, excludedBooks));

  return uniqueById([...candidates, ...filtered]);
};

const buildCandidatePool = async (likedBooks, excludedBooks, excludeIds) => {
  const excludeSet = new Set(excludeIds);
  const queries = buildDiscoveryQueries(likedBooks);
  const searchResults = await runSearchesInBatches(queries);

  let candidates = appendFilteredCandidates(
    [],
    searchResults.flat(),
    excludedBooks,
    excludeSet
  );

  if (candidates.length < MIN_CANDIDATE_POOL) {
    const categoryQueries = [...new Set(
      likedBooks.flatMap((book) => (book.categories || []).slice(0, 2))
    )].slice(0, 4);

    for (const category of categoryQueries) {
      const cachedMatches = await bookCacheService.searchCachedBooks(category, 25);
      candidates = appendFilteredCandidates(
        candidates,
        cachedMatches,
        excludedBooks,
        excludeSet
      );
    }
  }

  if (candidates.length < MIN_CANDIDATE_POOL) {
    const cachedBooks = await bookCacheService.getAllCachedBooks([...excludeSet]);
    candidates = appendFilteredCandidates(
      candidates,
      cachedBooks,
      excludedBooks,
      excludeSet
    );
  }

  await bookCacheService.cacheBooks(candidates);

  return candidates.slice(0, MAX_CANDIDATES);
};

const explainRecommendation = (contentScore, collaborativeScore) => {
  if (contentScore >= collaborativeScore) {
    return 'Similar writing style, themes, and genres to books you liked';
  }

  return 'Popular with readers who share your taste';
};

const rankCandidates = async (user, likedBooks, excludedBooks, candidates) => {
  const dedupedCandidates = filterRecommendationCandidates(candidates, excludedBooks);

  if (dedupedCandidates.length === 0) {
    return [];
  }

  const contentScores = getContentScores(likedBooks, dedupedCandidates);
  const collaborativeScores = await getCollaborativeScores(
    user,
    dedupedCandidates.map((book) => book.id)
  );

  const normalizedContent = normalizeScores(contentScores);
  const normalizedCollaborative = normalizeScores(collaborativeScores);

  return dedupedCandidates
    .map((book) => {
      const contentScore = normalizedContent[book.id] || 0;
      const collaborativeScore = normalizedCollaborative[book.id] || 0;
      const score = (contentScore * CONTENT_WEIGHT) + (collaborativeScore * COLLABORATIVE_WEIGHT);

      return {
        ...book,
        score: Number(score.toFixed(4)),
        contentScore: Number(contentScore.toFixed(4)),
        collaborativeScore: Number(collaborativeScore.toFixed(4)),
        reason: explainRecommendation(contentScore, collaborativeScore),
      };
    })
    .filter((book) => !shouldExcludeFromRecommendations(book, excludedBooks))
    .sort((a, b) => b.score - a.score);
};

const buildExcludedBooks = (likedBooks, nextReadBooks) => {
  const booksById = new Map();

  [...likedBooks, ...nextReadBooks].forEach((book) => {
    if (book?.id) {
      booksById.set(book.id, book);
    }
  });

  return [...booksById.values()];
};

const generateRecommendations = async (user, options = {}) => {
  const limit = Math.min(Math.max(options.limit || DEFAULT_LIMIT, 1), 20);
  const excludeIds = Array.isArray(options.excludeIds) ? options.excludeIds : [];

  if (!user || user.likedBooks.length === 0) {
    return { results: [], hasMore: false };
  }

  const excludeSet = new Set([
    ...user.likedBooks,
    ...user.dislikedBooks,
    ...(user.nextReadBooks || []),
    ...excludeIds,
  ]);
  const likedBooks = await bookService.getBooksByIds(user.likedBooks);
  const nextReadBooks = await bookService.getBooksByIds(user.nextReadBooks || []);
  const excludedBooks = buildExcludedBooks(likedBooks, nextReadBooks);

  if (likedBooks.length === 0) {
    return { results: [], hasMore: false };
  }

  await bookCacheService.cacheBooks([...likedBooks, ...nextReadBooks]);

  const candidates = await buildCandidatePool(likedBooks, excludedBooks, [...excludeSet]);
  const ranked = await rankCandidates(user, likedBooks, excludedBooks, candidates);
  const available = ranked
    .filter((book) => !excludeSet.has(book.id))
    .filter((book) => !shouldExcludeFromRecommendations(book, excludedBooks));
  const results = available.slice(0, limit);

  return {
    results,
    hasMore: available.length > limit,
  };
};

module.exports = {
  generateRecommendations,
  getCollaborativeScores,
  CONTENT_WEIGHT,
  COLLABORATIVE_WEIGHT,
  DEFAULT_LIMIT,
  LOAD_MORE_LIMIT,
};
