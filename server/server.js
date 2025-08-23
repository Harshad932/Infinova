import express from 'express';
import dotenv from 'dotenv';

import rateLimit from "express-rate-limit";
import helmet from "helmet";

import cors from 'cors';
import adminRoutes from './routes/adminRoutes.js';
import userRoutes from './routes/userRoutes.js';

// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT =process.env.PORT || 3001;

const allowedOrigins = process.env.CORS_ORIGINS.split(',');

app.use(
  cors({
    origin: function (origin, callback) {
      // allow requests with no origin (like curl, Postman)
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true, // allow cookies/authorization headers
  })
);

// Middleware to parse JSON bodies
app.use(express.json());   


app.use(helmet());

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // block after 5 failed attempts
  message: "Too many login attempts, please try again later.",
  standardHeaders: true, // return rate limit info in headers
  legacyHeaders: false,
});

app.use("/api/user/login", loginLimiter);

// General API limiter (optional)
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // max 100 requests per minute per IP
  message: "Too many requests, slow down.",
});

app.use("/api/", apiLimiter);

app.use('/api/admin', adminRoutes);
app.use('/api/user', userRoutes);

try {
  app.listen(PORT, () => {
  console.log(`✅ Server is running on http://localhost:${PORT}`);
});

} catch (err) {
  console.error('❌ Server failed to start:', err.message);
}