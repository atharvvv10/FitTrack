import pg from 'pg';
import fetch from 'node-fetch';

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function test() {
    console.log("1. Testing DB Connection...");
    try {
        const client = await pool.connect();
        const res = await client.query('SELECT NOW()');
        console.log("✅ DB Connected:", res.rows[0]);
        client.release();
    } catch (e) {
        console.error("❌ DB Connection Failed:", e.message);
    }

    console.log("\n2. Testing API Fetch...");
    try {
        const res = await fetch('http://localhost:3000/api/exercises');
        if (res.ok) {
            const data = await res.json();
            console.log("✅ API fetch success. Count:", data.length);
        } else {
            console.error("❌ API Fetch Failed:", res.status, res.statusText);
        }
    } catch (e) {
        console.error("❌ API Fetch Error:", e.message);
    }

    process.exit();
}

test();
