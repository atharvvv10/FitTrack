
import { GoogleGenerativeAI } from "@google/generative-ai";
import Groq from "groq-sdk";
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY); // Legacy
// const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

// ===== WORKOUT AI (Groq API) ============
const groqWorkout = new Groq({ apiKey: process.env.GROQ_WORKOUT_API_KEY });

// Initialize DB Pool
const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

export const generateAIWorkout = async (userProfile) => {
    try {
        let equipmentList = userProfile.equipment || [];
        if (equipmentList.length === 0) equipmentList = ['body only'];

        const dbEquipment = equipmentList.map(e => e === 'bodyweight' ? 'body only' : e);
        if (!dbEquipment.includes('body only')) dbEquipment.push('body only');

        const query = `
            SELECT id, name, equipment, primary_muscles, level, mechanic 
            FROM exercises 
            WHERE equipment = ANY($1) 
            OR equipment IS NULL
        `;
        const exerciseResult = await pool.query(query, [dbEquipment]);

        let availableExercises = exerciseResult.rows.map(ex => ({
            id: ex.id,
            name: ex.name,
            eq: ex.equipment,
            mus: ex.primary_muscles,
            lvl: ex.level
        }));

        if (availableExercises.length > 200) {
            availableExercises = availableExercises.sort(() => 0.5 - Math.random()).slice(0, 200);
        }

        console.log(`Sending ${availableExercises.length} exercises to Gemini...`);

        const prompt = `
            ACT AS AN INTELLIGENT SELECTOR. 
            Select exercises from the provided list to build a ${userProfile.time || 45}-min ${userProfile.goal} workout for a ${userProfile.level} user.
            Target Focus: ${userProfile.focus || 'Full Body'}.
            Injuries: ${userProfile.injuries || 'None'}.
            
            AVAILABLE EXERCISES (JSON):
            ${JSON.stringify(availableExercises)}
            
            TASK:
            Return a JSON plan using EXCLUSIVELY the exercises above.
            CRITICAL RULES:
            1. DO NOT INVENT EXERCISES. Use the exact "name" from the list.
            2. VARY THE SELECTION. Do not just pick the first few. 
            3. Ensure the selection fits the Target Focus.
            Format:
            {
                "title": "Creative Workout Name (e.g. 'Spartan Chest', 'Leg Obliterator')",
                "difficulty": "Beginner | Intermediate | Advanced",
                "totalDuration": "45 min",
                "warmup": [{"name": "Exact Name", "sets": "2", "reps": "12", "notes": "..."}],
                "exercises": [{"name": "Exact Name", "sets": "3", "reps": "10", "notes": "..."}],
                "cooldown": [{"name": "Exact Name", "sets": "1", "reps": "30s", "notes": "..."}]
            }
        `;

        try {
            console.log("🏋️ Sending Workout Request to Groq (Llama3-70b)...");
            const completion = await groqWorkout.chat.completions.create({
                messages: [
                    { role: "system", content: "You are an elite fitness coach. You output ONLY valid JSON." },
                    { role: "user", content: prompt }
                ],
                model: "llama-3.3-70b-versatile",
                temperature: 0.7, // Higher temp for variety
                max_tokens: 4000,
                response_format: { type: "json_object" }
            });

            const jsonString = completion.choices[0]?.message?.content || "{}";
            console.log("🏋️ Groq Workout Response Received");
            return JSON.parse(jsonString);
        } catch (apiError) {
            console.warn("Groq API Error (Workout):", apiError.message);
            throw apiError;
        }

    } catch (error) {
        console.error("AI Generation Error Details:", error);
        if (error.response) {
            console.error("Gemini Response Error:", await error.response.text());
        }
        throw new Error("Failed to generate workout with AI. Please try again.");
    }
};

// =============================================
// ===== DIET AI (Separate API Key) ============
// =============================================
// ===== DIET AI (Groq API) ============
const groqDiet = new Groq({ apiKey: process.env.GROQ_DIET_API_KEY });
// const dietGenAI = new GoogleGenerativeAI(process.env.GEMINI_DIET_API_KEY); // Legacy


