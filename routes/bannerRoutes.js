const express = require('express');
const router = express.Router();
const db = require('../db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Set up Multer for image uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = 'public/banners/';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 1 * 1024 * 1024 // 1MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'));
        }
    }
});

/**
 * @route POST /api/banners/create
 * @desc Create a new banner
 */
router.post('/create', upload.single('image'), async (req, res) => {
    try {
        const { title, enableMobileDevice, subtitles } = req.body;
        
        if (!title || !req.file) {
            return res.status(400).json({ 
                status: 400,
                error: 'Title and image are required.' 
            });
        }

        // Construct the image URL
        const imageUrl = `/public/banners/${req.file.filename}`;
        const isMobileEnabled = enableMobileDevice === 'true' || enableMobileDevice === true;
        const parsedSubtitles = subtitles ? subtitles : '[]';

        // Insert the new banner into the database
        const [result] = await db.query(
            `INSERT INTO admin_banners (title, image_url, is_mobile_enabled, subtitles) VALUES (?, ?, ?, ?)`,
            [title, imageUrl, isMobileEnabled, parsedSubtitles]
        );

        res.status(201).json({ 
            status: 201,
            message: 'Banner created successfully',
            bannerId: result.insertId 
        });

    } catch (error) {
        console.error('Error creating banner:', error);
        
        // Delete uploaded file if error occurs
        if (req.file) {
            fs.unlinkSync(req.file.path);
        }
        
        res.status(500).json({ 
            status: 500,
            error: 'Failed to create banner.' 
        });
    }
});

/**
 * @route GET /api/banners
 * @desc Get all banners with search and filter functionality
 */
router.get('/', async (req, res) => {
    try {
        const { search, mobileEnabled } = req.query;
        let query = 'SELECT * FROM admin_banners';
        let params = [];

        // Build query based on filters
        const conditions = [];
        
        if (search) {
            conditions.push('title LIKE ?');
            params.push(`%${search}%`);
        }
        
        if (mobileEnabled !== undefined) {
            conditions.push('is_mobile_enabled = ?');
            params.push(mobileEnabled === 'true');
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        query += ' ORDER BY created_at DESC';

        const [banners] = await db.query(query, params);

        res.status(200).json({
            status: 200,
            message: 'Banners fetched successfully',
            data: banners,
            total: banners.length
        });

    } catch (error) {
        console.error('Error fetching banners:', error);
        res.status(500).json({
            status: 500,
            error: 'Failed to fetch banners.'
        });
    }
});

/**
 * @route GET /api/banners/:id
 * @desc Get a single banner by ID
 */
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const [banners] = await db.query('SELECT * FROM admin_banners WHERE id = ?', [id]);

        if (banners.length === 0) {
            return res.status(404).json({ 
                status: 404,
                error: 'Banner not found.' 
            });
        }

        res.status(200).json({
            status: 200,
            message: 'Banner fetched successfully',
            data: banners[0]
        });

    } catch (error) {
        console.error('Error fetching banner:', error);
        res.status(500).json({
            status: 500,
            error: 'Failed to fetch banner.'
        });
    }
});

/**
 * @route PUT /api/banners/update/:id
 * @desc Update a banner
 */
router.put('/update/:id', upload.single('image'), async (req, res) => {
    try {
        const { id } = req.params;
        const { title, enableMobileDevice, subtitles } = req.body;

        // Check if banner exists
        const [existingBanners] = await db.query('SELECT * FROM admin_banners WHERE id = ?', [id]);
        
        if (existingBanners.length === 0) {
            return res.status(404).json({ 
                status: 404,
                error: 'Banner not found.' 
            });
        }

        const existingBanner = existingBanners[0];
        let imageUrl = existingBanner.image_url;
        const isMobileEnabled = enableMobileDevice === 'true' || enableMobileDevice === true;

        // If new image is uploaded, update image URL and delete old image
        if (req.file) {
            // Delete old image file
            const oldImagePath = path.join(__dirname, '..', existingBanner.image_url);
            if (fs.existsSync(oldImagePath)) {
                fs.unlinkSync(oldImagePath);
            }
            
            // Set new image URL
            imageUrl = `/public/banners/${req.file.filename}`;
        }

        const parsedSubtitles = subtitles ? subtitles : existingBanner.subtitles;

        // Update banner in database
        const [result] = await db.query(
            `UPDATE admin_banners SET title = ?, image_url = ?, is_mobile_enabled = ?, subtitles = ? WHERE id = ?`,
            [title || existingBanner.title, imageUrl, isMobileEnabled, parsedSubtitles, id]
        );

        res.status(200).json({ 
            status: 200,
            message: 'Banner updated successfully'
        });

    } catch (error) {
        console.error('Error updating banner:', error);
        
        // Delete uploaded file if error occurs
        if (req.file) {
            fs.unlinkSync(req.file.path);
        }
        
        res.status(500).json({ 
            status: 500,
            error: 'Failed to update banner.' 
        });
    }
});

/**
 * @route PATCH /api/banners/toggle-mobile/:id
 * @desc Toggle mobile enable status for a banner
 */
router.patch('/toggle-mobile/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const [result] = await db.query(
            `UPDATE admin_banners SET is_mobile_enabled = NOT is_mobile_enabled WHERE id = ?`,
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ 
                status: 404,
                error: 'Banner not found.' 
            });
        }

        res.status(200).json({ 
            status: 200,
            message: 'Mobile status toggled successfully'
        });

    } catch (error) {
        console.error('Error toggling mobile status:', error);
        res.status(500).json({ 
            status: 500,
            error: 'Failed to toggle mobile status.' 
        });
    }
});

/**
 * @route DELETE /api/banners/delete/:id
 * @desc Delete a single banner
 */
router.delete('/delete/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Fetch the banner first to get image URL
        const [banners] = await db.query('SELECT image_url FROM admin_banners WHERE id = ?', [id]);
        
        if (banners.length === 0) {
            return res.status(404).json({ 
                status: 404,
                error: 'Banner not found.' 
            });
        }

        const banner = banners[0];

        // Delete from database
        const [result] = await db.query('DELETE FROM admin_banners WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ 
                status: 404,
                error: 'Banner not found.' 
            });
        }

        // Delete the image file
        const imagePath = path.join(__dirname, '..', banner.image_url);
        if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
        }

        res.status(200).json({ 
            status: 200,
            message: 'Banner deleted successfully' 
        });

    } catch (error) {
        console.error('Error deleting banner:', error);
        res.status(500).json({ 
            status: 500,
            error: 'Failed to delete banner.' 
        });
    }
});

/**
 * @route POST /api/banners/delete-multiple
 * @desc Delete multiple banners
 */
router.post('/delete-multiple', async (req, res) => {
    try {
        const { ids } = req.body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ 
                status: 400,
                error: 'No banner IDs provided.' 
            });
        }

        // Fetch banners to get image URLs
        const placeholders = ids.map(() => '?').join(',');
        const [banners] = await db.query(`SELECT id, image_url FROM admin_banners WHERE id IN (${placeholders})`, ids);

        // Delete from database
        const [result] = await db.query(`DELETE FROM admin_banners WHERE id IN (${placeholders})`, ids);

        // Delete image files
        banners.forEach(banner => {
            const imagePath = path.join(__dirname, '..', banner.image_url);
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
            }
        });

        res.status(200).json({ 
            status: 200,
            message: `${result.affectedRows} banner(s) deleted successfully` 
        });

    } catch (error) {
        console.error('Error deleting multiple banners:', error);
        res.status(500).json({ 
            status: 500,
            error: 'Failed to delete banners.' 
        });
    }
});

module.exports = router;