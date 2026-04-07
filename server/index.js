import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pool from './db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { generateAIWorkout, generateAIDiet } from './ai.js';

// ═══════════════════════════════════════════════════════
// Auto-seed food_items table on startup (idempotent)
// ═══════════════════════════════════════════════════════
async function seedFoodDatabase() {
    try {
        // Create table if not exists
        await pool.query(`
            CREATE TABLE IF NOT EXISTS food_items (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name TEXT NOT NULL,
                calories INT NOT NULL,
                protein_g FLOAT, carbs_g FLOAT, fat_g FLOAT, fibre_g FLOAT,
                food_group TEXT, diet_type TEXT, source TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Check if already populated
        const countResult = await pool.query('SELECT COUNT(*) FROM food_items');
        const count = parseInt(countResult.rows[0].count);

        if (count >= 4400) {
            console.log(`Food DB ready: ${count} foods loaded`);
            return;
        }

        console.log(`Food DB has ${count} records. Seeding new dataset...`);
        const csvPath = path.join(__dirname, '../food-data/Indian_Diet_3000.csv');
        if (!fs.existsSync(csvPath)) {
            console.warn('food-data/Indian_Diet_3000.csv not found — skipping food seeding');
            return;
        }

        console.log('Seeding food database from CSV...');
        await pool.query('DELETE FROM food_items WHERE 1=1');
        const lines = fs.readFileSync(csvPath, 'utf-8').split('\n').filter(l => l.trim()).slice(1);

        let inserted = 0;
        const BATCH = 50;
        for (let i = 0; i < lines.length; i += BATCH) {
            const batch = lines.slice(i, i + BATCH);
            const params = [], values = [];
            let p = 1;
            for (const line of batch) {
                const cols = line.split(',');
                if (cols.length < 10) continue;
                const name = cols[3].replace(/"/g, '').trim();
                const cal = parseInt(cols[5]);
                const pro = parseFloat(cols[6]);
                const carbs = parseFloat(cols[7]);
                const fat = parseFloat(cols[8]);
                const fib = parseFloat(cols[9]);
                const food_group = cols[2];
                const diet_type = cols[1];
                const source = cols[4].replace(/"/g, '').trim();

                params.push(`($${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++})`);
                values.push(name, cal, pro, carbs, fat, fib, food_group, diet_type, source);
            }
            if (params.length) {
                await pool.query(
                    `INSERT INTO food_items (name,calories,protein_g,carbs_g,fat_g,fibre_g,food_group,diet_type,source) VALUES ${params.join(',')}`,
                    values
                );
                inserted += params.length;
            }
        }
        console.log(`Food DB seeded: ${inserted} Indian foods imported`);
    } catch (err) {
        console.error('Food DB seeding error:', err.message);
    }
}

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
    console.log(`[REQUEST] ${req.method} ${req.path}`);
    next();
});

// ═══════════════════════════════════════════════════════
// 🧠 AI ENDPOINTS
// ═══════════════════════════════════════════════════════

// API: Generate AI Workout
app.post('/api/generate-ai-workout', async (req, res) => {
    try {
        const userProfile = req.body;
        console.log("🤖 Generating AI Workout for:", userProfile.goal);
        const workoutPlan = await generateAIWorkout(userProfile);
        res.json(workoutPlan);
    } catch (err) {
        console.error("❌ AI Generation Failed:", err);
        res.status(500).json({ error: "Failed to generate AI workout" });
    }
});

// API: Generate AI Diet
app.post('/api/generate-ai-diet', async (req, res) => {
    try {
        const userProfile = req.body;
        console.log("🥗 Generating AI Diet for:", userProfile.goal);
        const dietPlan = await generateAIDiet(userProfile);
        res.json(dietPlan);
    } catch (err) {
        console.error("❌ AI Diet Generation Failed:", err);
        res.status(500).json({ error: "Failed to generate AI diet" });
    }
});

// ═══════════════════════════════════════════════════════
// 🏋️ WORKOUT ENDPOINTS
// ═══════════════════════════════════════════════════════

// API: Get All Exercises
app.get('/api/exercises', async (req, res) => {
    try {
        console.log("📥 Fetching full exercise library...");
        const result = await pool.query('SELECT * FROM exercises');
        console.log(`✅ Sent ${result.rows.length} exercises to client.`);
        res.json(result.rows);
    } catch (err) {
        console.error("❌ Error fetching exercises:", err);
        res.status(500).json({ error: "Failed to fetch exercises" });
    }
});

// API: Save Workout
app.post('/api/workouts', async (req, res) => {
    const { userId, title, date, duration, difficulty, exercises, notes } = req.body;
    if (!userId || !title) return res.status(400).json({ error: "Missing required fields" });
    try {
        const query = `
            INSERT INTO workouts (user_id, title, date, duration, difficulty, exercises, notes)
            VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *;
        `;
        const result = await pool.query(query, [userId, title, date, duration, difficulty, JSON.stringify(exercises), notes]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: "Failed to save workout" });
    }
});

// API: Get Workouts
app.get('/api/workouts/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const result = await pool.query(`SELECT * FROM workouts WHERE user_id = $1 ORDER BY date DESC`, [userId]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch workouts" });
    }
});

// ═══════════════════════════════════════════════════════
// 🥗 DIET ENDPOINTS
// ═══════════════════════════════════════════════════════

// API: Log Diet/Meal
app.post('/api/diet/log', async (req, res) => {
    const { userId, date, mealType, foodName, calories, protein, completed } = req.body;
    try {
        const query = `
            INSERT INTO diet_logs (user_id, date, meal_type, food_name, calories, protein, completed)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (user_id, date, meal_type)
            DO UPDATE SET food_name = EXCLUDED.food_name, calories = EXCLUDED.calories,
                          protein = EXCLUDED.protein, completed = EXCLUDED.completed;
        `;
        await pool.query(query, [userId, date, mealType, foodName, calories, protein, completed]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Failed to log diet" });
    }
});

// API: Get Diet Logs
app.get('/api/diet/logs', async (req, res) => {
    const { userId, date } = req.query;
    if (!userId) return res.status(400).json({ error: "Missing userId" });
    try {
        const query = `SELECT * FROM diet_logs WHERE user_id = $1 ${date ? 'AND date = $2' : ''} ORDER BY date DESC`;
        const params = date ? [userId, date] : [userId];
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch diet logs" });
    }
});

// ═══════════════════════════════════════════════════════
// 🚀 SERVE FRONTEND (PRODUCTION)
// ═══════════════════════════════════════════════════════

// Serve Static Assets (Exercise Images)
app.use('/exercises', express.static(path.join(__dirname, '../exercise-data/exercises')));

// Serve 'dist' folder generated by Vite build
const distPath = path.resolve(__dirname, '../dist');
app.use(express.static(distPath));

// Handle Client-Side Routing (SPA Catch-all)
app.get(/^(?!\/api\/|\/exercises\/).*/, (req, res) => {
    const indexPath = path.join(distPath, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.send("🚀 API is live. (Frontend build not found - please run 'npm run build')");
    }
});

// ═══════════════════════════════════════════════════════
// 🚀 SERVER STARTUP
// ══════════════════════════════════════════════════════

const startServer = async () => {
    try {
        await seedFoodDatabase();
        app.listen(port, () => {
            console.log(`🚀 Server running at http://localhost:${port}`);
            console.log(`📂 Serving frontend from: ${distPath}`);
        });
    } catch (err) {
        console.error("❌ Failed to start server:", err);
        process.exit(1);
    }
};

startServer();
