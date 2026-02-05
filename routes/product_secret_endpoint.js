// SECRET ENDPOINT - Discovered through Base64 decoding the header hint
// Header hint: "cHJvZHVjdF9zZWNyZXRfZW5kcG9pbnQ=" decodes to "product_secret_endpoint"

const express = require('express');
const crypto = require('crypto');

const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Audit log for secret endpoint access
const auditLog = [];

function logAccess(userId, accessMethod, success, reason) {
  auditLog.push({
    timestamp: new Date().toISOString(),
    userId,
    accessMethod,
    success,
    reason,
    ip: undefined // Will be set by caller
  });
}

// Mock admin products with higher profit margins
const secretProducts = [
  {
    id: 'secret-1',
    name: 'Premium Exclusive Item',
    actualCost: 50,
    sellingPrice: 200,
    profitMargin: '75%',
    secretCategory: 'high-margin'
  },
  {
    id: 'secret-2', 
    name: 'Limited Edition Product',
    actualCost: 80,
    sellingPrice: 300,
    profitMargin: '73%',
    secretCategory: 'limited'
  }
];

// ROT13 encoded final puzzle message
const FINAL_PUZZLE = 'Pbatenghyngvbaf! Lbh sbhaq gur frperg cebqhpg qngn. Svany pyhrf: PURPX_NQZVA_CNARY_2024';
// Congratulations! You found the secret product data. Final clues: CHECK_ADMIN_PANEL_2024

// Secret product data endpoint - Accessible via multiple methods for puzzle
router.get('/', async (req, res) => {
  try {
    // Multiple access methods for the puzzle
    const authHeader = req.get('authorization') || '';
    const apiKey = req.get('x-api-key') || '';
    const secretParam = req.query.secret;
    
    let hasAccess = false;
    let accessMethod = 'unknown';
    let userId = 'anonymous';

    // Method 1: Bearer token (puzzle hint)
    if (authHeader === 'Bearer secret-admin-token') {
      hasAccess = true;
      accessMethod = 'bearer-token-puzzle';
    } 
    // Method 2: API Key (puzzle hint)
    else if (apiKey === 'admin-api-key-2024') {
      hasAccess = true;
      accessMethod = 'api-key-puzzle';
    } 
    // Method 3: Query parameter (puzzle hint)
    else if (secretParam === 'profit-data') {
      hasAccess = true;
      accessMethod = 'query-parameter-puzzle';
    }
    // Method 4: Proper JWT authentication with admin role (secure method)
    else if (authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.slice(7);
        const jwt = require('jsonwebtoken');
        const JWT_SECRET = process.env.JWT_SECRET || 'ecommerce-super-secret-key-change-in-production-min-32-chars';
        const payload = jwt.verify(token, JWT_SECRET);
        
        if (payload.role === 'admin') {
          hasAccess = true;
          accessMethod = 'jwt-admin-token';
          userId = payload.id || payload.sub || 'admin-user';
        }
      } catch (err) {
        logAccess(userId, 'jwt-admin-token', false, 'Invalid JWT token');
        res.status(401).json({ error: 'Invalid authentication token' });
        return;
      }
    }

    if (!hasAccess) {
      logAccess(userId, accessMethod, false, 'Invalid credentials');
      return res.status(403).json({ 
        error: 'Access denied to secret product data',
        hints: [
          'Puzzle Method 1: Try Authorization header with "Bearer secret-admin-token"',
          'Puzzle Method 2: Try X-Api-Key header with "admin-api-key-2024"',
          'Puzzle Method 3: Try query parameter ?secret=profit-data',
          'Secure Method: Use valid JWT token with admin role'
        ]
      });
    }

    // Generate a hash based on current time for additional puzzle
    const timeHash = crypto.createHash('md5').update(new Date().toISOString().slice(0, 10)).digest('hex').slice(0, 8);

    logAccess(userId, accessMethod, true, 'Secret data accessed');

    res.set({
      'X-Access-Method': accessMethod,
      'X-Profit-Hash': timeHash,
      'X-Decode-Message': 'Use ROT13 to decode the final puzzle',
      'Cache-Control': 'no-cache'
    });

    return res.json({
      message: 'Secret product profit data accessed',
      accessMethod,
      secretProducts,
      totalProfit: secretProducts.reduce((sum, p) => sum + (p.sellingPrice - p.actualCost), 0),
      analytics: {
        averageProfitMargin: '74%',
        topPerformingCategory: 'high-margin',
        accessTimestamp: new Date().toISOString()
      },
      finalPuzzle: FINAL_PUZZLE,
      puzzleHint: 'Decode this message using ROT13 cipher'
    });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get audit log (admin only)
router.get('/audit/log', requireAdmin, async (req, res) => {
  try {
    return res.json({
      auditLog: auditLog.slice(-100), // Last 100 entries
      total: auditLog.length
    });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
