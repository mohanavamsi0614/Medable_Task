const express = require('express');
const _ = require('lodash');
const validator = require('validator');

const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Large product dataset
let products = [];
let productById = new Map();
let trigramIndex = new Map();
let wordIndex = new Map();
let categoryIndex = new Map();
let generatedAt = 0;

const PRODUCT_COUNT = 1000;
const DATA_REFRESH_MS = 60 * 60 * 1000;
const CACHE_TTL_MS = 30 * 1000;
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const ALLOWED_SORT_FIELDS = new Set(['name', 'price', 'category', 'brand', 'stock', 'rating', 'createdAt']);

const responseCache = new Map();

function normalizeText(value) {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function getWords(text) {
  return text.split(/[^a-z0-9]+/i).filter(word => word.length > 1);
}

function getTrigrams(text) {
  const trigrams = [];
  if (text.length < 3) {
    return trigrams;
  }
  for (let i = 0; i <= text.length - 3; i++) {
    trigrams.push(text.slice(i, i + 3));
  }
  return trigrams;
}

function addToIndex(indexMap, key, productId) {
  if (!indexMap.has(key)) {
    indexMap.set(key, new Set());
  }
  indexMap.get(key).add(productId);
}

function buildIndexes(productList) {
  productById = new Map();
  trigramIndex = new Map();
  wordIndex = new Map();
  categoryIndex = new Map();

  productList.forEach(product => {
    const searchableText = normalizeText(`${product.name} ${product.description}`);
    product.searchableText = searchableText;

    productById.set(product.id, product);
    addToIndex(categoryIndex, product.category, product.id);

    getWords(searchableText).forEach(word => addToIndex(wordIndex, word, product.id));
    getTrigrams(searchableText).forEach(trigram => addToIndex(trigramIndex, trigram, product.id));
  });

  responseCache.clear();
}

function sanitizeText(value) {
  return validator.escape(String(value || '').trim());
}

function getCacheKey(params) {
  return JSON.stringify({ ...params });
}

function getCachedResponse(cacheKey) {
  const cached = responseCache.get(cacheKey);
  if (!cached) {
    return null;
  }
  if (cached.expiresAt < Date.now()) {
    responseCache.delete(cacheKey);
    return null;
  }
  return cached;
}

function setCachedResponse(cacheKey, payload, headers) {
  responseCache.set(cacheKey, {
    payload,
    headers,
    expiresAt: Date.now() + CACHE_TTL_MS
  });
}

function toPublicProduct(product) {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    price: product.price,
    category: product.category,
    brand: product.brand,
    stock: product.stock,
    rating: product.rating,
    tags: product.tags,
    createdAt: product.createdAt
  };
}

function validateProductInput(productData, { partial = false } = {}) {
  const errors = [];

  if (!partial || productData.name !== undefined) {
    if (!productData.name || !validator.isLength(String(productData.name), { min: 2, max: 120 })) {
      errors.push('Name must be between 2 and 120 characters.');
    }
  }

  if (!partial || productData.description !== undefined) {
    if (productData.description && !validator.isLength(String(productData.description), { min: 0, max: 500 })) {
      errors.push('Description must be 500 characters or less.');
    }
  }

  if (!partial || productData.price !== undefined) {
    const priceValue = Number(productData.price);
    if (!Number.isFinite(priceValue) || priceValue <= 0) {
      errors.push('Price must be a positive number.');
    }
  }

  if (!partial || productData.category !== undefined) {
    if (!productData.category || !validator.isLength(String(productData.category), { min: 2, max: 60 })) {
      errors.push('Category must be between 2 and 60 characters.');
    }
  }

  if (!partial || productData.brand !== undefined) {
    if (productData.brand && !validator.isLength(String(productData.brand), { min: 2, max: 60 })) {
      errors.push('Brand must be between 2 and 60 characters.');
    }
  }

  if (!partial || productData.stock !== undefined) {
    const stockValue = Number(productData.stock || 0);
    if (!Number.isInteger(stockValue) || stockValue < 0) {
      errors.push('Stock must be a non-negative integer.');
    }
  }

  if (productData.tags !== undefined && !Array.isArray(productData.tags)) {
    errors.push('Tags must be an array of strings.');
  }

  return errors;
}

