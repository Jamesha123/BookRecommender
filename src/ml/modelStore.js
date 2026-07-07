const MLModel = require('../models/MLModel');
const mlConfig = require('./config');
const { trainModel } = require('./training/trainer');

let cachedModel = null;
let trainingPromise = null;

const toPlainModel = (document) => {
  if (!document) {
    return null;
  }

  return {
    version: document.version,
    trainedAt: document.trainedAt,
    trainingStats: document.trainingStats,
    vocabulary: document.vocabulary,
    bookFactors: document.bookFactors,
    userFactors: document.userFactors,
    rankerWeights: document.rankerWeights,
    latentDimensions: document.latentDimensions,
  };
};

const isModelStale = (model) => {
  if (!model?.trainedAt) {
    return true;
  }

  return Date.now() - new Date(model.trainedAt).getTime() > mlConfig.MODEL_STALE_MS;
};

const loadLatestModel = async ({ forceReload = false } = {}) => {
  if (cachedModel && !forceReload) {
    return cachedModel;
  }

  const latest = await MLModel.findOne({}).sort({ trainedAt: -1 }).lean();
  cachedModel = toPlainModel(latest);
  return cachedModel;
};

const ensureModel = async () => {
  const model = await loadLatestModel();

  if (model && !isModelStale(model)) {
    return model;
  }

  if (!trainingPromise) {
    trainingPromise = trainModel()
      .then((artifact) => {
        cachedModel = artifact;
        return artifact;
      })
      .catch((error) => {
        console.error('Model training failed:', error.message);
        return cachedModel;
      })
      .finally(() => {
        trainingPromise = null;
      });
  }

  if (model) {
    return model;
  }

  return trainingPromise;
};

const scheduleRetrain = () => {
  if (trainingPromise) {
    return trainingPromise;
  }

  trainingPromise = trainModel()
    .then((artifact) => {
      cachedModel = artifact;
      return artifact;
    })
    .catch((error) => {
      console.error('Background model retrain failed:', error.message);
      return cachedModel;
    })
    .finally(() => {
      trainingPromise = null;
    });

  return trainingPromise;
};

const getModelMetadata = async () => {
  const model = await ensureModel();

  if (!model) {
    return {
      version: 'untrained',
      weights: { content: 0.6, collaborative: 0.4 },
      trainedAt: null,
    };
  }

  const totalWeight = Math.abs(model.rankerWeights.content)
    + Math.abs(model.rankerWeights.collaborative) || 1;

  return {
    version: model.version,
    trainedAt: model.trainedAt,
    trainingStats: model.trainingStats,
    weights: {
      content: Number((Math.abs(model.rankerWeights.content) / totalWeight).toFixed(4)),
      collaborative: Number((Math.abs(model.rankerWeights.collaborative) / totalWeight).toFixed(4)),
    },
    rankerWeights: model.rankerWeights,
  };
};

module.exports = {
  ensureModel,
  loadLatestModel,
  scheduleRetrain,
  getModelMetadata,
  isModelStale,
};
