
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

async function testAI() {
    try {
        console.log("Testing AI Workout Generation...");
        const response = await fetch('http://localhost:3000/api/generate-ai-workout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                level: "intermediate",
                goal: "hypertrophy",
                equipment: ["dumbbell", "bench"],
                time: 45,
                injuries: ["lower back"]
            })
        });

        if (!response.ok) {
            console.error("Error:", response.status, response.statusText);
            const text = await response.text();
            console.error(text);
            return;
        }

        const data = await response.json();
        console.log("Success! Received Workout Plan:");
        console.log(JSON.stringify(data, null, 2));

    } catch (err) {
        console.error("Test Failed:", err);
    }
}

testAI();
