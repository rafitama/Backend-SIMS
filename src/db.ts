import mysql from "mysql2/promise";

const db = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 24567,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: {
    rejectUnauthorized: false, // Diperlukan untuk SSL Aiven
  },
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export default db;
