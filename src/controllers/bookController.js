const bookService = require('../services/bookService');

exports.search = async (req, res) => {
  const { q } = req.query;

  if (!q) {
    return res.status(400).json({ message: 'Search query is required' });
  }

  try {
    const books = await bookService.searchBooks(q);
    res.json({ results: books });
  } catch (error) {
    res.status(500).json({ message: 'Error searching for books' });
  }
};

exports.getBookDetails = async (req, res) => {
  const { id } = req.params;

  try {
    const book = await bookService.getBookById(id);
    res.json(book);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching book details' });
  }
};
