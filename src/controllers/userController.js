const User = require('../models/User');
const bookService = require('../services/bookService');

// @desc    Like a book
// @route   POST /api/user/like
// @access  Private
exports.likeBook = async (req, res) => {
  const { bookId } = req.body;
  
  try {
    const user = await User.findById(req.user._id);

    if (user) {
      // Add to likes and remove from dislikes if it exists there
      user.likedBooks.addToSet(bookId);
      user.dislikedBooks.pull(bookId);
      await user.save();
      res.status(200).json({ message: 'Book liked successfully' });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Dislike a book
// @route   POST /api/user/dislike
// @access  Private
exports.dislikeBook = async (req, res) => {
  const { bookId } = req.body;

  try {
    const user = await User.findById(req.user._id);

    if (user) {
      // Add to dislikes and remove from likes if it exists there
      user.dislikedBooks.addToSet(bookId);
      user.likedBooks.pull(bookId);
      await user.save();
      res.status(200).json({ message: 'Book disliked successfully' });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get liked books
// @route   GET /api/user/likes
// @access  Private
exports.getLikedBooks = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (user) {
      const likedBooksDetails = await bookService.getBooksByIds(user.likedBooks);
      res.json(likedBooksDetails);
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get recommendations
// @route   GET /api/user/recommendations
// @access  Private
exports.getRecommendations = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user || user.likedBooks.length === 0) {
      return res.json({ results: [] }); // Return empty if no liked books
    }

    // --- Simple Recommendation Logic ---

    // 1. Fetch details for liked books to find their categories
    const likedBooksDetails = await bookService.getBooksByIds(user.likedBooks);
    const categories = likedBooksDetails.flatMap(book => book.categories);

    if (categories.length === 0) {
      return res.json({ results: [] }); // No categories to base recommendations on
    }

    // 2. Find the most common category
    const categoryCounts = categories.reduce((acc, category) => {
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {});

    const topCategory = Object.keys(categoryCounts).reduce((a, b) => categoryCounts[a] > categoryCounts[b] ? a : b);

    // 3. Search for more books in that category
    let recommendations = await bookService.searchBooks(topCategory);

    // 4. Filter out books the user has already liked or disliked
    const userBooks = new Set([...user.likedBooks, ...user.dislikedBooks]);
    recommendations = recommendations.filter(book => !userBooks.has(book.id));

    res.json({ results: recommendations.slice(0, 10) }); // Return top 10 recommendations

  } catch (error) {
    console.error('Recommendation error:', error);
    res.status(500).json({ message: 'Could not generate recommendations' });
  }
};