// ===== CALCULATE PROPER CALORIE TARGET FROM USER PROFILE =====
function calculateTargets(profile) {
    const weight = parseFloat(profile.weight) || 70;
    const height = parseFloat(profile.height) || 170;
    const age = parseInt(profile.age) || 25;
    const gender = (profile.gender || 'Male').toLowerCase();
    const goal = (profile.goal || 'General Fitness').toLowerCase();
    const level = (profile.level || 'Beginner').toLowerCase();

    // Mifflin-St Jeor BMR formula
    let bmr;
    if (gender === 'female' || gender === 'f') {
        bmr = 10 * weight + 6.25 * height - 5 * age - 161;
    } else {
        bmr = 10 * weight + 6.25 * height - 5 * age + 5;
    }

    // Activity multiplier based on training level
    let activityMultiplier = 1.55;
    if (level.includes('beginner')) activityMultiplier = 1.4;
    else if (level.includes('intermediate')) activityMultiplier = 1.6;
    else if (level.includes('advanced') || level.includes('athlete')) activityMultiplier = 1.75;

    let tdee = Math.round(bmr * activityMultiplier);

    // Goal-based calorie adjustment
    if (goal.includes('muscle') || goal.includes('bulk') || goal.includes('gain') || goal.includes('mass')) {
        tdee = Math.round(tdee + 350); // surplus for muscle building
    } else if (goal.includes('weight loss') || goal.includes('cut') || goal.includes('lean') || goal.includes('fat loss')) {
        tdee = Math.round(tdee - 400); // deficit for fat loss
    } else if (goal.includes('strength')) {
        tdee = Math.round(tdee + 200); // slight surplus
    }

    // Protein calculation: 1.6-2.2g per kg based on goal
    let proteinPerKg = 1.6;
    if (goal.includes('muscle') || goal.includes('gain') || goal.includes('bulk')) proteinPerKg = 2.0;
    else if (goal.includes('strength')) proteinPerKg = 1.8;
    else if (goal.includes('weight loss') || goal.includes('cut')) proteinPerKg = 2.2;
    const protein = Math.round(weight * proteinPerKg);

    console.log(`📊 Profile Calc: BMR=${Math.round(bmr)}, TDEE=${tdee}, Target=${tdee} kcal, Protein=${protein}g`);
    return { calories: tdee, protein };
}

// ===== POST-PROCESS: Force meal totals to match targets =====
function normalizeMeals(diet, targetCals, targetProtein) {
    const meals = diet.meals;
    if (!meals) return diet;

    const keys = ['breakfast', 'lunch', 'snack', 'dinner'];
    const parseNum = (val) => {
        if (typeof val === 'number') return val;
        if (typeof val === 'string') return parseInt(val.replace(/[^0-9]/g, '')) || 0;
        return 0;
    };

    // Sum current meal values
    let totalCals = 0, totalProtein = 0;
    keys.forEach(k => {
        if (meals[k]) {
            totalCals += parseNum(meals[k].cals);
            totalProtein += parseNum(meals[k].protein);
        }
    });

    // Scale calories if off by more than 2%
    if (totalCals > 0 && Math.abs(totalCals - targetCals) / targetCals > 0.02) {
        const scale = targetCals / totalCals;
        keys.forEach(k => {
            if (meals[k]) meals[k].cals = Math.round(parseNum(meals[k].cals) * scale);
        });
        // Fix rounding remainder on dinner
        const newTotal = keys.reduce((s, k) => s + (meals[k]?.cals || 0), 0);
        if (meals.dinner) meals.dinner.cals += (targetCals - newTotal);
        console.log(`📊 Scaled cals: ${totalCals} → ${targetCals}`);
    }

    // Scale protein if off by more than 2%
    if (totalProtein > 0 && Math.abs(totalProtein - targetProtein) / targetProtein > 0.02) {
        const scale = targetProtein / totalProtein;
        keys.forEach(k => {
            if (meals[k]) {
                meals[k].protein = Math.round(parseNum(meals[k].protein) * scale) + 'g';
            }
        });
        const newTotal = keys.reduce((s, k) => s + parseNum(meals[k]?.protein), 0);
        if (meals.dinner) {
            const dp = parseNum(meals.dinner.protein);
            meals.dinner.protein = (dp + (targetProtein - newTotal)) + 'g';
        }
        console.log(`📊 Scaled protein: ${totalProtein}g → ${targetProtein}g`);
    }

    // Force macroTargets to match
    diet.macroTargets = {
        ...diet.macroTargets,
        cals: String(targetCals),
        protein: targetProtein + 'g'
    };

    return diet;
}

