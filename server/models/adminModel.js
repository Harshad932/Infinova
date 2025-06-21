import {pool}  from "../config/db.js";

export  const findAdminByEmail = async (email) => {
  const query = "SELECT * FROM admins WHERE email = $1";
  const values = [email];
  
  try {
    const result = await pool.query(query, values);
    return result.rows[0]; // Return the first matching admin
  } catch (error) {
    console.error("Error finding admin by email:", error);
    throw error; // Propagate the error
  }
}