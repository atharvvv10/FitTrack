import Groq from 'groq-sdk';
import dotenv from 'dotenv';
dotenv.config();

const groq = new Groq({ apiKey: process.env.GROQ_DIET_API_KEY });

const userProfile = {
    goal: 'Muscle Gain',
    diet_type: 'Vegetarian',
    allergies: ['None'],
    weight: '70',
    height: '175',
    age: '22',
    gender: 'Male',
    level: 'Intermediate'
};

// Same calorie calculation as server
const weight = 70, height = 175, age = 22;
const bmr = 10 * weight + 6.25 * height - 5 * age + 5; // Male
const tdee = Math.round(bmr * 1.6); // Intermediate
const calories = tdee + 350; // Muscle Gain
const protein = Math.round(weight * 2.0); // 2.0g/kg

console.log(`\n📊 Pre-calculated Targets: ${calories} kcal, ${protein}g protein`);
console.log(`\n🍛 Sending to Groq API (Indian Diet)...\n`);

const prompt = `
You are an expert Indian Nutritionist. Generate an AUTHENTIC INDIAN daily diet plan.

USER: ${userProfile.age}yr ${userProfile.gender}, ${userProfile.weight}kg, ${userProfile.level}, Goal: ${userProfile.goal}, Diet: ${userProfile.diet_type}
TARGETS: ${calories} kcal, ${protein}g protein

Use only real Indian foods (e.g., Rajma Chawal, Besan Chilla, Dal Tadka, Paneer Sabzi, Poha).
Return ONLY JSON:
{
    "summary": "string",
    "meals": {
        "breakfast": { "name": "Indian food name", "cals": number, "protein": "Xg" },
        "lunch": { "name": "Indian food name", "cals": number, "protein": "Xg" },
        "snack": { "name": "Indian food name", "cals": number, "protein": "Xg" },
        "dinner": { "name": "Indian food name", "cals": number, "protein": "Xg" }
    },
    "trainingFuel": { "pre": "Indian pre-workout", "post": "Indian post-workout" }
}
RULE: Meal cals must sum to exactly ${calories}.
`;

const start = Date.now();
const completion = await groq.chat.completions.create({
    messages: [
        { role: 'system', content: 'You are a professional Indian nutritionist. Output ONLY valid JSON.' },
        { role: 'user', content: prompt }
    ],
    model: 'llama-3.3-70b-versatile',
    temperature: 0.8,
    max_tokens: 1000,
    response_format: { type: 'json_object' }
});

const elapsed = Date.now() - start;
const json = JSON.parse(completion.choices[0].message.content);

console.log(`✅ Groq responded in ${elapsed}ms\n`);
console.log('📋 DIET PLAN OUTPUT:');
console.log('====================');
console.log(`Summary: ${json.summary}`);
console.log(`\n🌅 Breakfast: ${json.meals?.breakfast?.name}`);
console.log(`   Cals: ${json.meals?.breakfast?.cals} | Protein: ${json.meals?.breakfast?.protein}`);
console.log(`\n☀️  Lunch:     ${json.meals?.lunch?.name}`);
console.log(`   Cals: ${json.meals?.lunch?.cals} | Protein: ${json.meals?.lunch?.protein}`);
console.log(`\n🍎 Snack:     ${json.meals?.snack?.name}`);
console.log(`   Cals: ${json.meals?.snack?.cals} | Protein: ${json.meals?.snack?.protein}`);
console.log(`\n🌙 Dinner:    ${json.meals?.dinner?.name}`);
console.log(`   Cals: ${json.meals?.dinner?.cals} | Protein: ${json.meals?.dinner?.protein}`);

const totalCals = (json.meals?.breakfast?.cals || 0) + (json.meals?.lunch?.cals || 0) + (json.meals?.snack?.cals || 0) + (json.meals?.dinner?.cals || 0);
console.log(`\n📊 Total Calories: ${totalCals} (Target: ${calories}) ${Math.abs(totalCals - calories) < 50 ? '✅' : '⚠️'}`);

console.log(`\n⚡ Pre-Workout:  ${json.trainingFuel?.pre}`);
console.log(`💪 Post-Workout: ${json.trainingFuel?.post}`);
