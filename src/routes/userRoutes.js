const express = require('express');
const router = express.Router();
const {
  likeBook,
  dislikeBook,
  unlikeBook,
  getLikedBooks,
  getNextReadBooks,
  addToNextRead,
  removeFromNextRead,
  getRecommendations,
} = require('../controllers/userController');
const { protect } = require('../middlewares/authMiddleware');
const { requireDatabase } = require('../config/database');

router.use(requireDatabase);

/**
 * @swagger
 * tags:
 *   name: User
 *   description: User preferences and recommendations
 */

/**
 * @swagger
 * /user/like:
 *   post:
 *     summary: Like a book
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - bookId
 *             properties:
 *               bookId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Book liked successfully
 *       401:
 *         description: Not authorized
 */
router.post('/like', protect, likeBook);
router.post('/unlike', protect, unlikeBook);
router.delete('/like/:bookId', protect, unlikeBook);

/**
 * @swagger
 * /user/dislike:
 *   post:
 *     summary: Dislike a book
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - bookId
 *             properties:
 *               bookId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Book disliked successfully
 *       401:
 *         description: Not authorized
 */
router.post('/dislike', protect, dislikeBook);

/**
 * @swagger
 * /user/likes:
 *   get:
 *     summary: Get a list of liked books
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: A list of full book objects
 *       401:
 *         description: Not authorized
 */
router.get('/likes', protect, getLikedBooks);
router.get('/next-read', protect, getNextReadBooks);
router.post('/next-read', protect, addToNextRead);
router.post('/next-read/remove', protect, removeFromNextRead);

/**
 * @swagger
 * /user/recommendations:
 *   get:
 *     summary: Get book recommendations
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: A list of recommended books
 *       401:
 *         description: Not authorized
 */
router.get('/recommendations', protect, getRecommendations);

module.exports = router;
