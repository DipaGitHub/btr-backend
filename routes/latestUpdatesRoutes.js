const express = require('express');
const router = express.Router();
// Assuming you have a database connection object exported from '../db'
// and it supports promise-based execution (e.g., mysql2/promise or a wrapper)
const db = require('../db'); 

// Table name based on your Canvas file
const TABLE_NAME = 'admin_latest_updates';

// --- API Endpoints for Latest Updates ---

// 1. CREATE New Update (POST /api/latestUpdates)
router.post('/', async (req, res) => {
    // Expected body: { title, description, update_date (optional, defaults to today) }
    const { title, description, update_date } = req.body;

    if (!title || !description) {
        return res.status(400).json({ success: false, message: 'Title and description are required.' });
    }

    try {
        const dateToUse = update_date || new Date().toISOString().split('T')[0];
        
        const [result] = await db.query(
            `INSERT INTO ${TABLE_NAME} (update_date, title, description) VALUES (?, ?, ?)`,
            [dateToUse, title, description]
        );

        res.status(201).json({ 
            success: true, 
            message: 'Latest update created successfully.', 
            id: result.insertId 
        });

    } catch (error) {
        console.error('Error creating latest update:', error);
        res.status(500).json({ success: false, message: 'Failed to create latest update.', error: error.message });
    }
});

// 2. READ ALL Updates (GET /api/latestUpdates)
router.get('/', async (req, res) => {
    try {
        // Order by date descending to show the newest updates first
        const [updates] = await db.query(
            `SELECT id, update_date, title, description FROM ${TABLE_NAME} ORDER BY update_date DESC`
        );

        res.status(200).json({ success: true, data: updates });

    } catch (error) {
        console.error('Error fetching all latest updates:', error);
        res.status(500).json({ success: false, message: 'Failed to retrieve updates.', error: error.message });
    }
});

// 3. READ Specific Update by ID (GET /api/latestUpdates/:id)
router.get('/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const [updates] = await db.query(
            `SELECT id, update_date, title, description FROM ${TABLE_NAME} WHERE id = ?`,
            [id]
        );

        if (updates.length === 0) {
            return res.status(404).json({ success: false, message: 'Update not found.' });
        }

        res.status(200).json({ success: true, data: updates[0] });

    } catch (error) {
        console.error(`Error fetching update with ID ${id}:`, error);
        res.status(500).json({ success: false, message: 'Failed to retrieve update.', error: error.message });
    }
});

// 4. UPDATE Existing Update (PUT /api/latestUpdates/:id)
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    // Expected body: { title, description, update_date }
    const { title, description, update_date } = req.body;

    if (!title && !description && !update_date) {
        return res.status(400).json({ success: false, message: 'At least one field (title, description, or update_date) is required for update.' });
    }

    try {
        // Dynamically build the query to update only the fields present in the request body
        let queryParts = [];
        let queryValues = [];

        if (title) {
            queryParts.push('title = ?');
            queryValues.push(title);
        }
        if (description) {
            queryParts.push('description = ?');
            queryValues.push(description);
        }
        if (update_date) {
            queryParts.push('update_date = ?');
            queryValues.push(update_date);
        }

        if (queryParts.length === 0) {
             return res.status(400).json({ success: false, message: 'No valid fields provided for update.' });
        }

        // Add the ID to the end of the values array for the WHERE clause
        queryValues.push(id);

        const query = `UPDATE ${TABLE_NAME} SET ${queryParts.join(', ')} WHERE id = ?`;
        const [result] = await db.query(query, queryValues);

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Update not found or no changes made.' });
        }

        res.status(200).json({ success: true, message: 'Latest update updated successfully.' });

    } catch (error) {
        console.error(`Error updating update with ID ${id}:`, error);
        res.status(500).json({ success: false, message: 'Failed to update latest update.', error: error.message });
    }
});

// 5. DELETE Update by ID (DELETE /api/latestUpdates/:id)
router.delete('/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const [result] = await db.query(
            `DELETE FROM ${TABLE_NAME} WHERE id = ?`,
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Update not found.' });
        }

        res.status(200).json({ success: true, message: 'Latest update deleted successfully.' });

    } catch (error) {
        console.error(`Error deleting update with ID ${id}:`, error);
        res.status(500).json({ success: false, message: 'Failed to delete update.', error: error.message });
    }
});

module.exports = router;