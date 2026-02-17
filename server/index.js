import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pool from './db.js';

dotenv.config();

import { generateAIWorkout, generateAIDiet } from './ai.js';

const app = express();
const port = process.env.PORT || 3000;

// ... (Middleware)



import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ... existing code ...

app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
    console.log(`[REQUEST] ${req.method} ${req.path}`);
    next();
});

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

// Serve Static Assets (Exercise Images)
// Folder: ../exercise-data/exercises
app.use('/exercises', express.static(path.join(__dirname, '../exercise-data/exercises')));

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

    if (!userId || !title) {
        return res.status(400).json({ error: "Missing required fields: userId, title" });
    }

    try {
        const query = `
            INSERT INTO workouts (user_id, title, date, duration, difficulty, exercises, notes)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *;
        `;
        const values = [userId, title, date, duration, difficulty, JSON.stringify(exercises), notes];

        const result = await pool.query(query, values);
        console.log(`✅ Workout saved for user ${userId}: ${title}`);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error("❌ Error saving workout:", err);
        res.status(500).json({ error: "Failed to save workout" });
    }
});

// API: Get Workouts (for Progress view later)
app.get('/api/workouts/:userId', async (req, res) => {
    const { userId } = req.params;
    console.log(`📥 Fetching workouts for: ${userId}`);
    try {
        const query = `SELECT * FROM workouts WHERE user_id = $1 ORDER BY date DESC`;
        const result = await pool.query(query, [userId]);
        res.json(result.rows);
    } catch (err) {
        console.error("❌ Error fetching workouts:", err);
        res.status(500).json({ error: "Failed to fetch workouts" });
    }
});

// API: Log Diet/Meal
app.post('/api/diet/log', async (req, res) => {
    const { userId, date, mealType, foodName, calories, protein, completed } = req.body;

    try {
        // Upsert logic (insert or update if exists)
        const query = `
            INSERT INTO diet_logs (user_id, date, meal_type, food_name, calories, protein, completed)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (user_id, date, meal_type)
            DO UPDATE SET 
                food_name = EXCLUDED.food_name,
                calories = EXCLUDED.calories,
                protein = EXCLUDED.protein,
                completed = EXCLUDED.completed,
                created_at = current_timestamp();
        `;
        const values = [userId, date, mealType, foodName, calories, protein, completed];

        await pool.query(query, values);
        console.log(`✅ Diet logged for ${userId}: ${mealType} on ${date}`);
        res.json({ success: true, message: "Diet logged" });
    } catch (err) {
        console.error("❌ Error logging diet:", err);
        res.status(500).json({ error: "Failed to log diet" });
    }
});

// API: Get Diet Logs
app.get('/api/diet/logs', async (req, res) => {
    const { userId, date } = req.query; // Fetch from query params

    if (!userId) {
        return res.status(400).json({ error: "Missing userId" });
    }

    try {
        let query = `SELECT * FROM diet_logs WHERE user_id = $1`;
        const params = [userId];

        if (date) {
            query += ` AND date = $2`;
            params.push(date);
        }

        query += ` ORDER BY date DESC, created_at ASC`;

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error("❌ Error fetching diet logs:", err);
        res.status(500).json({ error: "Failed to fetch diet logs" });
    }
});

// ... (Diet APIs skipped for brevity in replace block, keep them)

// Serve Static Assets (Exercise Images) - Keep this
// Folder: ../exercise-data/exercises
app.use('/exercises', express.static(path.join(__dirname, '../exercise-data/exercises')));


// ==========================================
// 🚀 SERVE FRONTEND (PRODUCTION)
// ==========================================
// Serve the 'dist' folder generated by Vite build
const distPath = path.resolve(__dirname, '../dist');
app.use(express.static(distPath));

// Handle Client-Side Routing (SPA Catch-all)
// Must be AFTER all API routes
// Handle Client-Side Routing (SPA Catch-all)
// Must be AFTER all API routes
// Fix for Express 5: Use /(.*) or regex instead of * to avoid "Missing parameter name" error
app.get(/(.*)/, (req, res) => {
    // If request asks for a file that exists, serve it (handled by static above mostly)
    // Otherwise serve index.html
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: "API Endpoint Not Found" });
    }
    res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
