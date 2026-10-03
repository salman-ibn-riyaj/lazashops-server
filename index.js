const express = require('express');
const dotenv = require('dotenv');
dotenv.config();
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const port = process.env.PORT || 5000;

// MongoDB Connection
const client = new MongoClient(process.env.MONGODB_URI);
let db;

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */
const PRODUCT_FIELDS = [
  'title', 'price', 'imageUrl', 'sizes', 'color', 'fabric', 'gsm',
  'description', 'category', 'stock', 'discount', 'tags', 'care',
];

// Only keep known fields so nobody can push random keys (or _id) into the collection.
const pickProduct = (body = {}) =>
  PRODUCT_FIELDS.reduce(
    (acc, key) => (body[key] !== undefined ? { ...acc, [key]: body[key] } : acc),
    {}
  );

const validateProduct = (p) => {
  const errors = [];
  if (typeof p.title !== 'string' || !p.title.trim()) errors.push('title is required');
  if (typeof p.price !== 'number' || !(p.price >= 0)) errors.push('price must be a number');
  if (typeof p.imageUrl !== 'string' || !p.imageUrl) errors.push('imageUrl is required');
  if (!Array.isArray(p.sizes) || p.sizes.length === 0) errors.push('at least one size is required');
  else if (p.sizes.some((s) => !s || !s.size || !s.length || !s.width))
    errors.push('every size needs size, length and width');
  if (typeof p.stock !== 'number' || !(p.stock >= 0)) errors.push('stock must be a number');
  if (typeof p.discount !== 'number' || p.discount < 0 || p.discount > 100)
    errors.push('discount must be between 0 and 100');
  if (typeof p.category !== 'string' || !p.category) errors.push('category is required');
  return errors;
};

/* -------------------------------------------------------------------------- */
/*  Admin guard: only your Next.js server knows ADMIN_API_SECRET               */
/* -------------------------------------------------------------------------- */
const requireAdmin = (req, res, next) => {
  const secret = process.env.ADMIN_API_SECRET;
  if (!secret || req.get('x-admin-secret') !== secret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

/* -------------------------------------------------------------------------- */
/*  One set of CRUD routes, registered for each collection                     */
/* -------------------------------------------------------------------------- */
const registerCrud = (route, collection) => {
  const base = `/api/${route}`;

  // READ all
  app.get(base, async (req, res) => {
    try {
      const items = await collection.find().sort({ _id: -1 }).toArray();
      res.json(items);
    } catch (error) {
      console.error(`Error fetching ${route} data:`, error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // READ one
  app.get(`${base}/:id`, async (req, res) => {
    try {
      const { id } = req.params;
      if (!ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid product id' });

      const item = await collection.findOne({ _id: new ObjectId(id) });
      if (!item) return res.status(404).json({ error: 'Product not found' });

      res.json(item);
    } catch (error) {
      console.error(`Error fetching ${route} item:`, error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // CREATE
  app.post(base, requireAdmin, async (req, res) => {
    try {
      const product = pickProduct(req.body);
      const errors = validateProduct(product);
      if (errors.length) return res.status(400).json({ error: 'Validation failed', errors });

      const result = await collection.insertOne({ ...product, createdAt: new Date() });
      res.status(201).json({ message: 'Product added', insertedId: result.insertedId });
    } catch (error) {
      console.error(`Error adding ${route} item:`, error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // UPDATE
  app.put(`${base}/:id`, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      if (!ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid product id' });

      const product = pickProduct(req.body);
      const errors = validateProduct(product);
      if (errors.length) return res.status(400).json({ error: 'Validation failed', errors });

      const result = await collection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { ...product, updatedAt: new Date() } }
      );
      if (result.matchedCount === 0) return res.status(404).json({ error: 'Product not found' });

      res.json({ message: 'Product updated' });
    } catch (error) {
      console.error(`Error updating ${route} item:`, error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // DELETE
  app.delete(`${base}/:id`, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      if (!ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid product id' });

      const result = await collection.deleteOne({ _id: new ObjectId(id) });
      if (result.deletedCount === 0) return res.status(404).json({ error: 'Product not found' });

      res.json({ message: 'Product deleted' });
    } catch (error) {
      console.error(`Error deleting ${route} item:`, error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });
};

const connectDB = async () => {
  try {
    await client.connect();
    db = client.db('lazashops');
    const punjabiCollection = db.collection('punjabi');
    const topCropCollection = db.collection('topCrop');

    registerCrud('punjabi', punjabiCollection);
    registerCrud('topCrop', topCropCollection);

    console.log('✅ MongoDB Atlas connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    process.exit(1);
  }
};

connectDB();

app.get('/', (req, res) => {
  res.send('Salam LazaShops');
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});