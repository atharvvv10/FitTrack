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

const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER;

// SSL Configuration
let sslConfig = { rejectUnauthorized: false }; // Default for cloud (Render/CockroachDB often needs this or CA string)

// Only try to load local cert if we are NOT in production AND the file exists
if (!isProduction && fs.existsSync(certPath)) {
    sslConfig = {
        rejectUnauthorized: true,
        ca: fs.readFileSync(certPath).toString(),
    };
}

const pool = new Pool({
    connectionString: dbUrl,
    connectionTimeoutMillis: 5000,
    ssl: sslConfig,
});

export default pool;
