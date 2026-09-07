/**
 * Testimonial API Routes (Express.js with MySQL and Multer)
 *
 * This file implements CRUD operations for the 'admin_testimonials' table
 * using MySQL queries and includes Multer for handling the image_url field.
 */

const express = require('express');
const router = express.Router();
const db = require('../db'); // Assuming Promise-based MySQL connection
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// --- UTILITIES ---

// Utility function for Express error handling (consistent with your service routes)
const asyncWrapper = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

// Helper to remove files on error
const cleanupFile = (filePath) => {
    if (!filePath || !fs.existsSync(filePath)) return;
    try {
        fs.unlinkSync(filePath);
    } catch (e) {
        console.error('Failed to cleanup file:', e.message);
    }
};

// --- MULTER SETUP (Handles single 'imageUpload' field) ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // NOTE: Ensure this directory exists relative to your server root
        const uploadDir = 'public/testimonials/';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, 'testimonial-' + Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 1 * 1024 * 1024 }, // 1MB limit for the testimonial image
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only image files (JPEG, PNG, GIF, WEBP) are allowed.'));
        }
    }
});

const uploadSingleImage = upload.single('imageUpload'); // Field name for the file input

// ====================================================================
// PUBLIC ROUTES (Fetch Active Testimonials)
// ====================================================================

// @route   GET /api/testimonials
// @desc    Get all active testimonials, ordered by display_order
// @access  Public
router.get('/', asyncWrapper(async (req, res) => {
    const query = `
        SELECT comment, review_stars, client_name, client_position, client_company, image_url 
        FROM admin_testimonials 
        WHERE is_active = 1 
        ORDER BY display_order ASC, id DESC
    `;
    const [testimonials] = await db.query(query);

    res.status(200).json({ 
        status: 200, 
        message: 'Active testimonials fetched successfully', 
        data: testimonials 
    });
}));


// ====================================================================
// ADMIN ROUTES (CRUD Operations)
// ====================================================================

// @route   GET /api/testimonials/admin
// @desc    Get all testimonials (active and inactive) for admin panel
// @access  Private (Admin) - Placeholder route, authentication needed in a real app
router.get('/admin', asyncWrapper(async (req, res) => {
    const query = `
        SELECT id, comment, review_stars, client_name, client_position, client_company, image_url, is_active, display_order 
        FROM admin_testimonials 
        ORDER BY display_order ASC, id DESC
    `;
    const [testimonials] = await db.query(query);

    res.status(200).json({ 
        status: 200, 
        message: 'All testimonials fetched successfully', 
        data: testimonials 
    });
}));

// @route   GET /api/testimonials/admin/:id
// @desc    Get a single testimonial by ID
// @access  Private (Admin)
router.get('/admin/:id', asyncWrapper(async (req, res) => {
    const { id } = req.params;
    const query = 'SELECT * FROM admin_testimonials WHERE id = ?';
    const [testimonial] = await db.query(query, [id]);

    if (testimonial.length === 0) {
        return res.status(404).json({ status: 404, error: `Testimonial with id ${id} not found` });
    }

    res.status(200).json({ status: 200, data: testimonial[0] });
}));


