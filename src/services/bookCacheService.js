const Book = require('../models/Book');
const { toBookPayload, toApiBook } = require('../utils/bookFeatures');

const cacheBook = async (book) => {
  if (!book || !book.id) {
    return null;
  }

  const payload = toBookPayload(book);

  return Book.findOneAndUpdate(
    { googleId: payload.googleId },
    payload,
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

const cacheBooks = async (books) => {
  const results = await Promise.all(
    books.map((book) => cacheBook(book).catch(() => null))
  );

  return results.filter(Boolean);
};

const getCachedBooksByIds = async (bookIds) => {
  if (!bookIds || bookIds.length === 0) {
    return [];
  }

  const cached = await Book.find({ googleId: { $in: bookIds } });
  return cached.map(toApiBook);
};

const getAllCachedBooks = async (excludeIds = []) => {
  const query = excludeIds.length > 0
    ? { googleId: { $nin: excludeIds } }
    : {};

  const books = await Book.find(query).limit(500);
  return books.map(toApiBook);
};

const searchCachedBooks = async (query, limit = 20) => {
  const terms = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term.length > 1)
    .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

  if (terms.length === 0) {
    return [];
  }

  const titlePatterns = terms.map((term) => new RegExp(term, 'i'));

  const books = await Book.find({
    $or: [
      { $and: titlePatterns.map((pattern) => ({ title: pattern })) },
      ...titlePatterns.map((pattern) => ({ authors: pattern })),
    ],
  }).limit(limit);

  return books.map(toApiBook);
};

module.exports = {
  cacheBook,
  cacheBooks,
  getCachedBooksByIds,
  getAllCachedBooks,
  searchCachedBooks,
};
