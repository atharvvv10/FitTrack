import pool from './db.js';

const cleanup = async () => {
    try {
        console.log("🧹 Cleaning up System Test data...");
        // Deleting by title is safe as this title was hardcoded for the test workout
        const res = await pool.query("DELETE FROM workouts WHERE title = 'System Test Workout'");
        console.log(`✅ Deleted ${res.rowCount} test entries.`);
    } catch (err) {
        console.error("❌ Error cleaning up:", err);
    } finally {
        await pool.end();
    }
};

cleanup();
