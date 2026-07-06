const jaccardSimilarity = (setA, setB) => {
  if (setA.size === 0 && setB.size === 0) {
    return 0;
  }

  const intersection = [...setA].filter((item) => setB.has(item)).length;
  const union = new Set([...setA, ...setB]).size;

  return union === 0 ? 0 : intersection / union;
};

const cosineSimilarity = (vectorA, vectorB) => {
  const terms = new Set([...Object.keys(vectorA), ...Object.keys(vectorB)]);

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  terms.forEach((term) => {
    const a = vectorA[term] || 0;
    const b = vectorB[term] || 0;
    dotProduct += a * b;
    normA += a * a;
    normB += b * b;
  });

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};

const averageVectors = (vectors) => {
  if (vectors.length === 0) {
    return {};
  }

  const combined = {};
  const counts = {};

  vectors.forEach((vector) => {
    Object.entries(vector).forEach(([term, score]) => {
      combined[term] = (combined[term] || 0) + score;
      counts[term] = (counts[term] || 0) + 1;
    });
  });

  Object.keys(combined).forEach((term) => {
    combined[term] /= counts[term];
  });

  return combined;
};

const normalizeScores = (scoresById) => {
  const values = Object.values(scoresById);

  if (values.length === 0) {
    return {};
  }

  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min;

  if (range === 0) {
    return Object.fromEntries(
      Object.keys(scoresById).map((id) => [id, values[0] > 0 ? 1 : 0])
    );
  }

  return Object.fromEntries(
    Object.entries(scoresById).map(([id, score]) => [id, (score - min) / range])
  );
};

module.exports = {
  jaccardSimilarity,
  cosineSimilarity,
  averageVectors,
  normalizeScores,
};
