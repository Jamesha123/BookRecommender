const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const loadEnv = () => {
  dotenv.config({ path: path.join(__dirname, '../../.env') });
  dotenv.config({ path: path.join(__dirname, '../.env') });

  const srcEnvPath = path.join(__dirname, '../.env');

  if (!process.env.MONGO_URI && fs.existsSync(srcEnvPath)) {
    const lines = fs.readFileSync(srcEnvPath, 'utf8')
      .split('\n')
      .map((line) => line.replace(/^\uFEFF/, '').trim())
      .filter(Boolean);

    for (const line of lines) {
      if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(line)) {
        const [key, ...valueParts] = line.split('=');
        if (key.trim() === 'MONGO_URI' && valueParts.length > 0) {
          process.env.MONGO_URI = valueParts.join('=').trim();
          break;
        }
        continue;
      }

      const match = line.match(/mongodb(\+srv)?:\/\/\S+/i);
      if (match) {
        process.env.MONGO_URI = match[0];
        break;
      }
    }
  }

  if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = 'book-recommender-dev-secret-change-me';
    console.warn('JWT_SECRET not set. Using a development fallback — set JWT_SECRET in .env for production.');
  }
};

module.exports = { loadEnv };
