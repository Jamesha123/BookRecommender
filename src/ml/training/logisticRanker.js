const { sigmoid } = require('../math/linearAlgebra');

const trainLogisticRanker = (samples, options = {}) => {
  const {
    epochs = 40,
    learningRate = 0.1,
    regularization = 0.001,
  } = options;

  const weights = {
    bias: 0,
    content: 0.6,
    collaborative: 0.4,
  };

  if (samples.length === 0) {
    return weights;
  }

  for (let epoch = 0; epoch < epochs; epoch += 1) {
    samples.forEach(({ contentScore, collaborativeScore, label }) => {
      const linearScore = (
        weights.bias
        + (weights.content * contentScore)
        + (weights.collaborative * collaborativeScore)
      );
      const prediction = sigmoid(linearScore);
      const error = label - prediction;

      weights.bias += learningRate * (error - regularization * weights.bias);
      weights.content += learningRate * (error * contentScore - regularization * weights.content);
      weights.collaborative += learningRate * (
        error * collaborativeScore - regularization * weights.collaborative
      );
    });
  }

  return weights;
};

module.exports = {
  trainLogisticRanker,
};
