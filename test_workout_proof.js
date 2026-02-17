
import { generateAIWorkout } from './server/ai.js';
import dotenv from 'dotenv';
dotenv.config();

console.log("=== WORKOUT API PROOF TEST ===");
const profile = {
    goal: "Muscle Gain",
    level: "Intermediate",
    equipment: ["Dumbbells", "Barbell"],
    injuries: "None",
    time: 60
};

(async () => {
    try {
        console.log("Calling AI Workout API...");
        const workout = await generateAIWorkout(profile);
        console.log("🏋️ RESPONSE RECEIVED:");
        console.log(JSON.stringify(workout, null, 2).slice(0, 1000) + "..."); // Truncate for log

        if (workout.warmup && workout.exercises) {
            console.log("✅ WORKOUT VALID");
        } else {
            console.log("❌ INVALID STRUCTURE");
        }
    } catch (e) {
        console.error("❌ API FAILED:", e.message);
    }
})();
