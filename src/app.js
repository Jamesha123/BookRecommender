const path = require('path');
const { loadEnv } = require('./config/env');

loadEnv();

const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/authRoutes');
const bookRoutes = require('./routes/bookRoutes');
const userRoutes = require('./routes/userRoutes');
const setupSwagger = require('./swaggerConfig');
const {
  connectWithRetry,
  setupConnectionEvents,
  isConnected,
  getConnectionStatus,
} = require('./config/database');

const app = express();

app.use(cors());
app.use(express.json());

// Setup Swagger after middleware
setupSwagger(app);

// Database Connection
if (process.env.NODE_ENV !== 'test') {
  if (!process.env.MONGO_URI) {
    console.error('Missing MONGO_URI. Add it to .env in the project root or src/.env');
    process.exit(1);
  }

  setupConnectionEvents();
  connectWithRetry();
}

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    database: {
      connected: isConnected(),
      state: getConnectionStatus(),
    },
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/user', userRoutes);

app.use(express.static(path.join(__dirname, '../public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

module.exports = app;
