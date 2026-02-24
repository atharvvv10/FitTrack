
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
            console.log("ðŸ‹ï¸ Sending Workout Request to Groq (Llama3-70b)...");
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
            console.log("ðŸ‹ï¸ Groq Workout Response Received");
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

    console.log(`ðŸ“Š Profile Calc: BMR=${Math.round(bmr)}, TDEE=${tdee}, Target=${tdee} kcal, Protein=${protein}g`);
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
        console.log(`ðŸ“Š Scaled cals: ${totalCals} â†’ ${targetCals}`);
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
        console.log(`ðŸ“Š Scaled protein: ${totalProtein}g â†’ ${targetProtein}g`);
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
        console.log("Generating dataset-driven Indian diet plan...");

        // Step 1: Calculate exact calorie & protein targets
        const targets = calculateTargets(userProfile);
        const isNonVeg = (userProfile.diet_type || '').toLowerCase().includes('non');

        // Step 2: Fetch verified Indian foods from ICMR_Curated
        // These 43 foods are 100% Indian (hand-curated from ICMR-NIN tables)
        const result = await pool.query(`
            SELECT name, calories, protein_g, carbs_g, fat_g, fibre_g, food_group, diet_type
            FROM food_items
            WHERE source = 'ICMR_Curated'
              AND calories BETWEEN 50 AND 800
              AND (diet_type = $1 OR diet_type = 'vegetarian')
            ORDER BY food_group, name
        `, [isNonVeg ? 'non-vegetarian' : 'vegetarian']);

        const foods = result.rows.map(f => ({
            name: f.name,
            cals: parseInt(f.calories),
            pro: parseFloat(f.protein_g) || 0,
            carbs: parseFloat(f.carbs_g) || 0,
            fat: parseFloat(f.fat_g) || 0,
            group: (f.food_group || '').toLowerCase()
        }));

        console.log("Loaded " + foods.length + " verified ICMR Indian foods");

        // Step 3: Server-side meal selection by food_group
        // Targets per meal: B=25%, L=35%, S=15%, D=25%
        const mealTargets = {
            breakfast: { calPct: 0.25, group: ['breakfast', 'cereals & grains', 'eggs', 'dairy', 'nuts & seeds'] },
            lunch:     { calPct: 0.35, group: ['lunch/dinner', 'pulses & legumes', 'meat & seafood', 'soy products', 'cereals & grains'] },
            snack:     { calPct: 0.15, group: ['snacks', 'fruits', 'nuts & seeds', 'beverages'] },
            dinner:    { calPct: 0.25, group: ['lunch/dinner', 'pulses & legumes', 'soy products', 'meat & seafood'] }
        };

        const usedNames = new Set();
        const meals = {};

        for (const [slot, config] of Object.entries(mealTargets)) {
            const targetCals = Math.round(targets.calories * config.calPct);

            // Pick best food for this slot from matching groups
            const candidates = foods
                .filter(f => !usedNames.has(f.name) && config.group.some(g => f.group.includes(g)))
                .sort((a, b) => Math.abs(a.cals - targetCals) - Math.abs(b.cals - targetCals));

            // Fallback: any unused food
            const food = candidates[0] || foods.find(f => !usedNames.has(f.name)) || foods[0];
            usedNames.add(food.name);

            // Calculate serving multiplier to hit target calories
            const rawMultiplier = targetCals / food.cals;
            const mult = Math.min(2.5, Math.max(0.5, Math.round(rawMultiplier * 4) / 4));

            meals[slot] = {
                name: food.name,
                cals: Math.round(food.cals * mult),
                protein: (Math.round(food.pro * mult * 10) / 10) + 'g',
                purpose: food.group + ' — ' + Math.round(food.cals * mult) + ' kcal',
                _rawCals: food.cals,
                _mult: mult
            };
        }

        // Step 4: Normalize total to match exact targets
        const totalCalsBefore = Object.values(meals).reduce((s, m) => s + m.cals, 0);
        const diff = targets.calories - totalCalsBefore;
        // Apply calorie diff to dinner (largest meal)
        meals.dinner.cals += diff;
        const dinnerPro = parseFloat(meals.dinner.protein);
        meals.dinner.protein = (Math.round((dinnerPro + diff * 0.1) * 10) / 10) + 'g';

        // Step 5: Ask AI ONLY for text content (strategy, supplements, motivational text)
        // AI cannot invent food — meals are already set from real DB
        const aiTextPrompt = `You are an expert Indian nutritionist. Write advisory content for this diet plan.

USER: ${userProfile.goal || 'Fitness'} goal | ${userProfile.diet_type || 'Vegetarian'} | ${userProfile.weight}kg | ${userProfile.gender || 'Male'} | ${userProfile.level || 'Beginner'}
TARGETS: ${targets.calories} kcal/day | ${targets.protein}g protein/day
MEALS: Breakfast: ${meals.breakfast.name}, Lunch: ${meals.lunch.name}, Snack: ${meals.snack.name}, Dinner: ${meals.dinner.name}

Return ONLY this JSON:
{
    "summary": "Indian ${userProfile.diet_type || 'Vegetarian'} Plan for ${userProfile.goal || 'Fitness'}",
    "strategy": {
        "bullets": ["tip about timing", "tip about portions", "tip about hydration"],
        "text": "1-2 sentences explaining why these meals suit the user's goal"
    },
    "trainingFuel": {
        "pre": "Indian pre-workout snack (e.g. banana + dates, roasted chana)",
        "post": "Indian post-workout recovery (e.g. chaas + chana, egg bhurji)"
    },
    "focusPoints": [
        {"title": "string", "icon": "emoji", "desc": "string"},
        {"title": "string", "icon": "emoji", "desc": "string"},
        {"title": "string", "icon": "emoji", "desc": "string"}
    ],
    "supplements": [
        {"name": "string", "dosage": "string", "context": "when/why"},
        {"name": "string", "dosage": "string", "context": "when/why"},
        {"name": "string", "dosage": "string", "context": "when/why"}
    ],
    "reassurance": "2 sentence motivational message with Indian cultural references"
}`;

        const completion = await groqDiet.chat.completions.create({
            messages: [
                { role: "system", content: "You are an Indian nutritionist. Return only valid JSON." },
                { role: "user", content: aiTextPrompt }
            ],
            model: "llama-3.3-70b-versatile",
            temperature: 0.7,
            max_tokens: 1500,
            response_format: { type: "json_object" }
        });

        const aiText = JSON.parse(completion.choices[0]?.message?.content || "{}");

        // Step 6: Assemble final plan — meals from DB, text from AI
        const totalProtein = Object.values(meals)
            .reduce((s, m) => s + parseFloat(m.protein), 0);

        const diet = {
            summary: aiText.summary || `Indian ${userProfile.diet_type || 'Vegetarian'} Plan`,
            strategy: aiText.strategy || { bullets: ['Eat on time', 'Stay hydrated', 'Track macros'], text: 'Focus on whole Indian foods.' },
            macroTargets: {
                cals: String(targets.calories),
                protein: targets.protein + 'g',
                logic: `Calculated using Mifflin-St Jeor BMR formula: ${targets.calories} kcal/day to support ${userProfile.goal} at your body weight.`
            },
            meals: {
                breakfast: { name: meals.breakfast.name, cals: meals.breakfast.cals, protein: meals.breakfast.protein, purpose: meals.breakfast.purpose },
                lunch:     { name: meals.lunch.name,     cals: meals.lunch.cals,     protein: meals.lunch.protein,     purpose: meals.lunch.purpose },
                snack:     { name: meals.snack.name,     cals: meals.snack.cals,     protein: meals.snack.protein,     purpose: meals.snack.purpose },
                dinner:    { name: meals.dinner.name,    cals: meals.dinner.cals,    protein: meals.dinner.protein,    purpose: meals.dinner.purpose }
            },
            trainingFuel: aiText.trainingFuel || { pre: 'Banana + 2 dates', post: 'Chaas + roasted chana' },
            focusPoints: aiText.focusPoints || [],
            supplements: Array.isArray(aiText.supplements) ? aiText.supplements.filter(s => typeof s === 'object' && s.name) : [],
            reassurance: aiText.reassurance || 'Stay consistent with your Indian diet!',
            disclaimer: 'MEDICAL DISCLAIMER: Consult a qualified healthcare professional before starting any new diet or supplement routine.'
        };

        const finalTotal = Object.values(diet.meals).reduce((s, m) => s + (parseInt(m.cals) || 0), 0);
        console.log("Diet ready: " + finalTotal + " kcal (target: " + targets.calories + ") | meals from ICMR DB");
        return diet;

    } catch (error) {
        console.error("Diet generation error:", error.message);
        throw new Error("Failed to generate diet plan.");
    }
};

console.log("AI Service Loaded. Workout Key:", !!process.env.GEMINI_API_KEY, "| Diet Key:", !!process.env.GEMINI_DIET_API_KEY);
