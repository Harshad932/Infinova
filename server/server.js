import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import adminRoutes from './routes/adminRoutes.js';

// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT =process.env.PORT || 3001;

app.use(cors({
  origin: process.env.CORS_ORIGIN,
  credentials: true,
}));

// Middleware to parse JSON bodies
app.use(express.json());    

// app.get('/', (req, res) => {
//   res.send('Welcome to the Admin API'); 
// });

app.use('/api/admin', adminRoutes);

try {
  app.listen(PORT, () => {
  console.log(`✅ Server is running on http://localhost:${PORT}`);
});

} catch (err) {
  console.error('❌ Server failed to start:', err.message);
}