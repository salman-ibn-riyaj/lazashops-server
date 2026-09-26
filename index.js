const express = require('express');
const dotenv = require('dotenv');
dotenv.config();
const cors = require('cors');
const { MongoClient } = require('mongodb');

const app = express();
app.use(cors());
app.use(express.json());

const port = process.env.PORT;

// MongoDB Connection
const client = new MongoClient(process.env.MONGODB_URI);
let db;


const connectDB = async () => {
  try {
    await client.connect();
    db = client.db('lazashops');
    const punjabiCollection = db.collection('punjabi');


    app.get('/api/punjabi', async (req, res) => {
      try {
        const punjabiData = await punjabiCollection.find().toArray();
        res.json(punjabiData);
      } catch (error) {
        console.error('Error fetching punjabi data:', error);
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });


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