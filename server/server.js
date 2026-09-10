// Load environment variables before anything reads process.env.
require('dotenv').config();

const express = require('express');
const path = require('path');
const productsRouter = require('./routes/products');
const authRouter = require('./routes/auth');
const { connectDB, getConnectionState } = require('./db/connection');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ ok: true, status: 'healthy', db: getConnectionState() });
});

app.use('/api/products', productsRouter);
app.use('/api/auth', authRouter);

// Serve the frontend from the same origin so relative fetch('/api/...')
// calls in public/js/*.js reach this Express API (no CORS needed).
// Mounted AFTER the API routes so /api/* and /health take precedence.
app.use(express.static(path.join(__dirname, '..', 'public')));

if (require.main === module) {
  // Fail fast when MongoDB is not configured so the server never pretends
  // authentication works without a database.
  connectDB()
    .then(() => {
      app.listen(port, () => {
        console.log(`PriceWise API ready on http://localhost:${port}`);
      });
    })
    .catch((error) => {
      console.error(error && error.message ? error.message : 'MongoDB connection failed.');
      process.exit(1);
    });
}

module.exports = app;
