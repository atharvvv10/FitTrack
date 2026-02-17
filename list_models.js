
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from 'dotenv';
dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function listModels() {
    try {
        console.log("Listing models...");
        // Note: listModels is not directly exposed on genAI instance in some versions?
        // Actually it is usually a separate manager or via getGenerativeModel logic?
        // Let's check documentation or try standard way if possible.
        // Wait, the error message said: "Call ListModels to see the list of available models".
        // The SDK usually exposes it via `getGenerativeModel`? No.
        // It's `genAI.getGenerativeModel({ ... })`
        // There isn't a simple list function on the default export often.
        // But let's try a simple fetch to the API endpoint if the SDK prevents it.

        const key = process.env.GEMINI_API_KEY;
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;

        const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
        const res = await fetch(url);
        const data = await res.json();
        console.log(JSON.stringify(data, null, 2));
    } catch (e) {
        console.error(e);
    }
}

listModels();
