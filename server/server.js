import express from 'express';
import dotenv from 'dotenv';

import cors from 'cors';
import adminRoutes from './routes/adminRoutes.js';
import userRoutes from './routes/userRoutes.js';

// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT =process.env.PORT || 3001;

const allowedOrigins = process.env.CORS_ORIGINS.split(',');

app.use(cors({
  origin: function (origin, callback) {
    // allow requests with no origin (like mobile apps or curl)
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

// Middleware to parse JSON bodies
app.use(express.json());    

app.use('/api/admin', adminRoutes);
app.use('/api/user', userRoutes);

try {
  app.listen(PORT, () => {
  console.log(`✅ Server is running on http://localhost:${PORT}`);
});

} catch (err) {
  console.error('❌ Server failed to start:', err.message);
}