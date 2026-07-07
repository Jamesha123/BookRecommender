const mongoose = require('mongoose');

const BookSchema = new mongoose.Schema({
  googleId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  title: String,
  authors: [String],
  categories: [String],
  description: String,
  thumbnail: String,
  averageRating: Number,
  ratingsCount: Number,
  featureText: String,
  lastFetched: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Book', BookSchema);
