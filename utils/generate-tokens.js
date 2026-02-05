require('dotenv').config();
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'ecommerce-super-secret-key-change-in-production-min-32-chars';

// Generate admin token
const adminToken = jwt.sign(
  { sub: 'admin-1', id: 'admin-1', role: 'admin' },
  JWT_SECRET,
  { expiresIn: '24h' }
);

// Generate user token
const userToken = jwt.sign(
  { sub: 'user-123', id: 'user-123', role: 'user' },
  JWT_SECRET,
  { expiresIn: '24h' }
);

console.log('\n=== E-commerce API Test Tokens ===\n');
console.log('Admin Token (valid for 24 hours):');
console.log(adminToken);
console.log('\nUser Token (valid for 24 hours):');
console.log(userToken);
console.log('\n=== Usage Examples ===\n');
console.log('# Create product (admin only):');
console.log(`curl -X POST "http://localhost:3002/api/products" \\`);
console.log(`  -H "Authorization: Bearer ${adminToken}" \\`);
console.log(`  -H "Content-Type: application/json" \\`);
console.log(`  -d '{"name":"Test Product","price":99.99,"category":"Electronics"}'\n`);
console.log('# Get cart (user):');
console.log(`curl "http://localhost:3002/api/cart" \\`);
console.log(`  -H "Authorization: Bearer ${userToken}"\n`);
