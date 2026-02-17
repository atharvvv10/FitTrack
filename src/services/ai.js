
export const generateAIWorkout = async (userProfile) => {
    try {
        console.log("Calling Backend AI Service...");
        const response = await fetch('/api/generate-ai-workout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userProfile)
        });

        if (!response.ok) {
            throw new Error(`Backend API Error: ${response.statusText}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error("AI Generation Failed:", error);
        throw error;
    }
};

export const generateAIDiet = async (userContext) => {
    try {
        console.log("Calling Backend AI Diet Service...");
        const response = await fetch('/api/generate-ai-diet', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userContext)
        });

        if (!response.ok) {
            throw new Error(`Backend Diet API Error: ${response.statusText}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error("AI Diet Generation Failed:", error);
        throw error;
    }
};
