import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const createTableQuery = `
CREATE TABLE IF NOT EXISTS diet_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id STRING NOT NULL,
    date DATE NOT NULL,
    meal_type STRING NOT NULL,
    food_name STRING,
    calories INT,
    protein INT,
    completed BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT current_timestamp(),
    UNIQUE (user_id, date, meal_type)
);
`;

async function initDB() {
    try {
        console.log("🛠️ Creating 'diet_logs' table...");
        await pool.query(createTableQuery);
        console.log("✅ Table 'diet_logs' created successfully!");
    } catch (err) {
        console.error("❌ Error creating table:", err);
    } finally {
        await pool.end();
    }
}

initDB();
