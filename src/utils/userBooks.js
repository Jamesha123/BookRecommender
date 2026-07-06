const normalizeBookIds = (bookIds = []) => {
  return bookIds
    .map((bookId) => {
      if (typeof bookId === 'string') {
        return bookId.trim();
      }

      if (bookId && typeof bookId === 'object') {
        if (typeof bookId.toString === 'function' && bookId.toString() !== '[object Object]') {
          return String(bookId);
        }
      }

      return '';
    })
    .filter(Boolean);
};

const buildFallbackBook = (bookId) => ({
  id: bookId,
  title: 'Saved book',
  authors: [],
  categories: [],
  description: '',
  thumbnail: undefined,
});

module.exports = {
  normalizeBookIds,
  buildFallbackBook,
};
