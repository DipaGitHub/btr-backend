const express = require('express');
const router = express.Router();
const { processChatMessage } = require('../ai/aiService');
const { getAISettings, getOrCreateConversation, getRecentMessages } = require('../ai/conversationService');

/**
 * @route POST /api/ai/chat
 * @desc Public endpoint for website chatbot interaction
 */
router.post('/chat', async (req, res) => {
    try {
        const { sessionId, message } = req.body;

        if (!sessionId || !message) {
            return res.status(400).json({
                success: false,
                error: 'sessionId and message are required in request body.'
            });
        }

        const result = await processChatMessage({ sessionId, message });
        return res.status(200).json(result);
    } catch (error) {
        console.error('Fatal route error /api/ai/chat:', error);
        return res.status(500).json({
            success: false,
            message: "I am having a temporary issue responding. Please contact info@btrcommunication.com for immediate support."
        });
    }
});

/**
 * @route GET /api/ai/config
 * @desc Public endpoint to retrieve bot configuration & welcome message
 */
router.get('/config', async (req, res) => {
    try {
        const settings = await getAISettings();
        res.status(200).json({
            success: true,
            botName: settings.bot_name || 'BTR AI Assistant',
            welcomeMessage: settings.welcome_message || '👋 Hello! Welcome to BTR Communication. How can I assist you with your project today?',
            isActive: settings.is_active !== undefined ? !!settings.is_active : true
        });
    } catch (error) {
        console.error('Error fetching AI public config:', error);
        res.status(200).json({
            success: true,
            botName: 'BTR AI Assistant',
            welcomeMessage: '👋 Hello! Welcome to BTR Communication. How can I assist you with your project today?',
            isActive: true
        });
    }
});

/**
 * @route GET /api/ai/history/:sessionId
 * @desc Public endpoint to restore chat history on page refresh
 */
router.get('/history/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        if (!sessionId) {
            return res.status(400).json({ success: false, error: 'sessionId required' });
        }

        const conv = await getOrCreateConversation(sessionId);
        const messages = await getRecentMessages(conv.id, 30);

        const filtered = messages
            .filter(m => m.role === 'user' || m.role === 'assistant')
            .map(m => ({
                from: m.role === 'user' ? 'user' : 'bot',
                text: m.content,
                createdAt: m.created_at
            }));

        res.status(200).json({
            success: true,
            conversationId: conv.id,
            messages: filtered
        });
    } catch (error) {
        console.error('Error loading history:', error);
        res.status(500).json({ success: false, error: 'Failed to load history' });
    }
});

module.exports = router;
