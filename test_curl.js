const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testWorkingModel() {
    const apiKey = "AQ.Ab8RN6IRz83qa9e6XA2VHPpU3VVJRrx6vEFWRBODFXkh2bwwFw";
    const genAI = new GoogleGenerativeAI(apiKey);

    const models = [
        "gemini-flash-latest",
        "gemini-pro-latest",
        "gemini-1.5-flash",
        "gemini-2.0-flash"
    ];

    for (const m of models) {
        try {
            console.log(`Testing: ${m}...`);
            const model = genAI.getGenerativeModel({ model: m });
            const result = await model.generateContent("Explain how AI works in 5 words.");
            console.log(`\n🎉 SUCCESS WITH MODEL [${m}]!`);
            console.log("Response:", result.response.text());
            return m;
        } catch (e) {
            console.error(`❌ Failed with ${m}:`, e.message);
        }
    }
}

testWorkingModel();
