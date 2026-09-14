const { getGeminiClient, getGeminiModelName } = require('./aiClient');
const { getSystemPrompt } = require('./aiSystemPrompt');
const { geminiTools } = require('./aiTools');
const { executeTool } = require('./aiToolExecutor');
const {
    getOrCreateConversation,
    saveMessage,
    getRecentMessages,
    getAISettings
} = require('./conversationService');

const MAX_TOOL_LOOPS = 5;

/**
 * Handles incoming chat messages from the website visitor.
 * Multi-turn memory, tool calling with Gemini, loop protection, and error handling.
 */
async function processChatMessage({ sessionId, message }) {
    if (!sessionId || !message || typeof message !== 'string' || !message.trim()) {
        return {
            success: false,
            message: 'Invalid request: sessionId and message are required.'
        };
    }

    const cleanMessage = message.trim();

    // 1. Get or create conversation record
    const conversation = await getOrCreateConversation(sessionId);
    const conversationId = conversation.id;

    // 2. Save user message to database
    await saveMessage(conversationId, 'user', cleanMessage);

    // 3. Load AI Settings
    const settings = await getAISettings();
    if (!settings.is_active) {
        const offResponse = "Our AI Assistant is currently undergoing maintenance. Please contact us directly at info@btrcommunication.com or through our contact page.";
        await saveMessage(conversationId, 'assistant', offResponse);
        return {
            success: true,
            conversationId,
            message: offResponse
        };
    }

    // 4. Initialize Gemini Client
    const genAI = getGeminiClient();
    if (!genAI) {
        const fallbackMsg = "Thank you for reaching out to BTR Communication! Our AI Assistant is currently offline. Please leave your contact details or email us at info@btrcommunication.com.";
        await saveMessage(conversationId, 'assistant', fallbackMsg);
        return {
            success: true,
            conversationId,
            message: fallbackMsg
        };
    }

    try {
        const modelName = getGeminiModelName();
        const model = genAI.getGenerativeModel({
            model: modelName,
            systemInstruction: getSystemPrompt(settings.system_prompt_override),
            tools: geminiTools
        });

        // 5. Build sanitized history for Gemini (strictly alternating user -> model, starting with user)
        const recentMessages = await getRecentMessages(conversationId, 12);
        const pastMessages = recentMessages.slice(0, -1);
        
        const historyForGemini = [];
        for (const msg of pastMessages) {
            const role = (msg.role === 'user') ? 'user' : (msg.role === 'assistant' || msg.role === 'model') ? 'model' : null;
            if (!role || !msg.content || !msg.content.trim()) continue;

            if (historyForGemini.length === 0) {
                if (role === 'user') {
                    historyForGemini.push({ role: 'user', parts: [{ text: msg.content.trim() }] });
                }
            } else {
                const last = historyForGemini[historyForGemini.length - 1];
                if (last.role === role) {
                    last.parts[0].text += '\n' + msg.content.trim();
                } else {
                    historyForGemini.push({ role, parts: [{ text: msg.content.trim() }] });
                }
            }
        }

        // Ensure history ends on 'model' if not empty, so the next sendMessage is 'user'
        while (historyForGemini.length > 0 && historyForGemini[historyForGemini.length - 1].role === 'user') {
            historyForGemini.pop();
        }

        // 6. Start Gemini Chat Session
        const chat = model.startChat({
            history: historyForGemini
        });

        // 7. Send user message to model
        let response = await chat.sendMessage(cleanMessage);
        let loops = 0;

        // 8. Tool Calling Loop
        while (loops < MAX_TOOL_LOOPS) {
            const functionCalls = response.response.functionCalls();
            if (!functionCalls || functionCalls.length === 0) {
                break;
            }

            loops++;
            const functionResponses = [];

            for (const call of functionCalls) {
                const toolName = call.name;
                const toolArgs = call.args || {};

                // Log tool invocation message in background
                await saveMessage(conversationId, 'tool', JSON.stringify({ name: toolName, args: toolArgs }), toolName);

                // Execute safe backend tool
                const toolResult = await executeTool(toolName, toolArgs, {
                    sessionId,
                    conversationId
                });

                // Send tool result back to Gemini in contextual prompt
                response = await chat.sendMessage(
                    `[Database Tool Result for '${toolName}']\nData: ${JSON.stringify(toolResult)}\n\nPlease provide a natural, concise, and helpful response to the visitor based on this accurate data.`
                );
            }
        }

        let assistantText = '';
        try {
            assistantText = response.response.text();
        } catch {
            assistantText = "I have processed your request. How else can I assist you with BTR Communication's services?";
        }

        if (!assistantText || !assistantText.trim()) {
            assistantText = "Thank you! I'm here to help with any questions about BTR Communication, our services, or pricing.";
        }

        // 9. Save assistant response to DB
        await saveMessage(conversationId, 'assistant', assistantText);

        return {
            success: true,
            conversationId,
            message: assistantText
        };

    } catch (error) {
        console.error('Error in AI Chat processing:', error);
        
        const friendlyErrorMsg = "I'm having a brief issue connecting to our knowledge base. Could you please rephrase or let us know how our team can contact you?";
        await saveMessage(conversationId, 'assistant', friendlyErrorMsg);

        return {
            success: true,
            conversationId,
            message: friendlyErrorMsg
        };
    }
}

module.exports = {
    processChatMessage
};
