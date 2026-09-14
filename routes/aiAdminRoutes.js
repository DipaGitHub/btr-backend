const express = require('express');
const router = express.Router();
const db = require('../db');

/**
 * @route GET /api/ai/admin/conversations
 * @desc Get list of AI conversations with optional search, filtering, and pagination
 */
router.get('/conversations', async (req, res) => {
    try {
        const { search, lead_status, status, page = 1, limit = 20 } = req.query;
        const offset = (Number(page) - 1) * Number(limit);

        let whereConditions = [];
        let params = [];

        if (search && search.trim()) {
            const searchTerm = `%${search.trim()}%`;
            whereConditions.push('(c.user_name LIKE ? OR c.user_email LIKE ? OR c.user_phone LIKE ? OR c.company_name LIKE ? OR c.detected_service LIKE ? OR c.project_description LIKE ?)');
            params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
        }

        if (lead_status && lead_status !== 'all') {
            whereConditions.push('c.lead_status = ?');
            params.push(lead_status);
        }

        if (status && status !== 'all') {
            whereConditions.push('c.status = ?');
            params.push(status);
        }

        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

        // Get total count
        const [countResult] = await db.query(
            `SELECT COUNT(*) as total FROM ai_conversations c ${whereClause}`,
            params
        );
        const total = countResult[0].total;

        // Get paginated data
        const queryParams = [...params, Number(limit), offset];
        const [conversations] = await db.query(
            `SELECT c.*,
                    (SELECT COUNT(*) FROM ai_messages m WHERE m.conversation_id = c.id) as message_count,
                    (SELECT content FROM ai_messages m WHERE m.conversation_id = c.id ORDER BY id DESC LIMIT 1) as last_message
             FROM ai_conversations c
             ${whereClause}
             ORDER BY c.created_at DESC
             LIMIT ? OFFSET ?`,
            queryParams
        );

        res.status(200).json({
            success: true,
            total,
            page: Number(page),
            limit: Number(limit),
            data: conversations
        });
    } catch (error) {
        console.error('Error fetching admin AI conversations:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch AI conversations' });
    }
});

/**
 * @route GET /api/ai/admin/conversations/:id
 * @desc Get single conversation detail along with full message transcript
 */
router.get('/conversations/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const [convRows] = await db.query(
            'SELECT * FROM ai_conversations WHERE id = ?',
            [id]
        );

        if (convRows.length === 0) {
            return res.status(404).json({ success: false, error: 'Conversation not found' });
        }

        const [messages] = await db.query(
            'SELECT * FROM ai_messages WHERE conversation_id = ? ORDER BY id ASC',
            [id]
        );

        res.status(200).json({
            success: true,
            conversation: convRows[0],
            messages
        });
    } catch (error) {
        console.error('Error fetching conversation details:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch conversation details' });
    }
});

/**
 * @route PUT /api/ai/admin/conversations/:id/status
 * @desc Update conversation status or lead status (hot, warm, cold, completed, handoff)
 */
router.put('/conversations/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status, lead_status, lead_score } = req.body;

        const [existing] = await db.query('SELECT id FROM ai_conversations WHERE id = ?', [id]);
        if (existing.length === 0) {
            return res.status(404).json({ success: false, error: 'Conversation not found' });
        }

        await db.query(
            `UPDATE ai_conversations SET
                status = COALESCE(?, status),
                lead_status = COALESCE(?, lead_status),
                lead_score = COALESCE(?, lead_score)
             WHERE id = ?`,
            [status || null, lead_status || null, lead_score !== undefined ? lead_score : null, id]
        );

        res.status(200).json({ success: true, message: 'Conversation status updated successfully' });
    } catch (error) {
        console.error('Error updating conversation status:', error);
        res.status(500).json({ success: false, error: 'Failed to update conversation status' });
    }
});

/**
 * @route GET /api/ai/admin/settings
 * @desc Get AI assistant settings for admin panel
 */
