const db = require('../db');

/**
 * Service to manage conversation lifecycle, message logging, and windowed context memory.
 */

async function getOrCreateConversation(sessionId) {
    if (!sessionId) {
        throw new Error('sessionId is required for conversation tracking');
    }

    try {
        const [existing] = await db.query(
            'SELECT * FROM ai_conversations WHERE session_id = ? LIMIT 1',
            [sessionId]
        );

        if (existing.length > 0) {
            return existing[0];
        }

        const [result] = await db.query(
            'INSERT INTO ai_conversations (session_id, status) VALUES (?, ?)',
            [sessionId, 'active']
        );

        return {
            id: result.insertId,
            session_id: sessionId,
            status: 'active',
            lead_score: 0,
            lead_status: 'cold'
        };
    } catch (error) {
        console.error('Error in getOrCreateConversation:', error);
        throw error;
    }
}

async function saveMessage(conversationId, role, content, toolName = null, toolCallId = null) {
    if (!conversationId || !role) return;

    try {
        await db.query(
            `INSERT INTO ai_messages (conversation_id, role, content, tool_name, tool_call_id)
             VALUES (?, ?, ?, ?, ?)`,
            [conversationId, role, content || '', toolName, toolCallId]
        );
    } catch (error) {
        console.error('Error saving message to DB:', error);
    }
}

async function getRecentMessages(conversationId, limit = 12) {
    if (!conversationId) return [];

    try {
        const [rows] = await db.query(
            `SELECT role, content, tool_name, tool_call_id, created_at
             FROM ai_messages
             WHERE conversation_id = ?
             ORDER BY id DESC
             LIMIT ?`,
            [conversationId, limit]
        );

        // Reverse to get chronological order (oldest to newest)
        return rows.reverse();
    } catch (error) {
        console.error('Error loading recent messages:', error);
        return [];
    }
}

async function getAISettings() {
    try {
        const [rows] = await db.query('SELECT * FROM ai_settings LIMIT 1');
        return rows[0] || {
            is_active: true,
            bot_name: 'BTR AI Assistant',
            welcome_message: '👋 Hello! I am BTR Communication\'s AI Assistant. How can I assist you with your project today?',
            enable_lead_capture: true,
            enable_pricing_answers: true,
            enable_portfolio_answers: true,
            enable_faq_answers: true,
            enable_human_handoff: true
        };
    } catch (error) {
        console.error('Error fetching AI settings:', error);
        return {
            is_active: true,
            bot_name: 'BTR AI Assistant',
            welcome_message: '👋 Hello! I am BTR Communication\'s AI Assistant. How can I assist you today?'
        };
    }
}

module.exports = {
    getOrCreateConversation,
    saveMessage,
    getRecentMessages,
    getAISettings
};
