import pool from './db.js';

const createWorkoutsTable = `
CREATE TABLE IF NOT EXISTS workouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    duration INT,
    difficulty TEXT,
    exercises JSONB,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
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
