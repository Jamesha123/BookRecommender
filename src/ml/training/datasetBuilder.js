const User = require('../../models/User');
const Book = require('../../models/Book');
const bookService = require('../../services/bookService');
const { buildFeatureText } = require('../../utils/bookFeatures');

const unique = (values) => [...new Set(values.filter(Boolean))];

const buildTrainingDataset = async () => {
  const users = await User.find({}).select('likedBooks dislikedBooks');
  const books = await Book.find({}).lean();

  const bookMap = new Map(
    books.map((book) => [book.googleId, {
      id: book.googleId,
      title: book.title,
      authors: book.authors || [],
      categories: book.categories || [],
      description: book.description || '',
    }])
  );

  const allBookIds = unique([
    ...books.map((book) => book.googleId),
    ...users.flatMap((user) => [...user.likedBooks, ...user.dislikedBooks]),
  ]);

  const missingIds = allBookIds.filter((bookId) => !bookMap.has(bookId));

  if (missingIds.length > 0) {
    const fetchedBooks = await bookService.getBooksByIds(missingIds);
    fetchedBooks.forEach((book) => {
      bookMap.set(book.id, book);
    });
  }

  const interactions = [];

  users.forEach((user) => {
    user.likedBooks.forEach((bookId) => {
      if (bookMap.has(bookId)) {
        interactions.push({
          userId: String(user._id),
          bookId,
          label: 1,
        });
      }
    });

    user.dislikedBooks.forEach((bookId) => {
      if (bookMap.has(bookId)) {
        interactions.push({
          userId: String(user._id),
          bookId,
          label: 0,
        });
      }
    });
  });

  const documents = [...bookMap.values()].map((book) => buildFeatureText(book));

  return {
    interactions,
    books: [...bookMap.values()],
    documents,
    userCount: users.length,
    bookCount: bookMap.size,
  };
};

module.exports = {
  buildTrainingDataset,
};
