const { buildFeatureText } = require('./bookFeatures');
const { buildTfidfVectors } = require('./tfidf');
const { cosineSimilarity, averageVectors } = require('./similarity');

const getContentScores = (likedBooks, candidates) => {
  if (likedBooks.length === 0 || candidates.length === 0) {
    return {};
  }

  const documents = [
    ...likedBooks.map((book) => buildFeatureText(book)),
    ...candidates.map((book) => buildFeatureText(book)),
  ];

  const vectors = buildTfidfVectors(documents);
  const likedVectors = vectors.slice(0, likedBooks.length);
  const candidateVectors = vectors.slice(likedBooks.length);
  const profileVector = averageVectors(likedVectors);
  const scores = {};

  candidates.forEach((candidate, index) => {
    scores[candidate.id] = cosineSimilarity(profileVector, candidateVectors[index]);
  });

  return scores;
};

module.exports = {
  getContentScores,
};
