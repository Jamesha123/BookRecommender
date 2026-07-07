const { getContentScores } = require('../src/utils/contentModel');
const {
  jaccardSimilarity,
  cosineSimilarity,
  normalizeScores,
} = require('../src/utils/similarity');
const {
  CONTENT_WEIGHT,
  COLLABORATIVE_WEIGHT,
  POPULARITY_BIAS_WEIGHT,
} = require('../src/services/recommendationService');
const {
  getPopularitySignal,
  applyPopularityBias,
} = require('../src/utils/popularity');

describe('Recommendation ML utilities', () => {
  it('calculates jaccard similarity between user taste profiles', () => {
    const setA = new Set(['a', 'b', 'c']);
    const setB = new Set(['b', 'c', 'd']);

    expect(jaccardSimilarity(setA, setB)).toBeCloseTo(0.5, 5);
  });

  it('calculates cosine similarity between sparse vectors', () => {
    const vectorA = { fantasy: 0.8, adventure: 0.4 };
    const vectorB = { fantasy: 0.6, adventure: 0.2, dragons: 0.3 };

    expect(cosineSimilarity(vectorA, vectorB)).toBeGreaterThan(0.85);
  });

  it('ranks similar books higher with TF-IDF content scoring', () => {
    const likedBooks = [
      {
        id: 'liked-1',
        title: 'Dune',
        authors: ['Frank Herbert'],
        categories: ['Science Fiction'],
        description: 'Desert planet politics spice worms empire',
      },
    ];

    const candidates = [
      {
        id: 'candidate-1',
        title: 'Dune Messiah',
        authors: ['Frank Herbert'],
        categories: ['Science Fiction'],
        description: 'Paul Atreides empire desert politics prophecy',
      },
      {
        id: 'candidate-2',
        title: 'Cooking Basics',
        authors: ['Chef Example'],
        categories: ['Cooking'],
        description: 'Kitchen recipes pasta sauces desserts',
      },
    ];

    const scores = getContentScores(likedBooks, candidates);

    expect(scores['candidate-1']).toBeGreaterThan(scores['candidate-2']);
  });

  it('exposes default hybrid weight constants for fallback scoring', () => {
    expect(CONTENT_WEIGHT + COLLABORATIVE_WEIGHT).toBeCloseTo(1, 5);
  });

  it('normalizes score ranges to zero-one', () => {
    const normalized = normalizeScores({ a: 2, b: 5, c: 8 });
    expect(normalized.a).toBe(0);
    expect(normalized.c).toBe(1);
  });

  it('derives a stronger popularity signal from highly rated books', () => {
    const obscure = getPopularitySignal({ averageRating: 3.5, ratingsCount: 12 });
    const popular = getPopularitySignal({ averageRating: 4.8, ratingsCount: 12000 });

    expect(popular).toBeGreaterThan(obscure);
  });

  it('gives popular books a small ranking boost without penalizing unknown titles', () => {
    const books = [
      { id: 'a', score: 0.5, averageRating: 3.2, ratingsCount: 20 },
      { id: 'b', score: 0.5, averageRating: 4.7, ratingsCount: 18000 },
      { id: 'c', score: 0.5 },
    ];

    const boosted = applyPopularityBias(books, POPULARITY_BIAS_WEIGHT);
    const popular = boosted.find((book) => book.id === 'b');
    const obscure = boosted.find((book) => book.id === 'a');
    const unknown = boosted.find((book) => book.id === 'c');

    expect(popular.score).toBeGreaterThan(obscure.score);
    expect(unknown.score).toBe(0.5);
  });
});
