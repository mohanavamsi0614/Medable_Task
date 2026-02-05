const express = require('express');
const validator = require('validator');

const { authenticate } = require('../middleware/auth');

const router = express.Router();

// In-memory cart storage with TTL-based cleanup
const carts = new Map();

const productPrices = {
  '1': 100,
  '2': 200,
  '3': 150,
  '4': 75,
  '5': 300
};

const CART_TTL_MS = 24 * 60 * 60 * 1000;



function getCart(userId) {
  const existing = carts.get(userId);
  if (existing) {
    return existing;
  }
  const newCart = { items: [], total: 0, updatedAt: Date.now() };
  carts.set(userId, newCart);
  return newCart;
}


const cleanupTimer = setInterval(() => {
  const cutoff = Date.now() - CART_TTL_MS;
  for (const [userId, cart] of carts.entries()) {
    if (!cart.updatedAt || cart.updatedAt < cutoff) {
      carts.delete(userId);
    }
  }
}, CART_TTL_MS);
cleanupTimer.unref();

router.use(authenticate);

// Get cart
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const cart = getCart(userId);

    res.set({
      'X-Cart-Items': cart.items.length.toString()
    });

    return res.json({
      cart,
      metadata: {
        lastUpdated: new Date(cart.updatedAt).toISOString(),
        itemCount: cart.items.length
      }
    });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Add to cart
router.post('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId, quantity = 1 } = req.body || {};

    if (!productId || !validator.isInt(String(productId), { min: 1 })) {
      return res.status(400).json({ error: 'Valid product ID is required' });
    }

    const parsedQuantity = Number(quantity);
    if (!Number.isInteger(parsedQuantity) || parsedQuantity <= 0 || parsedQuantity > 100) {
      return res.status(400).json({ error: 'Quantity must be an integer between 1 and 100' });
    }

    const price = productPrices[productId];
    if (!price) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const cart = getCart(userId);
    const existingItemIndex = cart.items.findIndex(item => item.productId === productId);

    if (existingItemIndex >= 0) {
      cart.items[existingItemIndex].quantity += parsedQuantity;
      cart.items[existingItemIndex].updatedAt = new Date().toISOString();
    } else {
      cart.items.push({
        productId: String(productId),
        quantity: parsedQuantity,
        addedAt: new Date().toISOString()
      });
    }

    cart.total += price * parsedQuantity;
    cart.updatedAt = Date.now();

    return res.json({
      message: 'Item added to cart',
      cart,
      addedItem: { productId: String(productId), quantity: parsedQuantity }
    });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Update cart item
router.put('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId, quantity } = req.body || {};

    if (!productId || !validator.isInt(String(productId), { min: 1 })) {
      return res.status(400).json({ error: 'Valid product ID is required' });
    }

    const parsedQuantity = Number(quantity);
    if (!Number.isInteger(parsedQuantity) || parsedQuantity < 0 || parsedQuantity > 100) {
      return res.status(400).json({ error: 'Quantity must be an integer between 0 and 100' });
    }

    const price = productPrices[productId];
    if (!price) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const cart = getCart(userId);
    const itemIndex = cart.items.findIndex(item => item.productId === String(productId));

    if (itemIndex === -1) {
      return res.status(404).json({ error: 'Item not found in cart' });
    }

    const existingItem = cart.items[itemIndex];

    if (parsedQuantity === 0) {
      cart.items.splice(itemIndex, 1);
      cart.total -= price * existingItem.quantity;
    } else {
      const delta = parsedQuantity - existingItem.quantity;
      existingItem.quantity = parsedQuantity;
      existingItem.updatedAt = new Date().toISOString();
      cart.total += price * delta;
    }

    cart.updatedAt = Date.now();

    return res.json({
      message: 'Cart item updated',
      cart
    });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Remove from cart
router.delete('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId } = req.query || {};

    if (!productId || !validator.isInt(String(productId), { min: 1 })) {
      return res.status(400).json({ error: 'Valid product ID is required' });
    }

    const price = productPrices[productId];
    if (!price) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const cart = getCart(userId);
    const itemIndex = cart.items.findIndex(item => item.productId === String(productId));

    if (itemIndex === -1) {
      return res.status(404).json({ error: 'Item not found in cart' });
    }

    const removedItem = cart.items.splice(itemIndex, 1)[0];
    cart.total -= price * removedItem.quantity;
    cart.updatedAt = Date.now();

    return res.json({
      message: 'Item removed from cart',
      cart,
      removedItem
    });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
