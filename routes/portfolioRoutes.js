// portfolio.js
const express = require('express');
const router = express.Router();
const db = require('../db'); 
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// --- Multer Setup ---

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = 'public/portfolio/images/';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `${file.fieldname}_${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|webp/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        if (mimetype && extname) return cb(null, true);
        cb(new Error('Only images (jpeg, jpg, png, webp) are allowed.'));
    }
});

// Middleware for handling two specific fields
const portfolioUpload = upload.fields([
    { name: 'thumbnail', maxCount: 1 },
    { name: 'logo', maxCount: 1 }
]);

// Helper: Cleanup files on error
const cleanupFiles = (files) => {
    if (!files) return;
    Object.values(files).forEach(fileArray => {
        fileArray.forEach(file => {
            if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        });
    });
};

// ----------------------------------------------------------------------
// ROUTES
// ----------------------------------------------------------------------

/**
 * @route POST /api/portfolio/create
 */
router.post('/create', portfolioUpload, async (req, res) => {
    try {
        const { title, description, project_url } = req.body;
        const files = req.files;

        if (!title || !files.thumbnail || !files.logo) {
            cleanupFiles(files);
            return res.status(400).json({ error: 'Title, Thumbnail, and Logo are required.' });
        }

        const thumbnailUrl = `/public/portfolio/images/${files.thumbnail[0].filename}`;
        const logoUrl = `/public/portfolio/images/${files.logo[0].filename}`;

        const query = `
            INSERT INTO admin_portfolio (title, description, thumbnail_url, logo_url, project_url) 
            VALUES (?, ?, ?, ?, ?)
        `;
        const [result] = await db.query(query, [title, description || null, thumbnailUrl, logoUrl, project_url || null]);

        res.status(201).json({ status: 201, message: 'Portfolio item created', id: result.insertId });
    } catch (error) {
        cleanupFiles(req.files);
        res.status(500).json({ error: 'Database failure' });
    }
});

/**
 * @route GET /api/portfolio
 */
router.get('/', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM admin_portfolio ORDER BY created_at DESC');
        res.json({ status: 200, data: rows });
    } catch (error) {
        res.status(500).json({ error: 'Fetch failed' });
    }
});


/**
 * @route GET /api/portfolio/:id
 */
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db.query('SELECT * FROM admin_portfolio WHERE id = ?', [id]);

        if (rows.length === 0) {
            return res.status(404).json({ 
                status: 404, 
                error: 'Portfolio item not found' 
            });
        }

        res.json({ 
            status: 200, 
            data: rows[0] // Return only the single object, not an array
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ 
            error: 'Failed to fetch portfolio item' 
        });
    }
});


/**
 * @route PUT /api/portfolio/update/:id
 */
router.put('/update/:id', portfolioUpload, async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, project_url } = req.body;
        const files = req.files;

        const [existing] = await db.query('SELECT * FROM admin_portfolio WHERE id = ?', [id]);
        if (existing.length === 0) {
            cleanupFiles(files);
            return res.status(404).json({ error: 'Not found' });
        }

        let updateData = { title, description, project_url };
        
        // Handle Thumbnail Update
        if (files && files.thumbnail) {
            const oldPath = path.join(__dirname, '..', existing[0].thumbnail_url);
            if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
            updateData.thumbnail_url = `/public/portfolio/images/${files.thumbnail[0].filename}`;
        }

        // Handle Logo Update
        if (files && files.logo) {
            const oldPath = path.join(__dirname, '..', existing[0].logo_url);
            if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
            updateData.logo_url = `/public/portfolio/images/${files.logo[0].filename}`;
        }

        const setClauses = Object.keys(updateData).map(key => `${key} = ?`).join(', ');
        const params = [...Object.values(updateData), id];

        await db.query(`UPDATE admin_portfolio SET ${setClauses} WHERE id = ?`, params);
        res.json({ status: 200, message: 'Portfolio updated successfully' });
    } catch (error) {
        cleanupFiles(req.files);
        res.status(500).json({ error: 'Update failed' });
    }
});

/**
 * @route DELETE /api/portfolio/delete/:id
 */
router.delete('/delete/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db.query('SELECT thumbnail_url, logo_url FROM admin_portfolio WHERE id = ?', [id]);
        
        if (rows.length > 0) {
            [rows[0].thumbnail_url, rows[0].logo_url].forEach(fileUrl => {
                const filePath = path.join(__dirname, '..', fileUrl);
                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            });
            await db.query('DELETE FROM admin_portfolio WHERE id = ?', [id]);
        }

        res.json({ status: 200, message: 'Deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Delete failed' });
    }
});

module.exports = router;