function generateProducts() {
  const categories = ['Electronics', 'Clothing', 'Books', 'Home', 'Sports', 'Beauty'];
  const brands = ['BrandA', 'BrandB', 'BrandC', 'BrandD', 'BrandE'];

  const newProducts = [];
  for (let i = 1; i <= PRODUCT_COUNT; i++) {
    newProducts.push({
      id: i.toString(),
      name: `Product ${i}`,
      description: `This is product number ${i} with amazing features`,
      price: Math.floor(Math.random() * 1000) + 10,
      category: categories[Math.floor(Math.random() * categories.length)],
      brand: brands[Math.floor(Math.random() * brands.length)],
      stock: Math.floor(Math.random() * 100),
      rating: (Math.random() * 5).toFixed(1),
      tags: [`tag${i}`, `feature${i % 10}`],
      createdAt: new Date().toISOString(),
      // BUG: Sensitive internal data exposed
      costPrice: Math.floor(Math.random() * 500) + 5,
      supplier: `Supplier ${i % 20}`,
      internalNotes: `Internal notes for product ${i}`,
      adminOnly: Math.random() > 0.9
    });
  }

  products = newProducts;
  buildIndexes(products);
  generatedAt = Date.now();
}

function ensureProductsFresh() {
  if (products.length === 0) {
    generateProducts();
  }
}

// Initialize products once on startup
generateProducts();

