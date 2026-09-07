const express = require('express');
const router = express.Router();
const db = require('../db');
const sendEmail = require('../utils/sendEmail');

/**
 * @route GET /api/leads
 * @desc Get all leads, optionally filter by search term
 */
router.get('/', async (req, res) => {
    try {
        const { search } = req.query;
        let query = 'SELECT * FROM admin_leads ORDER BY created_at DESC';
        let params = [];
        
        if (search) {
            query = 'SELECT * FROM admin_leads WHERE name LIKE ? OR email LIKE ? OR phone LIKE ? OR service LIKE ? ORDER BY created_at DESC';
            const searchTerm = `%${search}%`;
            params = [searchTerm, searchTerm, searchTerm, searchTerm];
        }

        const [leads] = await db.query(query, params);
        res.status(200).json({ status: 200, data: leads });
    } catch (error) {
        console.error('Error fetching leads:', error);
        res.status(500).json({ status: 500, error: 'Failed to fetch leads.' });
    }
});

/**
 * @route POST /api/leads/create
 * @desc Create a new lead (used by frontend website)
 */
router.post('/create', async (req, res) => {
    try {
        const { name, email, phone, service, pricing_plan, source, chat_transcript } = req.body;
        
        if (!name || !email || !phone || !service) {
            return res.status(400).json({ status: 400, error: 'Name, email, phone, and service are required.' });
        }

        const [result] = await db.query(
            'INSERT INTO admin_leads (name, email, phone, service, pricing_plan, source, chat_transcript) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [name, email, phone, service, pricing_plan || null, source || 'website', chat_transcript || null]
        );

        // Send email notification asynchronously
        sendEmail({
            subject: `New Lead: ${name} (${service})`,
            html: `
                <h3>New Lead Submission</h3>
                <p><strong>Name:</strong> ${name}</p>
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Phone:</strong> ${phone}</p>
                <p><strong>Service:</strong> ${service}</p>
                ${pricing_plan ? `<p><strong>Plan:</strong> ${pricing_plan}</p>` : ''}
                <p><strong>Source:</strong> ${source || 'website'}</p>
                ${chat_transcript ? `<p><strong>Chat Transcript:</strong></p><pre>${chat_transcript}</pre>` : ''}
            `
        });

        res.status(201).json({ status: 201, message: 'Lead created successfully', id: result.insertId });
    } catch (error) {
        console.error('Error creating lead:', error);
        res.status(500).json({ status: 500, error: 'Failed to create lead.' });
    }
});

/**
 * @route DELETE /api/leads/:id
 * @desc Delete a lead
 */
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await db.query('DELETE FROM admin_leads WHERE id = ?', [id]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ status: 404, error: 'Lead not found.' });
        }
        
        res.status(200).json({ status: 200, message: 'Lead deleted successfully' });
    } catch (error) {
        console.error('Error deleting lead:', error);
        res.status(500).json({ status: 500, error: 'Failed to delete lead.' });
    }
});

module.exports = router;
