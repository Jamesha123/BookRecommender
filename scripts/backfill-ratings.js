const { loadEnv } = require('../src/config/env');
loadEnv();

const mongoose = require('mongoose');
const Book = require('../src/models/Book');
const { toApiBook } = require('../src/utils/bookFeatures');
const { enrichBooksWithRatings } = require('../src/services/bookService');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

(async () => {
  await mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  const books = await Book.find({}).lean();
  const batchSize = 10;
  let updated = 0;

  for (let index = 0; index < books.length; index += batchSize) {
    const batch = books.slice(index, index + batchSize).map(toApiBook);
    const enriched = await enrichBooksWithRatings(batch);

    enriched.forEach((book, offset) => {
      const original = batch[offset];
      if (
        Number.isFinite(Number(book.averageRating))
        && (
          book.averageRating !== original.averageRating
          || book.ratingsCount !== original.ratingsCount
        )
      ) {
        updated += 1;
      }
    });

    if (index + batchSize < books.length) {
      await sleep(250);
    }
  }

  const withRating = await Book.countDocuments({
    averageRating: { $exists: true, $ne: null },
  });

  console.log(`Backfill complete. Updated ${updated} books. ${withRating}/${books.length} now have ratings.`);
  await mongoose.disconnect();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
