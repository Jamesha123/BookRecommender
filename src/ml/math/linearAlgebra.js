const dot = (vectorA, vectorB) => {
  const length = Math.min(vectorA.length, vectorB.length);
  let sum = 0;

  for (let index = 0; index < length; index += 1) {
    sum += vectorA[index] * vectorB[index];
  }

  return sum;
};

const addScaled = (target, source, scale) => {
  for (let index = 0; index < target.length; index += 1) {
    target[index] += scale * (source[index] || 0);
  }
};

const l2Norm = (vector) => Math.sqrt(vector.reduce((sum, value) => sum + (value * value), 0));

const cosineSimilarity = (vectorA, vectorB) => {
  const normA = l2Norm(vectorA);
  const normB = l2Norm(vectorB);

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dot(vectorA, vectorB) / (normA * normB);
};

const averageVectors = (vectors) => {
  if (vectors.length === 0) {
    return [];
  }

  const length = vectors[0].length;
  const combined = new Array(length).fill(0);

  vectors.forEach((vector) => {
    for (let index = 0; index < length; index += 1) {
      combined[index] += vector[index] || 0;
    }
  });

  return combined.map((value) => value / vectors.length);
};

const sigmoid = (value) => 1 / (1 + Math.exp(-value));

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const randomVector = (size, scale = 0.05) => (
  Array.from({ length: size }, () => (Math.random() * 2 - 1) * scale)
);

module.exports = {
  dot,
  addScaled,
  l2Norm,
  cosineSimilarity,
  averageVectors,
  sigmoid,
  clamp,
  randomVector,
};
