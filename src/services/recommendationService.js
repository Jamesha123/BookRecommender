const bookService = require('./bookService');
const bookCacheService = require('./bookCacheService');
const {
  filterRecommendationCandidates,
  shouldExcludeFromRecommendations,
} = require('../utils/bookDeduplication');
const { ensureModel, getModelMetadata } = require('../ml/modelStore');
const { scoreCandidates } = require('../ml/inference/predictor');
const { getContentScores } = require('../utils/contentModel');
const { normalizeScores } = require('../utils/similarity');
const { applyPopularityBias } = require('../utils/popularity');

const MAX_CANDIDATES = 200;
const SEARCH_RESULT_LIMIT = 10;
const DEFAULT_LIMIT = 8;
const LOAD_MORE_LIMIT = 8;
const MIN_CANDIDATE_POOL = 40;
const SEARCH_BATCH_SIZE = 2;
const SEARCH_BATCH_DELAY_MS = 400;
const DEFAULT_CONTENT_WEIGHT = 0.6;
const DEFAULT_COLLABORATIVE_WEIGHT = 0.4;
const POPULARITY_BIAS_WEIGHT = 0.08;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

const buildExcludedBooks = (likedBooks, nextReadBooks) => {
  const booksById = new Map();

  [...likedBooks, ...nextReadBooks].forEach((book) => {
    if (book?.id) {
      booksById.set(book.id, book);
    }
  });

  return [...booksById.values()];
};

const rankCandidates = async (user, likedBooks, excludedBooks, candidates) => {
  const dedupedCandidates = filterRecommendationCandidates(candidates, excludedBooks);

  if (dedupedCandidates.length === 0) {
    return [];
  }

  const model = await ensureModel();

  if (!model) {
    const contentScores = getContentScores(likedBooks, dedupedCandidates);
    const normalizedContent = normalizeScores(contentScores);

    return applyPopularityBias(
      dedupedCandidates
        .map((book) => ({
          ...book,
          score: Number((normalizedContent[book.id] || 0).toFixed(4)),
          contentScore: Number((normalizedContent[book.id] || 0).toFixed(4)),
          collaborativeScore: 0,
          reason: 'Similar writing style, themes, and genres to books you liked',
        }))
        .filter((book) => !shouldExcludeFromRecommendations(book, excludedBooks))
        .sort((a, b) => b.score - a.score),
      POPULARITY_BIAS_WEIGHT
    );
  }

  return applyPopularityBias(
    scoreCandidates(model, user, likedBooks, dedupedCandidates)
      .filter((book) => !shouldExcludeFromRecommendations(book, excludedBooks))
      .sort((a, b) => b.score - a.score),
    POPULARITY_BIAS_WEIGHT
  );
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
  const enrichedRanked = await bookService.enrichBooksWithRatings(ranked);
  const available = enrichedRanked
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
  getModelMetadata,
  CONTENT_WEIGHT: DEFAULT_CONTENT_WEIGHT,
  COLLABORATIVE_WEIGHT: DEFAULT_COLLABORATIVE_WEIGHT,
  POPULARITY_BIAS_WEIGHT,
  DEFAULT_LIMIT,
  LOAD_MORE_LIMIT,
};
