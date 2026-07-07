const mongoose = require('mongoose');
const { loadEnv } = require('../src/config/env');
const { trainModel } = require('../src/ml/training/trainer');

loadEnv();

const run = async () => {
  if (!process.env.MONGO_URI) {
    console.error('Missing MONGO_URI in .env');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useCreateIndex: true,
  });

  const artifact = await trainModel();

  console.log('Training complete.');
  console.log(`Model version: ${artifact.version}`);
  console.log(`Users: ${artifact.trainingStats.users}`);
  console.log(`Books: ${artifact.trainingStats.books}`);
  console.log(`Interactions: ${artifact.trainingStats.interactions}`);
  console.log(`Ranker weights:`, artifact.rankerWeights);

  await mongoose.connection.close();
};

run().catch((error) => {
  console.error('Training failed:', error.message);
  process.exit(1);
});
