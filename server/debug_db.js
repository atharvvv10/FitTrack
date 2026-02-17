import pool from './db.js';

const checkDb = async () => {
    try {
        console.log("🕵️ Checking Database Content...");

        // Get all workouts
        const res = await pool.query('SELECT * FROM workouts');

        console.log(`📊 Total Rows: ${res.rowCount}`);
        if (res.rows.length > 0) {
            console.log("Recent Entries:");
            res.rows.forEach(row => {
                console.log(`- [${row.date}] (${typeof row.date}) Duration: ${row.duration} | Title: ${row.title}`);
            });
        } else {
            console.log("❌ Table is EMPTY.");
        }

    } catch (err) {
        console.error("❌ DB Error:", err);
    } finally {
        await pool.end();
    }
};

checkDb();
