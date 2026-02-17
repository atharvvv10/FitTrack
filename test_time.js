
import { generateAIDiet } from './server/ai.js';

const profile = {
    goal: 'Muscle Gain',
    diet_type: 'Non-Vegetarian',
    allergies: [],
    weight: '80',
    height: '180',
    age: '25',
    gender: 'Male',
    level: 'Intermediate'
};

const start = Date.now();
console.log("⏱️ Starting AI Diet Generation...");

try {
    await generateAIDiet(profile);
    const end = Date.now();
    const duration = (end - start) / 1000;
    console.log(`\n✅ DONE in ${duration.toFixed(2)} seconds.`);
} catch (err) {
    console.error("❌ Failed:", err.message);
}
