const { dot, sigmoid, randomVector } = require('../math/linearAlgebra');

const buildIndexMap = (ids) => {
  const indexMap = new Map();
  ids.forEach((id, index) => {
    indexMap.set(id, index);
  });
  return indexMap;
};

const trainMatrixFactorization = (interactions, options = {}) => {
  const {
    factors = 16,
    epochs = 25,
    learningRate = 0.05,
    regularization = 0.02,
  } = options;

  const userIds = [...new Set(interactions.map((item) => item.userId))];
  const bookIds = [...new Set(interactions.map((item) => item.bookId))];

  if (userIds.length === 0 || bookIds.length === 0 || interactions.length === 0) {
    return {
      userFactors: {},
      bookFactors: {},
      userIds,
      bookIds,
    };
  }

  const userIndex = buildIndexMap(userIds);
  const bookIndex = buildIndexMap(bookIds);
  const userVectors = userIds.map(() => randomVector(factors));
  const bookVectors = bookIds.map(() => randomVector(factors));

  for (let epoch = 0; epoch < epochs; epoch += 1) {
    interactions.forEach(({ userId, bookId, label }) => {
      const userPosition = userIndex.get(userId);
      const bookPosition = bookIndex.get(bookId);
      const userVector = userVectors[userPosition];
      const bookVector = bookVectors[bookPosition];
      const prediction = sigmoid(dot(userVector, bookVector));
      const error = label - prediction;

      for (let factor = 0; factor < factors; factor += 1) {
        const userValue = userVector[factor];
        const bookValue = bookVector[factor];
        const userGradient = error * bookValue - regularization * userValue;
        const bookGradient = error * userValue - regularization * bookValue;

        userVector[factor] += learningRate * userGradient;
        bookVector[factor] += learningRate * bookGradient;
      }
    });
  }

  const userFactors = {};
  const bookFactors = {};

  userIds.forEach((userId, index) => {
    userFactors[userId] = userVectors[index];
  });

  bookIds.forEach((bookId, index) => {
    bookFactors[bookId] = bookVectors[index];
  });

  return {
    userFactors,
    bookFactors,
    userIds,
    bookIds,
  };
};

module.exports = {
  trainMatrixFactorization,
};
