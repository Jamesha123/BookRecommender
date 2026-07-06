const mongoose = require('mongoose');
require('dotenv').config({ path: '.env' });

const setupTestDB = () => {
  beforeAll(async () => {
    const url = process.env.MONGO_URI_TEST || 'mongodb://localhost:27017/book-recommender-test';
    await mongoose.connect(url, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      useCreateIndex: true,
    });
  });

  beforeEach(async () => {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });
};

module.exports = setupTestDB;
