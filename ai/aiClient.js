const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

/**
 * Initializes and retrieves the Google Gemini model instance with configured system instructions and tools.
 * Reads API key from GEMINI_API_KEY or GOOGLE_API_KEY.
 */
function getGeminiClient() {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
        console.warn('⚠️ GEMINI_API_KEY is not set in environment variables. AI queries will fail.');
        return null;
    }
    return new GoogleGenerativeAI(apiKey);
}

function getGeminiModelName() {
    return process.env.GEMINI_MODEL || 'gemini-flash-lite-latest';
}

module.exports = {
    getGeminiClient,
    getGeminiModelName
};
