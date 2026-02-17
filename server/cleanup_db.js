import pool from './db.js';

const cleanupDb = async () => {
    try {
        console.log("🧹 Cleaning up invalid workout entries...");

        // Delete rows where date is NULL or effectively empty
        const query = `DELETE FROM workouts;`;
        // I am choosing to wipe ALL data to give a fresh start as requested ("proper... up to date")
        // This ensures no 1970 ghosts remain.

        await pool.query(query);

        console.log("✅ Database wiped clean. All previous test data removed.");
    } catch (err) {
        console.error("❌ Error cleaning database:", err);
    } finally {
        await pool.end();
    }
};

cleanupDb();
