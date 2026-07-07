const { tokenize } = require('./tfidf');

const buildFeatureText = (book) => {
  const parts = [
    book.title || '',
    ...(book.authors || []),
    ...(book.categories || []),
    book.description || '',
  ];

  return parts
    .join(' ')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ');
};

const toBookPayload = (book) => {
  const featureText = buildFeatureText(book);

  return {
    googleId: book.id,
    title: book.title,
    authors: book.authors || [],
    categories: book.categories || [],
    description: book.description,
    thumbnail: book.thumbnail,
    averageRating: book.averageRating,
    ratingsCount: book.ratingsCount,
    featureText,
    lastFetched: new Date(),
  };
};

const toApiBook = (book) => ({
  id: book.googleId || book.id,
  title: book.title,
  authors: book.authors || [],
  categories: book.categories || [],
  description: book.description,
  thumbnail: book.thumbnail,
  averageRating: book.averageRating,
  ratingsCount: book.ratingsCount,
});

module.exports = {
  buildFeatureText,
  tokenize,
  toBookPayload,
  toApiBook,
};
