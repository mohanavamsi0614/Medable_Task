require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

// Import routes
const productsRoutes = require('./routes/products');
const cartRoutes = require('./routes/cart');
const secretProductRoutes = require('./routes/product_secret_endpoint');

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 120;
const rateLimitMap = new Map();

app.use((req, res, next) => {
  const now = Date.now();
  const key = req.ip;
  const entry = rateLimitMap.get(key) || { count: 0, start: now };

  if (now - entry.start > RATE_LIMIT_WINDOW_MS) {
    entry.count = 0;
    entry.start = now;
  }

  entry.count += 1;
  rateLimitMap.set(key, entry);

  if (entry.count > RATE_LIMIT_MAX) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  return next();
});

// Custom headers for puzzle hints
app.use((req, res, next) => {
  res.set({
    'X-API-Version': 'v2.0',
    'X-Puzzle-Hint': 'base64_decode_this_cHJvZHVjdF9zZWNyZXRfZW5kcG9pbnQ='
  });
  next();
});

// Routes
app.use('/api/products', productsRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/product_secret_endpoint', secretProductRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Serve static files
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handler
app.use((error, req, res, next) => {
  console.error('Error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`🛒 Assessment 2: E-commerce Product API running on http://localhost:${PORT}`);
  console.log(`📋 View instructions: http://localhost:${PORT}`);
  console.log(`⚡ Performance challenges await!`);
});
