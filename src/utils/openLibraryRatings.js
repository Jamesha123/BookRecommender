const axios = require('axios');

const toOpenLibraryWorkPath = (bookId) => {
  if (!bookId?.startsWith('ol-')) {
    return null;
  }

  const workKey = bookId.replace(/^ol-/, '');
  return workKey ? `/works/${workKey}` : null;
};

const hasRatingData = (book) => (
  Number.isFinite(Number(book?.averageRating))
  && Number(book.averageRating) > 0
  && Number.isFinite(Number(book?.ratingsCount))
  && Number(book.ratingsCount) > 0
);

const fetchOpenLibraryRatings = async (bookId) => {
  const workPath = toOpenLibraryWorkPath(bookId);

  if (!workPath) {
    return null;
  }

  const url = `https://openlibrary.org${workPath}/ratings.json`;
  const response = await axios.get(url, { timeout: 8000 });
  const summary = response.data?.summary;

  if (!summary?.average || !summary?.count) {
    return null;
  }

  return {
    averageRating: Number(summary.average),
    ratingsCount: Number(summary.count),
  };
};

const mapOpenLibraryRatings = (book) => {
  const averageRating = Number(book.ratings_average);
  const ratingsCount = Number(book.ratings_count);

  if (!Number.isFinite(averageRating) || averageRating <= 0) {
    return {};
  }

  return {
    averageRating,
    ratingsCount: Number.isFinite(ratingsCount) && ratingsCount > 0 ? ratingsCount : undefined,
  };
};

module.exports = {
  toOpenLibraryWorkPath,
  hasRatingData,
  fetchOpenLibraryRatings,
  mapOpenLibraryRatings,
};
