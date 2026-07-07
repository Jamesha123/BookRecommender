const User = require('../models/User');
const bookService = require('../services/bookService');
const bookCacheService = require('../services/bookCacheService');
const recommendationService = require('../services/recommendationService');
const { scheduleRetrain } = require('../ml/modelStore');
const { normalizeBookIds, buildFallbackBook } = require('../utils/userBooks');

const getUserBookIds = (user) => normalizeBookIds(user.likedBooks);
const getUserDislikedIds = (user) => normalizeBookIds(user.dislikedBooks);
const getNextReadIds = (user) => normalizeBookIds(user.nextReadBooks);

const saveUserBookIds = (user, likedBooks, dislikedBooks) => {
  user.likedBooks = normalizeBookIds(likedBooks);
  user.dislikedBooks = normalizeBookIds(dislikedBooks);
};

const resolveBooksFromIds = async (bookIds) => {
  const normalizedIds = normalizeBookIds(bookIds);

  if (normalizedIds.length === 0) {
    return [];
  }

  const cachedBooks = await bookCacheService.getCachedBooksByIds(normalizedIds);
  const cachedIds = new Set(cachedBooks.map((book) => book.id));
  const missingIds = normalizedIds.filter((id) => !cachedIds.has(id));
  const fetchedBooks = missingIds.length > 0
    ? await bookService.getBooksByIds(missingIds)
    : [];

  const booksById = new Map(
    [...cachedBooks, ...fetchedBooks].map((book) => [book.id, book])
  );

  return normalizedIds.map((id) => booksById.get(id) || buildFallbackBook(id));
};

const cacheBookIfProvided = async (bookId, book) => {
  if (book) {
    await bookCacheService.cacheBook(book);
    return;
  }

  const cached = await bookService.getBookById(bookId).catch(() => null);
  if (cached) {
    await bookCacheService.cacheBook(cached);
  }
};

// @desc    Like a book
// @route   POST /api/user/like
// @access  Private
exports.likeBook = async (req, res) => {
  const { bookId, book } = req.body;

  if (!bookId) {
    return res.status(400).json({ message: 'bookId is required' });
  }

  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const likedBookIds = getUserBookIds(user);

    if (!likedBookIds.includes(bookId)) {
      likedBookIds.push(bookId);
    }

    const dislikedBookIds = getUserDislikedIds(user).filter((id) => id !== bookId);
    saveUserBookIds(user, likedBookIds, dislikedBookIds);
    await user.save();

    if (book) {
      await bookCacheService.cacheBook(book);
    } else {
      await cacheBookIfProvided(bookId, null);
    }

    void scheduleRetrain();

    res.status(200).json({ message: 'Book added to likes' });
  } catch (error) {
    console.error('Like book error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Dislike a book
// @route   POST /api/user/dislike
// @access  Private
exports.dislikeBook = async (req, res) => {
  const { bookId, book } = req.body;

  if (!bookId) {
    return res.status(400).json({ message: 'bookId is required' });
  }

  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const likedBookIds = getUserBookIds(user).filter((id) => id !== bookId);
    const dislikedBookIds = getUserDislikedIds(user);

    if (!dislikedBookIds.includes(bookId)) {
      dislikedBookIds.push(bookId);
    }

    saveUserBookIds(user, likedBookIds, dislikedBookIds);
    await user.save();

    if (book) {
      await bookCacheService.cacheBook(book);
    } else {
      await cacheBookIfProvided(bookId, null);
    }

    void scheduleRetrain();

    res.status(200).json({ message: 'Book marked as not interested' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Remove a liked book
// @route   DELETE /api/user/like/:bookId
// @access  Private
exports.unlikeBook = async (req, res) => {
  const bookId = req.params.bookId || req.body.bookId;

  if (!bookId) {
    return res.status(400).json({ message: 'bookId is required' });
  }

  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const likedBookIds = getUserBookIds(user).filter((id) => id !== bookId);
    saveUserBookIds(user, likedBookIds, getUserDislikedIds(user));
    await user.save();
    void scheduleRetrain();
    res.status(200).json({ message: 'Book removed from likes' });
  } catch (error) {
    console.error('Unlike book error:', error);
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
      res.json(await resolveBooksFromIds(getUserBookIds(user)));
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get next read list
// @route   GET /api/user/next-read
// @access  Private
exports.getNextReadBooks = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(await resolveBooksFromIds(getNextReadIds(user)));
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Add a book to next read list
// @route   POST /api/user/next-read
// @access  Private
exports.addToNextRead = async (req, res) => {
  const { bookId, book } = req.body;

  if (!bookId) {
    return res.status(400).json({ message: 'bookId is required' });
  }

  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const nextReadIds = getNextReadIds(user);

    if (!nextReadIds.includes(bookId)) {
      nextReadIds.push(bookId);
    }

    user.nextReadBooks = nextReadIds;
    await user.save();
    await cacheBookIfProvided(bookId, book);

    res.status(200).json({ message: 'Book added to next read list' });
  } catch (error) {
    console.error('Add to next read error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Remove a book from next read list
// @route   POST /api/user/next-read/remove
// @access  Private
exports.removeFromNextRead = async (req, res) => {
  const bookId = req.params.bookId || req.body.bookId;

  if (!bookId) {
    return res.status(400).json({ message: 'bookId is required' });
  }

  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.nextReadBooks = getNextReadIds(user).filter((id) => id !== bookId);
    await user.save();
    res.status(200).json({ message: 'Book removed from next read list' });
  } catch (error) {
    console.error('Remove from next read error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get ML-powered recommendations
// @route   GET /api/user/recommendations
// @access  Private
exports.getRecommendations = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 8, 1), 20);
    const excludeIds = normalizeBookIds(
      typeof req.query.exclude === 'string'
        ? req.query.exclude.split(',').map((id) => id.trim())
        : []
    );

    if (!user || user.likedBooks.length === 0) {
      const metadata = await recommendationService.getModelMetadata();

      return res.json({
        results: [],
        hasMore: false,
        model: metadata.version,
        weights: metadata.weights,
        trainedAt: metadata.trainedAt,
      });
    }

    const [{ results, hasMore }, metadata] = await Promise.all([
      recommendationService.generateRecommendations(user, {
        limit,
        excludeIds,
      }),
      recommendationService.getModelMetadata(),
    ]);

    res.json({
      results,
      hasMore,
      model: metadata.version,
      weights: metadata.weights,
      trainedAt: metadata.trainedAt,
    });
  } catch (error) {
    console.error('Recommendation error:', error);
    res.status(500).json({ message: 'Could not generate recommendations' });
  }
};
