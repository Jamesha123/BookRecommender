const MLModel = require('../../models/MLModel');
const mlConfig = require('../config');
const { buildTrainingDataset } = require('./datasetBuilder');
const { buildVocabulary, vectorizeDocument } = require('./contentVocabulary');
const { trainMatrixFactorization } = require('./matrixFactorization');
const { trainLogisticRanker } = require('./logisticRanker');
const { buildFeatureText } = require('../../utils/bookFeatures');
const { cosineSimilarity } = require('../../utils/similarity');
const { dot, sigmoid } = require('../math/linearAlgebra');

const buildRankerSamples = (interactions, vocabulary, userFactors, bookFactors, books) => {
  const booksById = new Map(books.map((book) => [book.id, book]));
  const userLikedVectors = new Map();

  interactions.forEach(({ userId, bookId, label }) => {
    if (label !== 1) {
      return;
    }

    const book = booksById.get(bookId);
    if (!book) {
      return;
    }

    const vector = vectorizeDocument(buildFeatureText(book), vocabulary);
    const existing = userLikedVectors.get(userId) || [];
    existing.push(vector);
    userLikedVectors.set(userId, existing);
  });

  const getProfile = (userId) => {
    const vectors = userLikedVectors.get(userId) || [];

    if (vectors.length === 0) {
      return {};
    }

    const profile = {};

    vectors.forEach((vector) => {
      Object.entries(vector).forEach(([term, value]) => {
        profile[term] = (profile[term] || 0) + value;
      });
    });

    Object.keys(profile).forEach((term) => {
      profile[term] /= vectors.length;
    });

    return profile;
  };

  return interactions.map(({ userId, bookId, label }) => {
    const book = booksById.get(bookId);
    const profile = getProfile(userId);
    const candidateVector = book
      ? vectorizeDocument(buildFeatureText(book), vocabulary)
      : {};
    const contentScore = cosineSimilarity(profile, candidateVector);

    const userVector = userFactors[userId];
    const bookFactorVector = bookFactors[bookId];
    const collaborativeScore = userVector && bookFactorVector
      ? sigmoid(dot(userVector, bookFactorVector))
      : 0;

    return {
      contentScore,
      collaborativeScore,
      label,
    };
  });
};

const trainModel = async () => {
  const dataset = await buildTrainingDataset();

  if (dataset.interactions.length === 0) {
    throw new Error('Cannot train model without user likes or dislikes.');
  }

  const vocabulary = buildVocabulary(dataset.documents);
  const factorization = trainMatrixFactorization(dataset.interactions, {
    factors: mlConfig.LATENT_FACTORS,
    epochs: mlConfig.MF_EPOCHS,
    learningRate: mlConfig.MF_LEARNING_RATE,
    regularization: mlConfig.MF_REGULARIZATION,
  });

  const rankerSamples = buildRankerSamples(
    dataset.interactions,
    vocabulary,
    factorization.userFactors,
    factorization.bookFactors,
    dataset.books
  );

  const rankerWeights = trainLogisticRanker(rankerSamples, {
    epochs: mlConfig.RANKER_EPOCHS,
    learningRate: mlConfig.RANKER_LEARNING_RATE,
    regularization: mlConfig.RANKER_REGULARIZATION,
  });

  const artifact = {
    version: mlConfig.MODEL_VERSION,
    trainedAt: new Date(),
    trainingStats: {
      users: dataset.userCount,
      books: dataset.bookCount,
      interactions: dataset.interactions.length,
      positiveExamples: dataset.interactions.filter((item) => item.label === 1).length,
      negativeExamples: dataset.interactions.filter((item) => item.label === 0).length,
    },
    vocabulary,
    bookFactors: factorization.bookFactors,
    userFactors: factorization.userFactors,
    rankerWeights,
    latentDimensions: mlConfig.LATENT_FACTORS,
  };

  await MLModel.create(artifact);

  return artifact;
};

module.exports = {
  trainModel,
};