// @route   POST /api/testimonials/admin/create
// @desc    Create a new testimonial with an optional image upload
// @access  Private (Admin)
router.post('/admin/create', uploadSingleImage, async (req, res) => {
    try {
        const { 
            comment, review_stars, client_name, 
            client_position, client_company, is_active, display_order 
        } = req.body;

        // Basic validation
        if (!comment || !client_name) {
            cleanupFile(req.file?.path);
            return res.status(400).json({ status: 400, error: 'Comment and Client Name are required.' });
        }

        const imageUrl = req.file ? `/public/testimonials/${req.file.filename}` : null;
        const isActive = is_active === 'true' || is_active === true;

        const query = `
            INSERT INTO admin_testimonials 
            (comment, review_stars, client_name, client_position, client_company, image_url, is_active, display_order) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const values = [
            comment, review_stars || 5, client_name, 
            client_position || null, client_company || null, imageUrl, 
            isActive, display_order || null
        ];

        const [result] = await db.query(query, values);

        res.status(201).json({ 
            status: 201, 
            message: 'Testimonial created successfully', 
            id: result.insertId 
        });

    } catch (error) {
        console.error('Error creating testimonial:', error);
        cleanupFile(req.file?.path);
        res.status(500).json({ status: 500, error: 'Failed to create testimonial.', details: error.message });
    }
});

// @route   PUT /api/testimonials/admin/update/:id
// @desc    Update an existing testimonial with an optional image upload
// @access  Private (Admin)
router.put('/admin/update/:id', uploadSingleImage, async (req, res) => {
    try {
        const { id } = req.params;
        const { 
            comment, review_stars, client_name, 
            client_position, client_company, is_active, display_order, 
            keep_existing_image // Flag to indicate if existing image should be kept if no new file is uploaded
        } = req.body;

        // 1. Fetch existing testimonial details
        const [existingTestimonials] = await db.query('SELECT image_url FROM admin_testimonials WHERE id = ?', [id]);
        if (existingTestimonials.length === 0) {
            cleanupFile(req.file?.path);
            return res.status(404).json({ status: 404, error: 'Testimonial not found.' });
        }
        const existingImageUrl = existingTestimonials[0].image_url;
        let newImageUrl = existingImageUrl;

        // 2. Handle image update and cleanup old file
        if (req.file) {
            // A new image was uploaded
            newImageUrl = `/public/testimonials/${req.file.filename}`;
            // Delete old file if it exists and is not the new one
            if (existingImageUrl) {
                const oldAbsolutePath = path.join(__dirname, '..', existingImageUrl);
                fs.unlink(oldAbsolutePath, (err) => {}); // Use async unlink
            }
        } else if (keep_existing_image === 'false' || keep_existing_image === false) {
             // User explicitly requested to remove the image but didn't upload a new one
             newImageUrl = null;
             if (existingImageUrl) {
                const oldAbsolutePath = path.join(__dirname, '..', existingImageUrl);
                fs.unlink(oldAbsolutePath, (err) => {});
             }
        } else {
             // Keep the existing image URL if no new file was uploaded
             newImageUrl = existingImageUrl;
        }

        // 3. Construct and execute SQL UPDATE
        const updateFields = {
            comment,
            review_stars: review_stars || 5,
            client_name,
            client_position: client_position || null,
            client_company: client_company || null,
            image_url: newImageUrl,
            is_active: is_active === undefined ? undefined : (is_active === 'true' || is_active === true),
            display_order: display_order || null
        };
        
        // Filter out undefined values (which were not provided in the request body)
        const fieldsToUpdate = [];
        const values = [];
        
        for (const key in updateFields) {
            if (updateFields[key] !== undefined) {
                fieldsToUpdate.push(`${key} = ?`);
                values.push(updateFields[key]);
            }
        }

        if (fieldsToUpdate.length === 0) {
            return res.status(200).json({ status: 200, message: 'No fields provided for update.' });
        }

        const sql = `UPDATE admin_testimonials SET ${fieldsToUpdate.join(', ')} WHERE id = ?`;
        const [result] = await db.query(sql, [...values, id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ status: 404, error: 'Testimonial not found or no changes made.' });
        }

        res.status(200).json({ status: 200, message: 'Testimonial updated successfully!' });

    } catch (error) {
        console.error('Error updating testimonial:', error);
        cleanupFile(req.file?.path);
        res.status(500).json({ status: 500, error: 'Failed to update testimonial.', details: error.message });
    }
});

// @route   DELETE /api/testimonials/admin/delete/:id
// @desc    Delete a testimonial and its associated image
// @access  Private (Admin)
router.delete('/admin/delete/:id', asyncWrapper(async (req, res) => {
    const { id } = req.params;

    // 1. Fetch image URL before deleting
    const [testimonials] = await db.query('SELECT image_url FROM admin_testimonials WHERE id = ?', [id]);
    if (testimonials.length === 0) {
        return res.status(404).json({ status: 404, error: 'Testimonial not found.' });
    }
    const imageUrl = testimonials[0].image_url;

    // 2. Delete from database
    const [result] = await db.query('DELETE FROM admin_testimonials WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
        return res.status(404).json({ status: 404, error: 'Testimonial not found.' });
    }

    // 3. Delete image file
    if (imageUrl) {
        const absolutePath = path.join(__dirname, '..', imageUrl);
        if (fs.existsSync(absolutePath)) {
            fs.unlink(absolutePath, (err) => {
                if (err) console.error('Failed to delete image file:', err.message);
            });
        }
    }

    res.status(200).json({ status: 200, message: 'Testimonial deleted successfully' });
}));


module.exports = router;