// Get all products
router.get('/', async (req, res) => {
  try {
    ensureProductsFresh();
    const rawPage = Number(req.query.page || 1);
    const rawLimit = Number(req.query.limit || DEFAULT_LIMIT);
    const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
    const limit = Number.isInteger(rawLimit) ? Math.min(Math.max(rawLimit, 1), MAX_LIMIT) : DEFAULT_LIMIT;
    const search = req.query.search ? String(req.query.search) : '';
    const category = req.query.category ? String(req.query.category) : '';
    const sortBy = ALLOWED_SORT_FIELDS.has(req.query.sortBy) ? req.query.sortBy : 'name';
    const sortOrder = req.query.sortOrder === 'desc' ? 'desc' : 'asc';

    const cacheKey = getCacheKey({ page, limit, search, category, sortBy, sortOrder });
    const cached = getCachedResponse(cacheKey);
    if (cached) {
      res.set(cached.headers);
      return res.json(cached.payload);
    }

    let filteredProducts = products;
    let candidateIds = null;
    const normalizedQuery = search ? normalizeText(search) : '';

    if (normalizedQuery) {
      const queryTrigrams = getTrigrams(normalizedQuery);
      const queryWords = getWords(normalizedQuery);

      if (queryTrigrams.length > 0) {
        queryTrigrams.forEach(trigram => {
          const trigramMatches = trigramIndex.get(trigram) || new Set();
          if (candidateIds === null) {
            candidateIds = new Set(trigramMatches);
          } else {
            candidateIds = new Set([...candidateIds].filter(id => trigramMatches.has(id)));
          }
        });
      } else if (queryWords.length > 0) {
        queryWords.forEach(word => {
          const wordMatches = wordIndex.get(word) || new Set();
          if (candidateIds === null) {
            candidateIds = new Set(wordMatches);
          } else {
            candidateIds = new Set([...candidateIds].filter(id => wordMatches.has(id)));
          }
        });
      }

      if (candidateIds && candidateIds.size > 0) {
        filteredProducts = [...candidateIds]
          .map(id => productById.get(id))
          .filter(Boolean)
          .filter(p => p.searchableText.includes(normalizedQuery));
      } else {
        filteredProducts = [];
      }
    }

    if (category) {
      const categoryMatches = categoryIndex.get(category) || new Set();
      if (candidateIds === null) {
        filteredProducts = [...categoryMatches]
          .map(id => productById.get(id))
          .filter(Boolean);
      } else {
        filteredProducts = filteredProducts.filter(p => categoryMatches.has(p.id));
      }
    }

    if (filteredProducts.length > 1) {
      filteredProducts = _.orderBy(filteredProducts, [sortBy], [sortOrder]);
    }

    const startIndex = (page - 1) * limit;
    const paginatedProducts = filteredProducts.slice(startIndex, startIndex + limit);
    const totalPages=Math.ceil(filteredProducts.length / limit)
    const responsePayload = {
      products: paginatedProducts.map(toPublicProduct),
      pagination: {
        currentPage: page,
        totalPages: totalPages,
        totalItems: filteredProducts.length,
        itemsPerPage: limit,
        nextPage:page >= totalPages ?  null : process.env.BACKEND_URL + `/api/products?page=${page + 1}&limit=${limit}&search=${encodeURIComponent(search)}&category=${encodeURIComponent(category)}&sortBy=${sortBy}&sortOrder=${sortOrder}`,
        prevPage: page > 1 ? process.env.BACKEND_URL + `/api/products?page=${page - 1}&limit=${limit}&search=${encodeURIComponent(search)}&category=${encodeURIComponent(category)}&sortBy=${sortBy}&sortOrder=${sortOrder}` : null
      }
    };

    const headers = {
      'X-Total-Count': filteredProducts.length.toString()
    };

    setCachedResponse(cacheKey, responsePayload, headers);
    res.set(headers);

    return res.json(responsePayload);
  } catch (error) {
    return res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// Get product categories
router.get('/categories/list', async (req, res) => {
  try {
    ensureProductsFresh();
    const categories = [...categoryIndex.keys()].sort();
    return res.json({ categories, total: categories.length });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get product by ID
router.get('/:productId', async (req, res) => {
  try {
    ensureProductsFresh();
    const { productId } = req.params;

    if (!validator.isInt(productId, { min: 1 })) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }

    const product = productById.get(productId);

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    return res.json(toPublicProduct(product));
  } catch (error) {
    return res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// Create product
router.post('/', requireAdmin, async (req, res) => {
  try {
    ensureProductsFresh();
    const productData = req.body || {};
    const errors = validateProductInput(productData);

    if (errors.length > 0) {
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }

    const newId = (Math.max(...products.map(p => parseInt(p.id, 10))) + 1).toString();

    const newProduct = {
      id: newId,
      name: sanitizeText(productData.name),
      description: sanitizeText(productData.description || ''),
      price: Number(productData.price),
      category: sanitizeText(productData.category),
      brand: sanitizeText(productData.brand || ''),
      stock: Number(productData.stock || 0),
      rating: 0,
      tags: Array.isArray(productData.tags) ? productData.tags.map(sanitizeText) : [],
      createdAt: new Date().toISOString(),
      costPrice: Number(productData.price) * 0.7,
      supplier: 'Unknown',
      internalNotes: '',
      adminOnly: false
    };

    products.push(newProduct);
    buildIndexes(products);

    return res.status(201).json({
      message: 'Product created successfully',
      product: toPublicProduct(newProduct)
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// Update product
router.put('/:productId', requireAdmin, async (req, res) => {
  try {
    ensureProductsFresh();
    const { productId } = req.params;
    const updateData = req.body || {};

    if (!validator.isInt(productId, { min: 1 })) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }

    const errors = validateProductInput(updateData, { partial: true });
    if (errors.length > 0) {
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }

    const productIndex = products.findIndex(p => p.id === productId);

    if (productIndex === -1) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const updatedProduct = { ...products[productIndex] };
    if (updateData.name !== undefined) updatedProduct.name = sanitizeText(updateData.name);
    if (updateData.description !== undefined) updatedProduct.description = sanitizeText(updateData.description || '');
    if (updateData.price !== undefined) updatedProduct.price = Number(updateData.price);
    if (updateData.category !== undefined) updatedProduct.category = sanitizeText(updateData.category);
    if (updateData.brand !== undefined) updatedProduct.brand = sanitizeText(updateData.brand || '');
    if (updateData.stock !== undefined) updatedProduct.stock = Number(updateData.stock || 0);
    if (updateData.tags !== undefined) {
      updatedProduct.tags = Array.isArray(updateData.tags) ? updateData.tags.map(sanitizeText) : [];
    }

    products[productIndex] = updatedProduct;
    buildIndexes(products);

    return res.json({
      message: 'Product updated successfully',
      product: toPublicProduct(updatedProduct)
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// Delete product
router.delete('/:productId', requireAdmin, async (req, res) => {
  try {
    ensureProductsFresh();
    const { productId } = req.params;

    if (!validator.isInt(productId, { min: 1 })) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }

    const productIndex = products.findIndex(p => p.id === productId);

    if (productIndex === -1) {
      return res.status(404).json({ error: 'Product not found' });
    }

    products.splice(productIndex, 1);
    buildIndexes(products);

    return res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    return res.status(500).json({
      error: 'Internal server error'
    });
  }
});

module.exports = router;
