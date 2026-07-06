const axios = require('axios');
const bookCacheService = require('./bookCacheService');
const { rankBooksByQuery, uniqueBooks } = require('../utils/searchRelevance');

const CACHE_TTL_MS = 10 * 60 * 1000;
const searchCache = new Map();

const mapGoogleBook = (book) => ({
  id: book.id,
  title: book.volumeInfo.title,
  authors: book.volumeInfo.authors || [],
  categories: book.volumeInfo.categories || [],
  description: book.volumeInfo.description,
  thumbnail: book.volumeInfo.imageLinks?.thumbnail,
});

const getCachedSearch = (query) => {
  const entry = searchCache.get(query.toLowerCase().trim());

  if (!entry) {
    return null;
  }

  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    searchCache.delete(query.toLowerCase().trim());
    return null;
  }

  return entry.results;
};

const setCachedSearch = (query, results) => {
  searchCache.set(query.toLowerCase().trim(), {
    results,
    timestamp: Date.now(),
  });
};

const fetchFromGoogle = async (query) => {
  const params = new URLSearchParams({
    q: query,
    maxResults: '20',
    printType: 'books',
  });

  if (process.env.GOOGLE_BOOKS_API_KEY) {
    params.set('key', process.env.GOOGLE_BOOKS_API_KEY);
  }

  const url = `https://www.googleapis.com/books/v1/volumes?${params.toString()}`;
  const response = await axios.get(url, { timeout: 10000 });

  if (!response.data.items) {
    return [];
  }

  return response.data.items.map(mapGoogleBook);
};

const fetchFromOpenLibrary = async (query) => {
  const attempts = [
    { q: `title:"${query}"`, label: 'title' },
    { q: query, label: 'general' },
  ];

  for (const attempt of attempts) {
    const books = await fetchOpenLibraryQuery(attempt.q);
    const ranked = rankBooksByQuery(books, query, 10);

    if (ranked.length > 0) {
      return ranked;
    }
  }

  return [];
};

const fetchOpenLibraryQuery = async (query) => {
  const params = new URLSearchParams({
    q: query,
    limit: '20',
    fields: 'key,title,author_name,subject,cover_i,first_sentence',
  });

  const url = `https://openlibrary.org/search.json?${params.toString()}`;
  const response = await axios.get(url, { timeout: 10000 });

  if (!response.data.docs) {
    return [];
  }

  return response.data.docs.map((book, index) => ({
    id: book.key
      ? `ol-${book.key.replace(/^\/works\//, '').replace(/\//g, '-')}`
      : `ol-cover-${book.cover_i || index}`,
    title: book.title,
    authors: book.author_name || [],
    categories: (book.subject || []).slice(0, 3),
    description: book.first_sentence?.[0] || '',
    thumbnail: book.cover_i
      ? `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg`
      : undefined,
  }));
};

const searchBooks = async (query, options = {}) => {
  const normalizedQuery = query.trim();
  const resultLimit = Math.min(Math.max(options.limit || 5, 1), 40);

  if (!normalizedQuery) {
    return [];
  }

  const cacheKey = `${normalizedQuery}::${resultLimit}`;
  const cachedResults = getCachedSearch(cacheKey);
  if (cachedResults) {
    return cachedResults;
  }

  try {
    const books = rankBooksByQuery(await fetchFromGoogle(normalizedQuery), normalizedQuery, resultLimit);
    setCachedSearch(cacheKey, books);
    await bookCacheService.cacheBooks(books);
    return books;
  } catch (error) {
    const status = error.response?.status;
    console.error('Error searching books:', error.message);

    try {
      const openLibraryBooks = await fetchFromOpenLibrary(normalizedQuery);
      if (openLibraryBooks.length > 0) {
        const ranked = rankBooksByQuery(openLibraryBooks, normalizedQuery, resultLimit);
        setCachedSearch(cacheKey, ranked);
        await bookCacheService.cacheBooks(ranked);
        return ranked;
      }
    } catch (fallbackError) {
      console.error('Open Library fallback failed:', fallbackError.message);
    }

    const cachedBooks = rankBooksByQuery(
      await bookCacheService.searchCachedBooks(normalizedQuery, resultLimit),
      normalizedQuery,
      resultLimit
    );

    if (cachedBooks.length > 0) {
      setCachedSearch(cacheKey, cachedBooks);
      return cachedBooks;
    }

    if (options.softFail) {
      return [];
    }

    if (status === 429) {
      throw new Error('Book search is temporarily rate-limited. Please wait a minute and try again.');
    }

    throw new Error('Failed to search for books');
  }
};

const getBookById = async (bookId) => {
  const cachedBook = (await bookCacheService.getCachedBooksByIds([bookId]))[0];
  if (cachedBook) {
    return cachedBook;
  }

  if (bookId.startsWith('ol-')) {
    throw new Error(`Failed to fetch book details for ${bookId}`);
  }

  try {
    const params = new URLSearchParams();
    if (process.env.GOOGLE_BOOKS_API_KEY) {
      params.set('key', process.env.GOOGLE_BOOKS_API_KEY);
    }

    const query = params.toString() ? `?${params.toString()}` : '';
    const url = `https://www.googleapis.com/books/v1/volumes/${bookId}${query}`;
    const response = await axios.get(url, { timeout: 10000 });

    const book = mapGoogleBook(response.data);
    await bookCacheService.cacheBook(book);
    return book;
  } catch (error) {
    const cachedBook = (await bookCacheService.getCachedBooksByIds([bookId]))[0];
    if (cachedBook) {
      return cachedBook;
    }

    console.error(`Error fetching book with ID ${bookId}:`, error.message);
    throw new Error('Failed to fetch book details');
  }
};

const getBooksByIds = async (bookIds) => {
  if (!bookIds || bookIds.length === 0) {
    return [];
  }

  const results = await Promise.allSettled(bookIds.map((id) => getBookById(id)));

  return results
    .filter((result) => result.status === 'fulfilled')
    .map((result) => result.value);
};

module.exports = {
  searchBooks,
  getBookById,
  getBooksByIds,
};
