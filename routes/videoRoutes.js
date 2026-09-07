const express = require('express');
const router = express.Router();
const db = require('../db'); // Assuming this is set up for Promises (like mysql2/promise)

// --- GET All Videos and Search (/api/videos) ---
router.get('/', async (req, res) => {
    try {
        const { search } = req.query;
        let sql = 'SELECT id, title, youtube_video_id, enable_home_page, created_at FROM admin_videos ORDER BY created_at DESC';
        let values = [];

        if (search) {
            sql = 'SELECT id, title, youtube_video_id, enable_home_page, created_at FROM admin_videos WHERE title LIKE ? OR youtube_video_id LIKE ? ORDER BY created_at DESC';
            const searchTerm = `%${search}%`;
            values = [searchTerm, searchTerm];
        }

        // --- FIXED: Use await/Promise style query ---
        const [results] = await db.query(sql, values);

        res.status(200).json({
            status: 200,
            message: 'Videos fetched successfully',
            data: results,
            total: results.length
        });

    } catch (err) {
        console.error('Error fetching videos:', err);
        return res.status(500).json({ status: 500, message: 'Failed to fetch videos.', error: err.message });
    }
});

// --- GET Single Video (/api/videos/:id) ---
router.get('/:id', async (req, res) => {
    try {
        const videoId = req.params.id;
        const sql = 'SELECT id, title, youtube_video_id, enable_home_page FROM admin_videos WHERE id = ?';

        // --- FIXED: Use await/Promise style query ---
        const [results] = await db.query(sql, [videoId]);

        if (results.length === 0) {
            return res.status(404).json({ status: 404, message: 'Video not found.' });
        }
        res.status(200).json({
            status: 200,
            message: 'Video fetched successfully',
            data: results[0]
        });

    } catch (err) {
        console.error('Error fetching single video:', err);
        return res.status(500).json({ status: 500, message: 'Failed to fetch video.', error: err.message });
    }
});

// --- CREATE Video (/api/videos/create) ---
router.post('/create', async (req, res) => {
    try {
        const { title, youtubeVideoId, enableHomePage } = req.body;

        if (!title || !youtubeVideoId) {
            return res.status(400).json({ status: 400, message: 'Title and Youtube Video Id are required.' });
        }

        const sql = 'INSERT INTO admin_videos (title, youtube_video_id, enable_home_page) VALUES (?, ?, ?)';
        const values = [title, youtubeVideoId, enableHomePage || false];

        // --- FIXED: Use await/Promise style query ---
        const [result] = await db.query(sql, values);
        
        res.status(201).json({
            status: 201,
            message: 'Video created successfully!',
            videoId: result.insertId
        });

    } catch (err) {
        console.error('Error creating video:', err);
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ status: 409, message: 'This YouTube Video ID already exists.' });
        }
        return res.status(500).json({ status: 500, message: 'Failed to create video.', error: err.message });
    }
});

// --- UPDATE Video (/api/videos/update/:id) ---
router.put('/update/:id', async (req, res) => {
    try {
        const videoId = req.params.id;
        const { title, youtubeVideoId, enableHomePage } = req.body;
        
        if (!title || !youtubeVideoId) {
            return res.status(400).json({ status: 400, message: 'Title and Youtube Video Id are required.' });
        }

        const sql = 'UPDATE admin_videos SET title = ?, youtube_video_id = ?, enable_home_page = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
        const values = [title, youtubeVideoId, enableHomePage || false, videoId];

        // --- FIXED: Use await/Promise style query ---
        const [result] = await db.query(sql, values);

        if (result.affectedRows === 0) {
            return res.status(404).json({ status: 404, message: 'Video not found or no changes made.' });
        }
        res.status(200).json({
            status: 200,
            message: 'Video updated successfully!'
        });

    } catch (err) {
        console.error('Error updating video:', err);
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ status: 409, message: 'This YouTube Video ID already exists.' });
        }
        return res.status(500).json({ status: 500, message: 'Failed to update video.', error: err.message });
    }
});

// --- DELETE Multiple Videos (/api/videos/delete-multiple) ---
router.post('/delete-multiple', async (req, res) => {
    try {
        const { ids } = req.body;

        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ status: 400, message: 'An array of video IDs is required.' });
        }

        const sql = `DELETE FROM admin_videos WHERE id IN (?)`;
        
        // --- FIXED: Use await/Promise style query ---
        const [result] = await db.query(sql, [ids]);

        res.status(200).json({
            status: 200,
            message: `${result.affectedRows} video(s) deleted successfully.`
        });

    } catch (err) {
        console.error('Error deleting videos:', err);
        return res.status(500).json({ status: 500, message: 'Failed to delete videos.', error: err.message });
    }
});

// --- PATCH Toggle Home Page Status (/api/videos/toggle-home/:id) ---
router.patch('/toggle-home/:id', async (req, res) => {
    try {
        const videoId = req.params.id;
        
        const sql = 'UPDATE admin_videos SET enable_home_page = NOT enable_home_page WHERE id = ?';

        // --- FIXED: Use await/Promise style query ---
        const [result] = await db.query(sql, [videoId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ status: 404, message: 'Video not found.' });
        }
        res.status(200).json({
            status: 200,
            message: 'Video home page status toggled successfully.'
        });

    } catch (err) {
        console.error('Error toggling video status:', err);
        return res.status(500).json({ status: 500, message: 'Failed to toggle video status.', error: err.message });
    }
});

module.exports = router;