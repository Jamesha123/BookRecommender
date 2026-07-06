const normalize = (text = '') => text.toLowerCase().trim();

const getQueryTerms = (query) => {
  return normalize(query)
    .split(/\s+/)
    .filter((term) => term.length > 1);
};

const scoreBook = (book, query) => {
  const terms = getQueryTerms(query);
  const normalizedQuery = normalize(query);
  const title = normalize(book.title);
  const authors = (book.authors || []).map(normalize).join(' ');
  const categories = (book.categories || []).map(normalize).join(' ');

  if (!terms.length) {
    return 0;
  }

  let score = 0;

  if (title === normalizedQuery) {
    score += 100;
  } else if (title.includes(normalizedQuery)) {
    score += 80;
  }

  terms.forEach((term) => {
    if (title.includes(term)) {
      score += 20;
    }
    if (authors.includes(term)) {
      score += 8;
    }
    if (categories.includes(term)) {
      score += 4;
    }
  });

  return score;
};

const rankBooksByQuery = (books, query, minScore = 1) => {
  const seen = new Set();

  return books
    .map((book) => ({ book, score: scoreBook(book, query) }))
    .filter(({ book, score }) => book?.id && score >= minScore && !seen.has(book.id) && seen.add(book.id))
    .sort((a, b) => b.score - a.score)
    .map(({ book }) => book);
};

const uniqueBooks = (books) => {
  const seen = new Set();

  return books.filter((book) => {
    if (!book?.id || seen.has(book.id)) {
      return false;
    }

    seen.add(book.id);
    return true;
  });
};

module.exports = {
  getQueryTerms,
  scoreBook,
  rankBooksByQuery,
  uniqueBooks,
};
