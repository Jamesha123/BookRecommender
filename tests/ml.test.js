const { trainMatrixFactorization } = require('../src/ml/training/matrixFactorization');
const { trainLogisticRanker } = require('../src/ml/training/logisticRanker');
const { buildVocabulary, vectorizeDocument } = require('../src/ml/training/contentVocabulary');
const { buildFeatureText } = require('../src/utils/bookFeatures');
const { cosineSimilarity } = require('../src/utils/similarity');
const { dot, sigmoid } = require('../src/ml/math/linearAlgebra');

describe('trained ML pipeline', () => {
  it('learns higher scores for co-liked books with matrix factorization', () => {
    const interactions = [
      { userId: 'u1', bookId: 'b1', label: 1 },
      { userId: 'u1', bookId: 'b2', label: 1 },
      { userId: 'u2', bookId: 'b2', label: 1 },
      { userId: 'u2', bookId: 'b3', label: 1 },
      { userId: 'u1', bookId: 'b4', label: 0 },
    ];

    const { userFactors, bookFactors } = trainMatrixFactorization(interactions, {
      factors: 8,
      epochs: 40,
      learningRate: 0.08,
      regularization: 0.01,
    });

    const positiveScore = sigmoid(dot(userFactors.u1, bookFactors.b2));
    const negativeScore = sigmoid(dot(userFactors.u1, bookFactors.b4));

    expect(positiveScore).toBeGreaterThan(negativeScore);
  });

  it('learns ranker weights from labeled feature samples', () => {
    const samples = [
      { contentScore: 0.9, collaborativeScore: 0.2, label: 1 },
      { contentScore: 0.8, collaborativeScore: 0.1, label: 1 },
      { contentScore: 0.1, collaborativeScore: 0.05, label: 0 },
      { contentScore: 0.05, collaborativeScore: 0.02, label: 0 },
    ];

    const weights = trainLogisticRanker(samples, {
      epochs: 80,
      learningRate: 0.2,
      regularization: 0.001,
    });

    expect(weights.content).toBeGreaterThan(0);
    expect(weights.collaborative).toBeGreaterThanOrEqual(0);
  });

  it('builds a reusable vocabulary for content features', () => {
    const documents = [
      'dune desert science fiction politics',
      'dune messiah empire prophecy science fiction',
      'cooking pasta kitchen recipes',
    ];

    const vocabulary = buildVocabulary(documents);
    const duneVector = vectorizeDocument('dune desert politics', vocabulary);
    const cookingVector = vectorizeDocument('cooking pasta kitchen', vocabulary);

    expect(cosineSimilarity(duneVector, cookingVector)).toBeLessThan(
      cosineSimilarity(
        vectorizeDocument('dune messiah empire', vocabulary),
        duneVector
      )
    );
  });

  it('uses book metadata when building feature text', () => {
    const text = buildFeatureText({
      title: 'Dune',
      authors: ['Frank Herbert'],
      categories: ['Science Fiction'],
      description: 'Desert planet spice empire',
    });

    expect(text).toContain('dune');
    expect(text).toContain('science fiction');
  });
});
