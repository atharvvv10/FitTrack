// src/logic/workoutGenerator.js

// Removed legacy EXERCISE_DB constant

const WARMUPS = [
    { name: "Arm Circles", duration: "1 min" },
    { name: "Torso Twists", duration: "1 min" },
    { name: "Hip Openers", duration: "1 min" },
    { name: "Light Jog / March", duration: "2 min" }
];

const COOLDOWNS = [
    { name: "Hamstring Stretch", duration: "1 min" },
    { name: "Quad Stretch", duration: "1 min" },
    { name: "Child's Pose", duration: "1 min" },
    { name: "Deep Breathing", duration: "2 min" }
];

const GENERIC_MISTAKES = [
    "Holding breath during exertion",
    "Rushing the negative (eccentric) phase",
    "sacrificing form for weight",
    "Not engaging core stability"
];

export const generateWorkout = (userContext, previousExercises = [], categoryOverride = null, exerciseLibrary = []) => {

    // 1. Categorize the flat library into buckets
    const db = {
        upper: [],
        lower: [],
        core: [],
        cardio: [],
        mobility: []
    };

    exerciseLibrary.forEach(ex => {
        // Parse JSON fields if they are strings (DB returns JSONB as object usually, but check)
        const muscles = Array.isArray(ex.primary_muscles) ? ex.primary_muscles : (JSON.parse(ex.primary_muscles || '[]'));
        const category = ex.category;

        // MAPPING LOGIC
        if (category === 'cardio' || category === 'plyometrics') {
            db.cardio.push(ex);
        } else if (category === 'stretching') {
            db.mobility.push(ex);
        } else if (category === 'strength' || category === 'powerlifting' || category === 'strongman' || category === 'olympic weightlifting') {
            // Check muscles for Upper vs Lower vs Core
            const upperMuscles = ['chest', 'shoulders', 'biceps', 'triceps', 'forearms', 'middle back', 'lats', 'traps', 'neck'];
            const lowerMuscles = ['quadriceps', 'hamstrings', 'calves', 'glutes', 'abductors', 'adductors'];
            const coreMuscles = ['abdominals', 'lower back'];

            // Simple heuristic: check primary muscle match
            const isUpper = muscles.some(m => upperMuscles.includes(m));
            const isLower = muscles.some(m => lowerMuscles.includes(m));
            const isCore = muscles.some(m => coreMuscles.includes(m));

            if (isCore) db.core.push(ex);
            else if (isLower) db.lower.push(ex);
            else if (isUpper) db.upper.push(ex);
            else db.upper.push(ex); // Fallback
        }
    });

    // Fallbacks if empty (prevent crashes)
    if (db.upper.length === 0) { /* Optional warning */ }

    const EXERCISE_DB = db; // map to local var name to keep rest of code working

    const { goal, level, equipment = [] } = userContext;

    // Determine Category
    // If override exists, use it. Else derive from Goal.
    let targetCategory = categoryOverride;
    if (!targetCategory) {
        if (goal === "Muscle Gain") targetCategory = "Split"; // Default to split logic
        else if (goal === "Weight Loss") targetCategory = "Full Body";
        else targetCategory = "Full Body";
    }

    // Equipment mapping
    const hasDumbbells = equipment.includes("Dumbbells");
    const hasBarbell = equipment.includes("Barbell");
    const hasMachines = equipment.includes("Machines");
    const isBodyweightOnly = equipment.includes("Bodyweight only") || equipment.length === 0;

    // Function to check if exercise is doable
    const canDo = (ex) => {
        const eq = ex.equipment ? ex.equipment.toLowerCase() : 'body only';
        if (eq === "body only" || eq === "bodyweight" || eq === "none") return true;
        if (eq === "dumbbell" && hasDumbbells) return true;
        if (eq === "barbell" && hasBarbell) return true;
        if ((eq === "machine" || eq === "cable") && hasMachines) return true;
        return false;
    };

    let workoutPlan = [];
    let title = "Daily Workout";
    let tags = [goal, level];

    // Logic Builder
    const buildSet = (sourceArray, count) => {
        const doable = sourceArray.filter(canDo);
        const available = doable.filter(ex => !previousExercises.includes(ex.name)); // Try strict non-repeat
        const pool = available.length >= count ? available : doable; // Fallback to repeats if pool empty
        return pool.sort(() => 0.5 - Math.random()).slice(0, count);
    };

    if (targetCategory === "Upper Body" || (targetCategory === "Split" && Math.random() > 0.5)) {
        title = "Upper Body Power";
        workoutPlan = [...buildSet(EXERCISE_DB.upper, 5), ...buildSet(EXERCISE_DB.core, 1)];
        tags.push("Upper Body");
    } else if (targetCategory === "Lower Body" || targetCategory === "Split") {
        title = "Lower Body Strength";
        workoutPlan = [...buildSet(EXERCISE_DB.lower, 4), ...buildSet(EXERCISE_DB.core, 2)];
        tags.push("Lower Body");
    } else if (targetCategory === "Full Body") {
        title = "Total Body Conditioning";
        workoutPlan = [
            ...buildSet(EXERCISE_DB.cardio, 1),
            ...buildSet(EXERCISE_DB.lower, 2),
            ...buildSet(EXERCISE_DB.upper, 3),
            ...buildSet(EXERCISE_DB.core, 1)
        ];
        tags.push("Full Body");
    } else if (targetCategory === "Cardio" || targetCategory === "Endurance") {
        title = "High Intensity Cardio";
        workoutPlan = [...buildSet(EXERCISE_DB.cardio, 5), ...buildSet(EXERCISE_DB.core, 1)];
        tags.push("Cardio");
    } else if (targetCategory === "Quick") {
        title = "Quick HIIT Blast";
        workoutPlan = [...buildSet(EXERCISE_DB.cardio, 2), ...buildSet(EXERCISE_DB.lower, 1), ...buildSet(EXERCISE_DB.core, 1)];
        tags.push("Quick");
        tags.push("Cardio");
    } else if (targetCategory === "Core") {
        title = "Core Strength & Stability";
        workoutPlan = [...buildSet(EXERCISE_DB.core, 5)];
        tags.push("Core");
    } else if (targetCategory === "Mobility") {
        title = "Active Recovery & Mobility";
        workoutPlan = [...buildSet(EXERCISE_DB.mobility, 4)];
        tags.push("Mobility");
        tags.push("Recovery");
    }

    // Add Sets/Reps details
    // Add Sets/Reps details
    const finalExercises = workoutPlan.map(ex => {
        // Parse JSON fields from SQL if they are strings
        const steps = Array.isArray(ex.instructions) ? ex.instructions : (JSON.parse(ex.instructions || '[]'));
        const images = Array.isArray(ex.images) ? ex.images : (JSON.parse(ex.images || '[]'));

        // Construct image URL (Local Server)
        // Image path is like "Folder/0.jpg". We serve at "/exercises/..."
        const imagePath = images.length > 0 ? `/exercises/${images[0]}` : null;
        const gifPath = images.length > 1 ? `/exercises/${images[1]}` : imagePath; // Fallback to 2nd image if no gif (dataset has 0.jpg and 1.jpg)

        return {
            ...ex,
            sets: 3,
            reps: goal === "Muscle Gain" ? "8-12" : "12-15",
            rest: "60s",
            duration: 5,
            steps: steps, // content
            cues: ex.cues || ["Control the movement", "Breathe steadily", "Focus on form"], // Generic cues if missing
            mistakes: ex.mistakes || ["Rushing reps", "Poor posture", "Holding breath"], // Generic mistakes
            image: imagePath,
            gif: gifPath,
            instruction: steps[0] || "Perform the exercise.",
            // Normalize equipment for frontend badges
            equipment: ex.equipment === "body only" ? "bodyweight" : ex.equipment
        };
    });

    // Determine Equipment Level
    const usedEquipment = new Set(finalExercises.map(e => e.equipment));
    let equipmentLabel = "Home (Bodyweight)";
    if (usedEquipment.has("machine") || usedEquipment.has("barbell")) {
        equipmentLabel = "Gym";
    } else if (usedEquipment.has("dumbbell")) {
        equipmentLabel = "Home (Dumbbells)";
    }

    const totalTime = finalExercises.reduce((acc, curr) => acc + curr.duration, 0) + 10; // +10 for warm/cool

    return {
        id: Date.now(),
        title,
        tags,
        difficulty: level, // Pass difficulty through
        equipmentLabel,    // New field
        totalDuration: `${totalTime} min`,
        warmup: WARMUPS,
        exercises: finalExercises,
        cooldown: COOLDOWNS
    };
};
