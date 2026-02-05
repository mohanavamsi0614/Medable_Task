# 🛒 Assessment 2: E-commerce Product API

Welcome to the E-commerce Product API assessment! This project simulates a real-world e-commerce backend with critical performance issues and security vulnerabilities that you need to identify and fix.

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn

### Installation

```bash
npm install
```

### Running the Server

**Development Mode (with auto-reload):**
```bash
npm run dev
```

**Production Mode:**
```bash
npm start
```

The API will be available at:
- Local: `http://localhost:3002`
- Default Port: `3002` (configurable via `PORT` environment variable)

### Environment Setup

Create a `.env` file in the root directory:

```env
PORT=3002
JWT_SECRET=ecommerce-super-secret-key-change-in-production-min-32-chars
NODE_ENV=development
```

### Generating Test Tokens

To generate JWT tokens for testing:

```bash
node utils/generate-tokens.js
```

This will output:
- Admin Token (for admin operations)
- User Token (for user operations)
- Usage examples with curl commands

## 📚 API Documentation

### Product Management

#### GET /api/products
Get paginated list of products with search and filtering
```bash
# Basic usage
curl "http://localhost:3002/api/products"

# With pagination and search
curl "http://localhost:3002/api/products?page=1&limit=10&search=electronics&category=Electronics"
```

#### GET /api/products/:id
Get single product by ID
```bash
curl "http://localhost:3002/api/products/1"
```

#### POST /api/products
Create new product (requires admin authentication)
```bash
curl -X POST "http://localhost:3002/api/products" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -d '{"name":"New Product","price":99.99,"category":"Electronics"}'
```

### Cart Management

#### GET /api/cart
Get user's cart
```bash
curl "http://localhost:3002/api/cart" \
  -H "Authorization: Bearer <USER_TOKEN>"
```

#### POST /api/cart
Add item to cart
```bash
curl -X POST "http://localhost:3002/api/cart" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <USER_TOKEN>" \
  -d '{"productId":"1","quantity":2}'
```

### Secret Endpoint

#### GET /api/product_secret_endpoint
Access secret product data (admin only, discovered via base64 hint)
```bash
curl "http://localhost:3002/api/product_secret_endpoint" \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

## ⚡ Features to Implement

### Must-Have Features
1. **Authentication Middleware** - Proper JWT-based authentication
2. **Product Caching System** - Cache frequently accessed products
3. **Search Optimization** - Implement proper search indexing
4. **Cart Persistence** - Proper database/storage for cart data
5. **Input Validation** - Comprehensive validation for all endpoints
6. **Error Handling** - Proper error responses without data leakage

### Nice-to-Have Features
7. **Product Categories API** - Separate endpoint for managing categories
8. **Inventory Management** - Track and update product stock levels
9. **Order Management** - Convert carts to orders
10. **Product Reviews** - Rating and review system for products
11. **Wishlist Functionality** - Save products for later
12. **Bulk Operations** - Batch create/update products

## 🧩 Puzzle Solutions

### Puzzle 1: Header Hint (Base64 Decoding)
**Location:** Server middleware header `X-Puzzle-Hint`

**Encoded Value:** `cHJvZHVjdF9zZWNyZXRfZW5kcG9pbnQ=`

**Solution:**
```javascript
// Decode the base64 string
const hint = Buffer.from('cHJvZHVjdF9zZWNyZXRfZW5kcG9pbnQ=', 'base64').toString();
console.log(hint); // Output: "product_secret_endpoint"
```

**What It Reveals:** There's a hidden secret endpoint at `/api/product_secret_endpoint` that contains sensitive product data with cost information and profit margins.

**Access Method:**
```bash
# Using authentication
curl "http://localhost:3002/api/product_secret_endpoint" \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

---

### Puzzle 2: ROT13 Encoded Message
**Location:** `routes/product_secret_endpoint.js`

**Encoded Value:** `Pbatenghyngvbaf! Lbh sbhaq gur frperg cebqhpg qngn. Svany pyhrf: PURPX_NQZVA_CNARY_2024`

**Solution:**
```javascript
// ROT13 decode (shift each letter by 13 positions)
const rot13 = (str) => str.replace(/[a-zA-Z]/g, c => 
  String.fromCharCode((c <= 'Z' ? 90 : 122) >= (c = c.charCodeAt(0) + 13) ? c : c - 26)
);

const decoded = rot13('Pbatenghyngvbaf! Lbh sbhaq gur frperg cebqhpg qngn. Svany pyhrf: PURPX_NQZVA_CNARY_2024');
console.log(decoded);
// Output: "Congratulations! You found the secret product data. Final clues: CHECK_ADMIN_PANEL_2024"
```

**What It Reveals:** The final message confirms you've found the secret product endpoint and hints at an admin panel (2024 reference).

---

### Puzzle 3: Admin Query Parameter Vulnerability
**Location:** `routes/products.js`

**Issue:** The original code has a debug parameter `?admin=true` that bypasses security.

**Solution:**
```bash
# This should NOT work in the fixed version
curl "http://localhost:3002/api/products?admin=true"

# The API should reject the admin parameter
```

**What It Teaches:** Never expose debug parameters in production. Use proper JWT authentication instead.

---

### Puzzle 4: Internal Data Exposure
**Location:** `routes/products.js` - `?internal=yes` parameter

**Issue:** The `?internal=yes` parameter exposes cost information and supplier details.

**Solution - Removal:**
```bash
# This query parameter should be removed entirely
# It previously exposed: actualCost, supplierInfo, markup, internalNotes
```

---

### Puzzle 5: Hidden Date-based Key
**Location:** Token generation and verification

**Calculation:**
```javascript
// MD5 hash of today's date, first 8 characters
const crypto = require('crypto');
const d = '2026-02-05';
const h = crypto.createHash('md5').update(d).digest('hex').slice(0, 8);
console.log(h); // Date-based verification key
```

**Lesson:** Security keys should never be time-based or predictable. Use proper environment-based secrets.

---

### Puzzle 6: Secret Products Data
**Location:** `routes/product_secret_endpoint.js`

**Secret Products:**
```json
[
  {
    "id": "secret-1",
    "name": "Premium Exclusive Item",
    "actualCost": 50,
    "sellingPrice": 200,
    "profitMargin": "75%"
  },
  {
    "id": "secret-2",
    "name": "Limited Edition Product",
    "actualCost": 80,
    "sellingPrice": 300,
    "profitMargin": "73%"
  }
]
```

**Security Issue:** Cost and profit data should NEVER be exposed to unauthorized users.

**Fix:** Implement role-based access control with proper authentication.

---

## 🎯 Testing the Puzzles

```bash
# 1. Start the server
npm run dev

# 2. Generate test tokens
node utils/generate-tokens.js

# 3. Decode the base64 header hint
node -e "console.log(Buffer.from('cHJvZHVjdF9zZWNyZXRfZW5kcG9pbnQ=', 'base64').toString())"

# 4. Decode ROT13 message
node -e "const rot13=(s)=>s.replace(/[a-zA-Z]/g,c=>String.fromCharCode((c<='Z'?90:122)>=(c=c.charCodeAt(0)+13)?c:c-26));console.log(rot13('Pbatenghyngvbaf! Lbh sbhaq gur frperg cebqhpg qngn. Svany pyhrf: PURPX_NQZVA_CNARY_2024'))"

# 5. Access secret endpoint
curl "http://localhost:3002/api/product_secret_endpoint" \
  -H "Authorization: Bearer <YOUR_ADMIN_TOKEN>"
```

**Good luck! May your code be performant and secure! 🚀**