router.get('/settings', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM ai_settings LIMIT 1');
        if (rows.length === 0) {
            return res.status(200).json({
                success: true,
                settings: {
                    is_active: true,
                    bot_name: 'BTR AI Assistant',
                    welcome_message: '👋 Hello! I am BTR Communication\'s AI Assistant. How can I assist you with your project today?',
                    enable_lead_capture: true,
                    enable_pricing_answers: true,
                    enable_portfolio_answers: true,
                    enable_faq_answers: true,
                    enable_human_handoff: true,
                    system_prompt_override: ''
                }
            });
        }

        res.status(200).json({
            success: true,
            settings: rows[0]
        });
    } catch (error) {
        console.error('Error fetching admin AI settings:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch AI settings' });
    }
});

/**
 * @route PUT /api/ai/admin/settings
 * @desc Save AI assistant settings
 */
router.put('/settings', async (req, res) => {
    try {
        const {
            is_active,
            bot_name,
            welcome_message,
            enable_lead_capture,
            enable_pricing_answers,
            enable_portfolio_answers,
            enable_faq_answers,
            enable_human_handoff,
            system_prompt_override
        } = req.body;

        const [existing] = await db.query('SELECT id FROM ai_settings LIMIT 1');

        if (existing.length > 0) {
            await db.query(
                `UPDATE ai_settings SET
                    is_active = ?,
                    bot_name = ?,
                    welcome_message = ?,
                    enable_lead_capture = ?,
                    enable_pricing_answers = ?,
                    enable_portfolio_answers = ?,
                    enable_faq_answers = ?,
                    enable_human_handoff = ?,
                    system_prompt_override = ?
                 WHERE id = ?`,
                [
                    is_active !== undefined ? (is_active ? 1 : 0) : 1,
                    bot_name || 'BTR AI Assistant',
                    welcome_message || '',
                    enable_lead_capture !== undefined ? (enable_lead_capture ? 1 : 0) : 1,
                    enable_pricing_answers !== undefined ? (enable_pricing_answers ? 1 : 0) : 1,
                    enable_portfolio_answers !== undefined ? (enable_portfolio_answers ? 1 : 0) : 1,
                    enable_faq_answers !== undefined ? (enable_faq_answers ? 1 : 0) : 1,
                    enable_human_handoff !== undefined ? (enable_human_handoff ? 1 : 0) : 1,
                    system_prompt_override || null,
                    existing[0].id
                ]
            );
        } else {
            await db.query(
                `INSERT INTO ai_settings (
                    is_active, bot_name, welcome_message,
                    enable_lead_capture, enable_pricing_answers, enable_portfolio_answers,
                    enable_faq_answers, enable_human_handoff, system_prompt_override
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    is_active ? 1 : 0,
                    bot_name || 'BTR AI Assistant',
                    welcome_message || '',
                    enable_lead_capture ? 1 : 0,
                    enable_pricing_answers ? 1 : 0,
                    enable_portfolio_answers ? 1 : 0,
                    enable_faq_answers ? 1 : 0,
                    enable_human_handoff ? 1 : 0,
                    system_prompt_override || null
                ]
            );
        }

        res.status(200).json({ success: true, message: 'AI settings updated successfully' });
    } catch (error) {
        console.error('Error saving AI settings:', error);
        res.status(500).json({ success: false, error: 'Failed to update AI settings' });
    }
});

/**
 * @route GET /api/ai/admin/stats
 * @desc Overview metrics for AI assistant
 */
router.get('/stats', async (req, res) => {
    try {
        const [totalConv] = await db.query('SELECT COUNT(*) as count FROM ai_conversations');
        const [hotLeads] = await db.query("SELECT COUNT(*) as count FROM ai_conversations WHERE lead_status = 'hot'");
        const [warmLeads] = await db.query("SELECT COUNT(*) as count FROM ai_conversations WHERE lead_status = 'warm'");
        const [handoffRequests] = await db.query("SELECT COUNT(*) as count FROM ai_conversations WHERE status = 'handoff_requested'");

        res.status(200).json({
            success: true,
            totalConversations: totalConv[0].count,
            hotLeads: hotLeads[0].count,
            warmLeads: warmLeads[0].count,
            handoffRequests: handoffRequests[0].count
        });
    } catch (error) {
        console.error('Error fetching AI stats:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch AI stats' });
    }
});

module.exports = router;
