const mongoose = require('mongoose');

const RETRY_DELAY_MS = 10000;
const MAX_INITIAL_RETRIES = 12;

let reconnectTimer = null;

const connectionOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useCreateIndex: true,
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isConnected = () => mongoose.connection.readyState === 1;

const getConnectionStatus = () => {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  return states[mongoose.connection.readyState] || 'unknown';
};

const scheduleReconnect = () => {
  if (reconnectTimer || isConnected()) {
    return;
  }

  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;

    if (isConnected()) {
      return;
    }

    try {
      await mongoose.connect(process.env.MONGO_URI, connectionOptions);
      console.log('MongoDB reconnected');
    } catch (error) {
      console.warn(`MongoDB still unavailable: ${error.message}`);
      console.warn('If using Atlas free tier, open your cluster in the Atlas dashboard to wake it after long inactivity.');
      scheduleReconnect();
    }
  }, RETRY_DELAY_MS);
};

const connectWithRetry = async () => {
  for (let attempt = 1; attempt <= MAX_INITIAL_RETRIES; attempt += 1) {
    try {
      await mongoose.connect(process.env.MONGO_URI, connectionOptions);
      console.log('MongoDB connected');
      return;
    } catch (error) {
      console.warn(`MongoDB connection attempt ${attempt}/${MAX_INITIAL_RETRIES} failed: ${error.message}`);

      if (attempt < MAX_INITIAL_RETRIES) {
        await sleep(RETRY_DELAY_MS);
      }
    }
  }

  console.error('Could not connect to MongoDB after several attempts.');
  console.error('The API will keep running, but login and recommendations need the database.');
  console.error('If your Atlas cluster was paused from inactivity, wake it in the MongoDB Atlas dashboard and wait about a minute.');
  scheduleReconnect();
};

const setupConnectionEvents = () => {
  mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB disconnected. Will retry automatically.');
    scheduleReconnect();
  });

  mongoose.connection.on('reconnected', () => {
    console.log('MongoDB connection restored');
  });

  mongoose.connection.on('error', (error) => {
    console.error('MongoDB connection error:', error.message);
  });
};

const requireDatabase = (req, res, next) => {
  if (isConnected()) {
    return next();
  }

  return res.status(503).json({
    message: 'Database is waking up or unavailable. If using MongoDB Atlas free tier, open your cluster in the Atlas dashboard after long inactivity, then try again in about a minute.',
    status: 'database_unavailable',
    connection: getConnectionStatus(),
  });
};

module.exports = {
  connectWithRetry,
  setupConnectionEvents,
  requireDatabase,
  isConnected,
  getConnectionStatus,
};
