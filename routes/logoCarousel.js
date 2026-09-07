const express = require('express');
const router = express.Router();
const db = require('../db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Set up Multer for logo uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = 'public/logos/';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, 'logo-' + Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 1 * 1024 * 1024 }, // 1MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp|svg/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (mimetype && extname) return cb(null, true);
        cb(new Error('Only image files are allowed'));
    }
});

/**
 * @route   POST /api/logo-carousel/create
 * @desc    Add a new logo
 */
router.post('/create', upload.single('image'), async (req, res) => {
    try {
        const { title } = req.body;
        if (!title || !req.file) {
            return res.status(400).json({ status: 400, error: 'Title and image are required.' });
        }

        const imageUrl = `/public/logos/${req.file.filename}`;
        const [result] = await db.query(
            `INSERT INTO logo_carousel (title, image_url) VALUES (?, ?)`,
            [title, imageUrl]
        );

        res.status(201).json({ status: 201, message: 'Logo added successfully', id: result.insertId });
    } catch (error) {
        if (req.file) fs.unlinkSync(req.file.path);
        res.status(500).json({ status: 500, error: 'Internal Server Error' });
    }
});

/**
 * @route   GET /api/logo-carousel
 * @desc    Get all logos
 */
router.get('/', async (req, res) => {
    try {
        const [logos] = await db.query('SELECT * FROM logo_carousel ORDER BY created_at DESC');
        res.status(200).json({ status: 200, data: logos });
    } catch (error) {
        res.status(500).json({ status: 500, error: 'Failed to fetch logos' });
    }
});

/**
 * @route   DELETE /api/logo-carousel/:id
 * @desc    Delete a logo and its file
 */
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [logos] = await db.query('SELECT image_url FROM logo_carousel WHERE id = ?', [id]);
        
        if (logos.length === 0) return res.status(404).json({ status: 404, error: 'Logo not found' });

        // Delete from DB
        await db.query('DELETE FROM logo_carousel WHERE id = ?', [id]);

        // Delete File
        const imagePath = path.join(__dirname, '..', logos[0].image_url);
        if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);

        res.status(200).json({ status: 200, message: 'Logo deleted successfully' });
    } catch (error) {
        res.status(500).json({ status: 500, error: 'Deletion failed' });
    }
});

module.exports = router;