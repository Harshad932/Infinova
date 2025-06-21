//postgres connection
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config(); // Load environment variables from .env file

const pool = new Pool({
  connectionString: process.env.DB_CONNECTION_STRING,
  ssl: {
    rejectUnauthorized: false, // Required for Supabase
  },
});

// Function to connect to the database
const connectDB = async () => {
    try {
        await pool.connect();
        console.log('Connected to PostgreSQL database');
    } catch (error) {
        console.error('Database connection error:', error);
        process.exit(1); // Exit process with failure
    }
};

export { pool, connectDB };