import pool from './db.js';

const createWorkoutsTable = `
CREATE TABLE IF NOT EXISTS workouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id STRING NOT NULL,
    title STRING NOT NULL,
    date TIMESTAMP WITH TIME ZONE DEFAULT current_timestamp(),
    duration INT,
    difficulty STRING,
    exercises JSONB,
    notes STRING,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT current_timestamp()
);
`;

const initDb = async () => {
    try {
        console.log("🚀 Initializing Database...");
        const client = await pool.connect();

        console.log("🛠️ Creating 'workouts' table...");
        await client.query(createWorkoutsTable);

        console.log("✅ Table 'workouts' created successfully!");
        client.release();
    } catch (err) {
        console.error("❌ Error initializing database:", err);
    } finally {
        await pool.end();
    }
};

initDb();