export const generateAIDiet = async (userProfile) => {
    try {
        console.log("🥗 Generating AI Diet Plan...");

        // Step 1: Calculate exact targets from user profile
        const targets = calculateTargets(userProfile);

        // ===== RANDOMIZE CUISINE & VIBE =====
        const cuisines = [
            'Mediterranean', 'Mexican', 'Indian', 'Japanese', 'Thai',
            'African', 'Middle Eastern', 'Caribbean', 'Greek', 'Fusion',
            'Soul Food', 'French', 'Korean', 'Street Food Style'
        ];
        const selectedCuisine = cuisines[Math.floor(Math.random() * cuisines.length)];
        console.log(`👨‍🍳 Chef Vibe: ${selectedCuisine}`);

        const prompt = `
You are an elite AI Nutrition Coach. Generate a personalized daily diet plan.

USER PROFILE:
- Goal: ${userProfile.goal || 'General Fitness'}
- Diet Type: ${userProfile.diet_type || 'Vegetarian'}
- Allergies: ${JSON.stringify(userProfile.allergies || ['None'])}
- Weight: ${userProfile.weight || '70'}kg
- Height: ${userProfile.height || '170'}cm
- Age: ${userProfile.age || '25'}
- Gender: ${userProfile.gender || 'Male'}
- Level: ${userProfile.level || 'Beginner'}

CALCULATED DAILY TARGETS (USE THESE EXACT NUMBERS):
- Daily Calories: ${targets.calories} kcal
- Daily Protein: ${targets.protein}g

RETURN ONLY valid JSON matching this EXACT schema (no markdown, no commentary):
{
    "summary": "string (e.g. 'Vegetarian Plan for Weight Loss')",
    "strategy": {
        "bullets": ["string", "string", "string"],
        "text": "string (1-2 sentence paragraph about the strategy)"
    },
    "macroTargets": {
        "cals": "${targets.calories}",
        "protein": "${targets.protein}g",
        "logic": "string (explain WHY these targets based on user's BMR, TDEE, and goal)"
    },
    "meals": {
        "breakfast": { "name": "string (specific real food)", "cals": number, "protein": "string with g suffix", "purpose": "string" },
        "lunch": { "name": "string", "cals": number, "protein": "string with g suffix", "purpose": "string" },
        "snack": { "name": "string", "cals": number, "protein": "string with g suffix", "purpose": "string" },
        "dinner": { "name": "string", "cals": number, "protein": "string with g suffix", "purpose": "string" }
    },
    "trainingFuel": {
        "pre": "string (pre-workout snack suggestion)",
        "post": "string (post-workout recovery suggestion)"
    },
    "focusPoints": [
        { "title": "string", "icon": "string (single emoji)", "desc": "string (detailed explanation)" },
        { "title": "string", "icon": "string", "desc": "string" },
        { "title": "string", "icon": "string", "desc": "string" },
        { "title": "string", "icon": "string", "desc": "string" }
    ],
    "supplements": [
        "EXACTLY 3 items required",
        { "name": "string", "dosage": "string (e.g. 5g, 1 tablet)", "context": "string (when/why to take)" }
    ],
    "reassurance": "string (motivational paragraph)",
    "disclaimer": "MEDICAL DISCLAIMER: Consult a qualified healthcare professional before starting any new diet or supplement routine. This guidance is for educational purposes only."
}

ABSOLUTE RULES:
1. breakfast.cals + lunch.cals + snack.cals + dinner.cals MUST EQUAL EXACTLY ${targets.calories}.
2. The sum of all protein values must equal exactly ${targets.protein}g.
3. Use REAL, culturally appropriate foods matching the diet type.
4. Respect allergies strictly.
5. All "cals" must be plain numbers. All "protein" must be strings ending in "g".
6. macroTargets.cals must be "${targets.calories}" and macroTargets.protein must be "${targets.protein}g".
7. VARIETY IS CRITICAL: This specific plan MUST focus on ${selectedCuisine} cuisine flavors and cooking styles (where applicable for the diet type).
8. Do NOT repeat generic meals. Be creative. Make it sound delicious.
9. Random seed for this generation: ${Date.now()}-${Math.random().toString(36).slice(2, 8)}

`;

        // ===== GROQ (Llama 3) REQUEST =====
        console.log("🥗 Sending request to Groq (Llama3-70b)...");
        const completion = await groqDiet.chat.completions.create({
            messages: [
                { role: "system", content: "You are a professional nutritionist and chef. You output ONLY valid JSON." },
                { role: "user", content: prompt }
            ],
            model: "llama-3.3-70b-versatile",
            temperature: 0.9,
            max_tokens: 4000,
            response_format: { type: "json_object" }
        });

        const jsonString = completion.choices[0]?.message?.content || "{}";
        console.log("🥗 Groq Response Received");

        let diet = JSON.parse(jsonString);

        // Step 2: Post-process to FORCE correct totals (AI can't be trusted)
        diet = normalizeMeals(diet, targets.calories, targets.protein);

        console.log(`🥗 AI Diet ready: ${targets.calories} kcal, ${targets.protein}g protein ✓`);
        return diet;

    } catch (error) {
        console.error("🥗 AI Diet Error:", error.message);
        throw new Error("Failed to generate diet with AI.");
    }
};

console.log("AI Service Loaded. Workout Key:", !!process.env.GEMINI_API_KEY, "| Diet Key:", !!process.env.GEMINI_DIET_API_KEY);
