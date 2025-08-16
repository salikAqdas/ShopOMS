require('dotenv').config(); // Load environment variables first
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const path = require('path');
const cors = require('cors');
const User = require('./backend/models/User');
const Product = require('./backend/models/Product');
const Order = require('./backend/models/Order');
const authenticate = require('./middleware/auth'); 
// const authenticate = require('./backend/middleware/auth');

// No need for `const { log } = require('console');`

// --- DB Connection ---
// Always await db connection before starting Express or using models
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB connected successfully');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1); // Exit on connection failure
  }
}

// --- Express Setup ---
const app = express();
app.use(express.json()); // Parse JSON bodies
app.use(express.static(path.join(__dirname, 'public'))); // Serve static files
app.use(cors()); // This allows all origins for development
app.use(express.static('public'));
// ------------------------------------------
// ROUTES
// ------------------------------------------

// Login endpoint
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  try {
    // Optional: Force lowercase for case-insensitive login
    const user = await User.findOne({ username: username.toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    // Compare password with hash
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    // Ensure name and role exist (if not required in schema)
    const payload = {
      id: user._id,
      name: user.name || username,
      role: user.role || 'user'
    };

    // Check JWT secret is set
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET is missing from environment');
    }

    // Create JWT (expires in 24 hours)
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '24h' });
    res.json({ success: true, token, ...payload });
  } catch (error) {
    console.error('Login error:', error.message);
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

app.get('/api/orders', async (req, res) => {
  try {
    const orders = await Order.find().populate('items.product'); // Pre-populate product details
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch orders.' });
  }
});

// Middleware to validate (optional)
function validateOrder(req, res, next) {
  const { customerName, items, subtotal, tax, total } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Order must have at least one item.' });
  }
  if (typeof subtotal !== 'number' || typeof tax !== 'number' || typeof total !== 'number') {
    return res.status(400).json({ error: 'Subtotal, tax, and total must be numbers.' });
  }
  next();
}

// --- Product Product Routes ---
// See below for auth.js example

// Fetch all products (protected)
app.get('/api/products', authenticate, async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch products.' });
  }
});

// Create new product (protected)
app.post('/api/products', authenticate, async (req, res) => {
  const { name, category, price } = req.body;
  if (!name || !category || isNaN(price)) {
    return res.status(400).json({ error: 'Name, category, and price are required.' });
  }
  try {
    const product = new Product({ name, category, price });
    await product.save();
    res.json({ success: true, product });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save product.' });
  }
});

// Update product (protected)
app.put('/api/products/:id', authenticate, async (req, res) => {
  try {
    // Optionally, validate fields
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!product) return res.status(404).json({ error: 'Product not found.' });
    res.json({ success: true, product });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update product.' });
  }
});

// Delete product (protected)
app.delete('/api/products/:id', authenticate, async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found.' });
    res.json({ success: true, product });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete product.' });
  }
});


app.post('/api/orders', validateOrder, async (req, res) => {
  try {
    const order = new Order(req.body);
    await order.save();
    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save order.' });
  }
});

// server.js
app.get('/api/reports/today', async (req, res) => {
  try {
    // Get start and end of today (UTC)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nextDay = new Date(today);
    nextDay.setDate(nextDay.getDate() + 1);
    
    // Find orders created today
    const orders = await Order.find({
      createdAt: { $gte: today, $lt: nextDay }
    });
    // Sum all orders' totals
    const total = orders.reduce((sum, order) => sum + order.total, 0);
    res.json({ total });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch today\'s sales.' });
  }
});

app.get('/api/reports/month', async (req, res) => {
  try {
    // Get start and end of current month (UTC)
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    
    // Find orders created this month
    const orders = await Order.find({
      createdAt: { $gte: firstDay, $lt: nextMonth }
    });
    // Sum all orders' totals
    const total = orders.reduce((sum, order) => sum + order.total, 0);
    res.json({ total });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch this month\'s sales.' });
  }
});

app.get('/api/reports/top-products', async (req, res) => {
  try {
    // Get all orders
    const orders = await Order.find().populate('items.product');
    // Map to count total quantity sold per product
    const productSales = {};
    orders.forEach(order => {
      order.items.forEach(item => {
        const productId = item.product._id;
        productSales[productId] = (productSales[productId] || 0) + item.quantity;
      });
    });
    // Get products for names
    const products = await Product.find();
    // Format top products
    const topProducts = products.map(product => ({
      id: product._id,
      name: product.name,
      sales: productSales[product._id] || 0
    })).sort((a, b) => b.sales - a.sales); // Top first
    res.json(topProducts);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch top products.' });
  }
});

// Protected API example
app.get('/api/protected', (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ success: false, message: 'No token provided.' });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ success: false, message: 'Invalid or expired token.' });
    res.json({ success: true, message: 'Protected data accessed!', user });
  });
});

// Serve frontend (SPA/order pages)
app.get('/*splat', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ------------------------------------------
// START SERVER
// ------------------------------------------
async function start() {
  await connectDB(); // Must finish before routes are used

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
}

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  process.exit(1);
});

start();
