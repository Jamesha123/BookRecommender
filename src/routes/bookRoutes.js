const express = require('express');
const router = express.Router();
const { search, getBookDetails } = require('../controllers/bookController');

/**
 * @swagger
 * tags:
 *   name: Books
 *   description: Book searching and details
 */

/**
 * @swagger
 * /books/search:
 *   get:
 *     summary: Search for books
 *     tags: [Books]
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         required: true
 *         description: The search query
 *     responses:
 *       200:
 *         description: A list of books
 *       400:
 *         description: Search query is required
 */
router.get('/search', search);

/**
 * @swagger
 * /books/{id}:
 *   get:
 *     summary: Get details for a specific book
 *     tags: [Books]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The Google Books volume ID
 *     responses:
 *       200:
 *         description: Book details
 *       500:
 *         description: Error fetching book details
 */
router.get('/:id', getBookDetails);

module.exports = router;
