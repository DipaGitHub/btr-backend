const db = require('../db');

// GET /api/chat/config - Public: fetches active topics (with service name) + questions
exports.getChatConfig = async (req, res) => {
    try {
        const [topics] = await db.query(`
            SELECT ct.id, ct.service_id, ct.is_active, ct.order_index,
                   ct.chat_label, s.name as service_name
            FROM chat_topics ct
            JOIN admin_services s ON ct.service_id = s.id
            WHERE ct.is_active = true
            ORDER BY ct.order_index ASC
        `);
        
        const [questions] = await db.query(`
            SELECT cq.id, cq.topic_id, cq.question_text, cq.order_index
            FROM chat_questions cq
            JOIN chat_topics ct ON cq.topic_id = ct.id
            WHERE ct.is_active = true
            ORDER BY cq.order_index ASC
        `);
        
        res.status(200).json({ status: 200, topics, questions });
    } catch (error) {
        console.error('Error fetching chat config:', error);
        res.status(500).json({ status: 500, error: 'Failed to fetch chat config.' });
    }
};

// GET /api/chat/admin/config - Admin: fetches all services with their topic/activation status
exports.getAdminConfig = async (req, res) => {
    try {
        const [services] = await db.query(`
            SELECT s.id, s.name, s.is_active as service_active,
                   ct.id as topic_id, ct.is_active as chat_active, ct.order_index, ct.chat_label
            FROM admin_services s
            LEFT JOIN chat_topics ct ON ct.service_id = s.id
            WHERE s.is_active = 1
            ORDER BY s.display_order ASC
        `);
        
        const [questions] = await db.query(`
            SELECT * FROM chat_questions ORDER BY topic_id ASC, order_index ASC
        `);
        
        res.status(200).json({ status: 200, services, questions });
    } catch (error) {
        console.error('Error fetching admin chat config:', error);
        res.status(500).json({ status: 500, error: 'Failed to fetch admin chat config.' });
    }
};

// POST /api/chat/admin/topics/toggle - Toggle service in/out of chat
exports.toggleTopic = async (req, res) => {
    try {
        const { service_id, chat_label } = req.body;
        if (!service_id) return res.status(400).json({ status: 400, error: 'service_id is required.' });
        
        const [existing] = await db.query('SELECT * FROM chat_topics WHERE service_id = ?', [service_id]);
        
        if (existing.length > 0) {
            // Toggle is_active; also update label if provided
            if (chat_label !== undefined) {
                await db.query('UPDATE chat_topics SET is_active = NOT is_active, chat_label = ? WHERE service_id = ?', [chat_label, service_id]);
            } else {
                await db.query('UPDATE chat_topics SET is_active = NOT is_active WHERE service_id = ?', [service_id]);
            }
            const newState = !existing[0].is_active;
            res.status(200).json({ status: 200, message: `Service ${newState ? 'enabled' : 'disabled'} in chat.`, topic_id: existing[0].id });
        } else {
            const [result] = await db.query(
                'INSERT INTO chat_topics (service_id, is_active, chat_label) VALUES (?, true, ?)',
                [service_id, chat_label || null]
            );
            res.status(201).json({ status: 201, message: 'Service added to chat.', topic_id: result.insertId });
        }
    } catch (error) {
        console.error('Error toggling topic:', error);
        res.status(500).json({ status: 500, error: 'Failed to toggle topic.' });
    }
};

// POST /api/chat/admin/questions - Add question to a topic
exports.createQuestion = async (req, res) => {
    try {
        const { topic_id, question_text, order_index } = req.body;
        if (!topic_id || !question_text) {
            return res.status(400).json({ status: 400, error: 'topic_id and question_text are required.' });
        }
        const [result] = await db.query(
            'INSERT INTO chat_questions (topic_id, question_text, order_index) VALUES (?, ?, ?)',
            [topic_id, question_text, order_index || 0]
        );
        res.status(201).json({ status: 201, message: 'Question created.', id: result.insertId });
    } catch (error) {
        console.error('Error creating question:', error);
        res.status(500).json({ status: 500, error: 'Failed to create question.' });
    }
};

// DELETE /api/chat/admin/questions/:id
exports.deleteQuestion = async (req, res) => {
    try {
        const { id } = req.params;
        await db.query('DELETE FROM chat_questions WHERE id = ?', [id]);
        res.status(200).json({ status: 200, message: 'Question deleted.' });
    } catch (error) {
        console.error('Error deleting question:', error);
        res.status(500).json({ status: 500, error: 'Failed to delete question.' });
    }
};

// PUT /api/chat/admin/topics/label - Update custom chat label for a topic
exports.updateTopicLabel = async (req, res) => {
    try {
        const { service_id, chat_label } = req.body;
        if (!service_id) return res.status(400).json({ status: 400, error: 'service_id is required.' });
        await db.query('UPDATE chat_topics SET chat_label = ? WHERE service_id = ?', [chat_label || null, service_id]);
        res.status(200).json({ status: 200, message: 'Label updated.' });
    } catch (error) {
        console.error('Error updating label:', error);
        res.status(500).json({ status: 500, error: 'Failed to update label.' });
    }
};
