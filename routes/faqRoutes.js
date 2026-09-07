const express = require('express');
const router = express.Router();
const db = require('../db'); // Assuming the database connection is located here

// --- NO IMAGE HANDLING NEEDED ---
// Since the admin_faq table only stores text (qus and answers), 
// we do not need multer, path, or fs for file uploads/deletion.

/**
 * @route POST /api/faqs/create
 * @desc Create a new FAQ entry
 */
router.post('/create', async (req, res) => {
    try {
        const { qus, answers } = req.body;

        if (!qus || !answers) {
            return res.status(400).json({
                status: 400,
                error: 'Question (qus) and Answer (answers) are required.'
            });
        }

        // Insert the new FAQ into the database
        const [result] = await db.query(
            `INSERT INTO admin_faq (qus, answers) VALUES (?, ?)`,
            [qus, answers]
        );

        res.status(201).json({
            status: 201,
            message: 'FAQ entry created successfully',
            faqId: result.insertId
        });

    } catch (error) {
        console.error('Error creating FAQ:', error);
        res.status(500).json({
            status: 500,
            error: 'Failed to create FAQ entry.'
        });
    }
});

/**
 * @route GET /api/faqs
 * @desc Get all FAQs with optional search functionality
 */
router.get('/', async (req, res) => {
    try {
        const { search } = req.query;
        let query = 'SELECT * FROM admin_faq';
        let params = [];

        // Build query for searching against 'qus' or 'answers'
        if (search) {
            query += ' WHERE qus LIKE ? OR answers LIKE ?';
            params.push(`%${search}%`, `%${search}%`);
        }

        query += ' ORDER BY id DESC'; // Order by the latest created (highest ID)

        const [faqs] = await db.query(query, params);

        res.status(200).json({
            status: 200,
            message: 'FAQs fetched successfully',
            data: faqs,
            total: faqs.length
        });

    } catch (error) {
        console.error('Error fetching FAQs:', error);
        res.status(500).json({
            status: 500,
            error: 'Failed to fetch FAQs.'
        });
    }
});

/**
 * @route GET /api/faqs/:id
 * @desc Get a single FAQ entry by ID
 */
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const [faqs] = await db.query('SELECT * FROM admin_faq WHERE id = ?', [id]);

        if (faqs.length === 0) {
            return res.status(404).json({
                status: 404,
                error: 'FAQ entry not found.'
            });
        }

        res.status(200).json({
            status: 200,
            message: 'FAQ entry fetched successfully',
            data: faqs[0]
        });

    } catch (error) {
        console.error('Error fetching FAQ entry:', error);
        res.status(500).json({
            status: 500,
            error: 'Failed to fetch FAQ entry.'
        });
    }
});

/**
 * @route PUT /api/faqs/update/:id
 * @desc Update an FAQ entry
 */
router.put('/update/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { qus, answers } = req.body;

        // Check if FAQ exists
        const [existingFaqs] = await db.query('SELECT * FROM admin_faq WHERE id = ?', [id]);

        if (existingFaqs.length === 0) {
            return res.status(404).json({
                status: 404,
                error: 'FAQ entry not found.'
            });
        }

        const existingFaq = existingFaqs[0];

        // Determine values to use (use existing if new is not provided)
        const newQus = qus !== undefined ? qus : existingFaq.qus;
        const newAnswers = answers !== undefined ? answers : existingFaq.answers;
        
        // Ensure at least one field is provided for update
        if (qus === undefined && answers === undefined) {
             return res.status(400).json({
                status: 400,
                error: 'At least one field (qus or answers) is required for update.'
            });
        }

        // Update FAQ in database
        const [result] = await db.query(
            `UPDATE admin_faq SET qus = ?, answers = ? WHERE id = ?`,
            [newQus, newAnswers, id]
        );
        
        if (result.affectedRows === 0) {
             return res.status(404).json({
                status: 404,
                error: 'FAQ entry not found or no changes made.'
            });
        }

        res.status(200).json({
            status: 200,
            message: 'FAQ entry updated successfully'
        });

    } catch (error) {
        console.error('Error updating FAQ entry:', error);
        res.status(500).json({
            status: 500,
            error: 'Failed to update FAQ entry.'
        });
    }
});

/**
 * @route DELETE /api/faqs/delete/:id
 * @desc Delete a single FAQ entry
 */
router.delete('/delete/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Delete from database
        const [result] = await db.query('DELETE FROM admin_faq WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                status: 404,
                error: 'FAQ entry not found.'
            });
        }

        res.status(200).json({
            status: 200,
            message: 'FAQ entry deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting FAQ entry:', error);
        res.status(500).json({
            status: 500,
            error: 'Failed to delete FAQ entry.'
        });
    }
});

/**
 * @route POST /api/faqs/delete-multiple
 * @desc Delete multiple FAQ entries
 */
router.post('/delete-multiple', async (req, res) => {
    try {
        const { ids } = req.body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({
                status: 400,
                error: 'No FAQ IDs provided.'
            });
        }

        // Create placeholders for the IN clause
        const placeholders = ids.map(() => '?').join(',');

        // Delete from database
        const [result] = await db.query(`DELETE FROM admin_faq WHERE id IN (${placeholders})`, ids);

        res.status(200).json({
            status: 200,
            message: `${result.affectedRows} FAQ entry(s) deleted successfully`,
            deletedCount: result.affectedRows
        });

    } catch (error) {
        console.error('Error deleting multiple FAQs:', error);
        res.status(500).json({
            status: 500,
            error: 'Failed to delete multiple FAQs.'
        });
    }
});

module.exports = router;