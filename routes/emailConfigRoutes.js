const express = require('express');
const router = express.Router();
const db = require('../db');

/**
 * @route GET /api/email-config
 * @desc Get email configuration
 */
router.get('/', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM admin_email_config LIMIT 1');
        if (rows.length === 0) {
            return res.status(200).json({ status: 200, data: {} });
        }
        res.status(200).json({ status: 200, data: rows[0] });
    } catch (error) {
        console.error('Error fetching email config:', error);
        res.status(500).json({ status: 500, error: 'Failed to fetch email config.' });
    }
});

/**
 * @route PUT /api/email-config
 * @desc Update email configuration
 */
router.put('/', async (req, res) => {
    try {
        const { host, port, username, password, receive_emails_at } = req.body;

        const [rows] = await db.query('SELECT * FROM admin_email_config LIMIT 1');
        if (rows.length === 0) {
            await db.query(
                'INSERT INTO admin_email_config (host, port, username, password, receive_emails_at) VALUES (?, ?, ?, ?, ?)',
                [host, port, username, password, receive_emails_at]
            );
        } else {
            await db.query(
                'UPDATE admin_email_config SET host = ?, port = ?, username = ?, password = ?, receive_emails_at = ? WHERE id = ?',
                [host, port, username, password, receive_emails_at, rows[0].id]
            );
        }

        res.status(200).json({ status: 200, message: 'Email config updated successfully' });
    } catch (error) {
        console.error('Error updating email config:', error);
        res.status(500).json({ status: 500, error: 'Failed to update email config.' });
    }
});

module.exports = router;
