const { buildFeatureText } = require('../../utils/bookFeatures');
const { vectorizeDocument } = require('../training/contentVocabulary');
const { cosineSimilarity } = require('../../utils/similarity');
const {
  dot,
  sigmoid,
  averageVectors,
} = require('../math/linearAlgebra');

const buildContentProfile = (likedBooks, vocabulary) => {
  const vectors = likedBooks.map((book) => (
    vectorizeDocument(buildFeatureText(book), vocabulary)
  ));

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

const getContentScore = (profile, book, vocabulary) => {
  const candidateVector = vectorizeDocument(buildFeatureText(book), vocabulary);
  return cosineSimilarity(profile, candidateVector);
};

const resolveUserFactor = (model, user, likedBooks) => {
  const userId = String(user._id);
  const storedFactor = model.userFactors[userId];

  if (storedFactor) {
    return storedFactor;
  }

  const bookFactors = likedBooks
    .map((book) => model.bookFactors[book.id])
    .filter(Boolean);

  if (bookFactors.length === 0) {
    return null;
  }

  return averageVectors(bookFactors);
};

const getCollaborativeScore = (model, userFactor, bookId) => {
  if (!userFactor) {
    return 0;
  }

  const bookFactor = model.bookFactors[bookId];

  if (!bookFactor) {
    return 0;
  }

  return sigmoid(dot(userFactor, bookFactor));
};

const scoreCandidate = (model, user, likedBooks, candidate) => {
  const profile = buildContentProfile(likedBooks, model.vocabulary);
  const contentScore = getContentScore(profile, candidate, model.vocabulary);
  const userFactor = resolveUserFactor(model, user, likedBooks);
  const collaborativeScore = getCollaborativeScore(model, userFactor, candidate.id);
  const { bias, content, collaborative } = model.rankerWeights;
  const linearScore = bias + (content * contentScore) + (collaborative * collaborativeScore);
  const score = sigmoid(linearScore);

  return {
    score,
    contentScore,
    collaborativeScore,
  };
};

const explainRecommendation = (contentScore, collaborativeScore) => {
  if (contentScore >= collaborativeScore) {
    return 'Similar writing style, themes, and genres to books you liked';
  }

  return 'Popular with readers who share your taste';
};

const scoreCandidates = (model, user, likedBooks, candidates) => {
  return candidates.map((candidate) => {
    const { score, contentScore, collaborativeScore } = scoreCandidate(
      model,
      user,
      likedBooks,
      candidate
    );

    return {
      ...candidate,
      score: Number(score.toFixed(4)),
      contentScore: Number(contentScore.toFixed(4)),
      collaborativeScore: Number(collaborativeScore.toFixed(4)),
      reason: explainRecommendation(contentScore, collaborativeScore),
    };
  });
};

module.exports = {
  scoreCandidates,
  scoreCandidate,
  explainRecommendation,
};
