import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const { Pool } = pg;
const certPath = 'C:\\Users\\Atharv C\\AppData\\Roaming\\postgresql\\root.crt';

// Clean the URL to remove sslmode param which might conflict
const dbUrl = process.env.DATABASE_URL ? process.env.DATABASE_URL.split('?')[0] : '';

if (!dbUrl) {
    console.error("❌ DATABASE_URL is missing from .env");
    process.exit(1);
}

const pool = new Pool({
    connectionString: dbUrl,
    connectionTimeoutMillis: 5000,
    ssl: {
        rejectUnauthorized: true,
        ca: fs.readFileSync(certPath).toString(),
    },
});

export default pool;
