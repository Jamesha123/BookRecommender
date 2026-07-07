const mongoose = require('mongoose');

const MLModelSchema = new mongoose.Schema({
  version: {
    type: String,
    required: true,
  },
  trainedAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
  trainingStats: {
    type: Object,
    default: {},
  },
  vocabulary: {
    type: Object,
    default: {},
  },
  bookFactors: {
    type: Object,
    default: {},
  },
  userFactors: {
    type: Object,
    default: {},
  },
  rankerWeights: {
    bias: { type: Number, default: 0 },
    content: { type: Number, default: 0.6 },
    collaborative: { type: Number, default: 0.4 },
  },
  latentDimensions: {
    type: Number,
    default: 16,
  },
});

module.exports = mongoose.model('MLModel', MLModelSchema);
