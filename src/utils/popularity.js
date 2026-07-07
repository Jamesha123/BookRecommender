const { normalizeScores } = require('./similarity');

const POPULARITY_RATING_CAP = 5000;

const getPopularitySignal = (book) => {
  const rating = Number(book.averageRating);
  const count = Number(book.ratingsCount);

  if (!Number.isFinite(rating) || rating <= 0 || !Number.isFinite(count) || count <= 0) {
    return 0;
  }

  const ratingFactor = rating / 5;
  const volumeFactor = Math.min(Math.log1p(count) / Math.log1p(POPULARITY_RATING_CAP), 1);

  return ratingFactor * volumeFactor;
};

const applyPopularityBias = (books, weight = 0.08) => {
  if (!books.length || weight <= 0) {
    return books;
  }

  const signals = Object.fromEntries(
    books.map((book) => [book.id, getPopularitySignal(book)])
  );
  const normalized = normalizeScores(signals);
  const hasPopularitySignal = Object.values(signals).some((value) => value > 0);

  if (!hasPopularitySignal) {
    return books;
  }

  return books.map((book) => {
    const popularityScore = normalized[book.id] || 0;
    const boostedScore = Math.min(1, book.score + (weight * popularityScore));

    return {
      ...book,
      popularityScore: Number(popularityScore.toFixed(4)),
      score: Number(boostedScore.toFixed(4)),
    };
  });
};

module.exports = {
  POPULARITY_RATING_CAP,
  getPopularitySignal,
  applyPopularityBias,
};
