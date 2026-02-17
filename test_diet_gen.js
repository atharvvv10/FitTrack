
import { generateDiet } from './src/logic/dietGenerator.js';

const mockContext = {
    goal: 'Muscle Gain',
    diet_type: 'Vegetarian',
    allergies: [],
    level: 'Intermediate'
};

console.log("Testing generateDiet...");
try {
    const plan = generateDiet(mockContext, []);
    console.log("Success! Plan generated.");
    console.log("Summary:", plan.summary);
    console.log("Logic:", plan.macroTargets.logic);
    console.log("Supplements:", JSON.stringify(plan.supplements, null, 2));
} catch (error) {
    console.error("CRASH DETECTED:");
    console.error(error);
}
