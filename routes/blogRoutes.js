/**
 * Express Router for Blog Management (admin_blogs table)
 * Handles CRUD operations and banner image file uploads/deletions.
 */

const express = require('express');
const router = express.Router();
const db = require('../db'); // Actual database connection import
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ====================================================================
// MULTER SETUP FOR BLOG BANNERS
// ====================================================================

// Define the directory for blog banners
const UPLOAD_DIR = 'public/blog_banners/'; 
const ABSOLUTE_UPLOAD_DIR = path.join(__dirname, '..', UPLOAD_DIR);

// Set up Multer storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Ensure the upload directory exists
        if (!fs.existsSync(ABSOLUTE_UPLOAD_DIR)) {
            fs.mkdirSync(ABSOLUTE_UPLOAD_DIR, { recursive: true });
        }
        cb(null, ABSOLUTE_UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname.replace(/\s/g, '_'));
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 2 * 1024 * 1024 // 2MB limit for blog banners
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only JPEG, PNG, GIF, and WebP image files are allowed.'));
        }
    }
});

// Helper function to safely delete a file
const deleteFile = (filePath) => {
    const fullPath = path.join(ABSOLUTE_UPLOAD_DIR, path.basename(filePath));
    if (fs.existsSync(fullPath)) {
        fs.unlink(fullPath, (err) => {
            if (err) console.error('Error deleting file:', fullPath, err);
        });
        return true;
    }
    return false;
};

// ====================================================================
// 1. GET ALL BLOGS (Read All - Public View)
// Endpoint: GET /api/blogs
// ====================================================================
router.get('/', async (req, res) => {
    // Only select essential fields for the blog list view
    const sql = 'SELECT id, publish_date, tags, banner_image, title, short_description, author FROM admin_blogs ORDER BY publish_date DESC';
    
    try {
        const [blogs] = await db.query(sql); // Assuming db.query returns [results, fields]
        res.status(200).json({ success: true, count: blogs.length, data: blogs });
    } catch (error) {
        console.error('Error fetching all blogs:', error);
        res.status(500).json({ success: false, message: 'Failed to retrieve blog list.' });
    }
});

// ====================================================================
// 2. GET SINGLE BLOG (Read Single - Detail View)
// Endpoint: GET /api/blogs/:id
// ====================================================================
router.get('/:id', async (req, res) => {
    const { id } = req.params;
    
    // Select all fields, including the full_content
    const sql = 'SELECT * FROM admin_blogs WHERE id = ?'; 
    
    try {
        const [result] = await db.query(sql, [id]);
        
        if (result.length === 0) {
            return res.status(404).json({ success: false, message: `Blog with ID ${id} not found.` });
        }
        
        res.status(200).json({ success: true, data: result[0] });
    } catch (error) {
        console.error(`Error fetching blog ID ${id}:`, error);
        res.status(500).json({ success: false, message: 'Failed to retrieve blog post.' });
    }
});


// ====================================================================
// 3. CREATE NEW BLOG POST (Create)
// Endpoint: POST /api/blogs
// Middleware: upload.single('bannerImage') for file upload
// ====================================================================
router.post('/', upload.single('bannerImage'), async (req, res) => {
    const { publish_date, tags, title, short_description, full_content, author } = req.body;
    let imageUrl = null;

    if (!title || !full_content || !req.file) {
        // Clean up the uploaded file if required fields are missing
        if (req.file) {
            deleteFile(req.file.filename);
        }
        return res.status(400).json({ success: false, message: 'Title, full content, and banner image are required.' });
    }
    
    // Set the image URL relative to the public path
    imageUrl = `/${UPLOAD_DIR}${req.file.filename}`;

    const sql = `
        INSERT INTO admin_blogs (publish_date, tags, banner_image, title, short_description, full_content, author) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
        publish_date || new Date().toISOString().slice(0, 10), 
        tags || '',
        imageUrl, // Use uploaded file path
        title,
        short_description || title.substring(0, 499),
        full_content,
        author || 'Admin'
    ];
    
    try {
        const [result] = await db.query(sql, params);
        res.status(201).json({ success: true, message: 'Blog post created successfully.', id: result.insertId, imageUrl });
    } catch (error) {
        console.error('Error creating new blog post:', error);
        
        // Clean up the uploaded file on database error
        if (req.file) {
            deleteFile(req.file.filename);
        }
        
        res.status(500).json({ success: false, message: 'Failed to create blog post.' });
    }
});


// ====================================================================
// 4. UPDATE EXISTING BLOG POST (Update)
// Endpoint: PUT /api/blogs/:id
// Middleware: upload.single('bannerImage') for file upload
// ====================================================================
router.put('/:id', upload.single('bannerImage'), async (req, res) => {
    const { id } = req.params;
    const { publish_date, tags, title, short_description, full_content, author } = req.body;
    
    try {
        // 1. Fetch existing blog post to get the current banner_image path
        const [existingBlogs] = await db.query('SELECT banner_image FROM admin_blogs WHERE id = ?', [id]);
        
        if (existingBlogs.length === 0) {
            // Clean up new file if blog post doesn't exist
            if (req.file) deleteFile(req.file.filename);
            return res.status(404).json({ success: false, message: `Blog with ID ${id} not found.` });
        }

        const existingBlog = existingBlogs[0];
        let imageUrl = existingBlog.banner_image;

        // 2. Handle new image upload
        if (req.file) {
            // Delete the old image file first
            if (existingBlog.banner_image) {
                deleteFile(existingBlog.banner_image);
            }
            // Set new image URL
            imageUrl = `/${UPLOAD_DIR}${req.file.filename}`;
        }
        
        // 3. Dynamically build the SQL update query
        const updates = [];
        const params = [];

        if (publish_date !== undefined) { updates.push('publish_date = ?'); params.push(publish_date); }
        if (tags !== undefined) { updates.push('tags = ?'); params.push(tags); }
        // Always include imageUrl, whether it's new or old
        updates.push('banner_image = ?'); params.push(imageUrl);
        if (title !== undefined) { updates.push('title = ?'); params.push(title); }
        if (short_description !== undefined) { updates.push('short_description = ?'); params.push(short_description); }
        if (full_content !== undefined) { updates.push('full_content = ?'); params.push(full_content); }
        if (author !== undefined) { updates.push('author = ?'); params.push(author); }

        if (updates.length === 0) {
            // Clean up new file if no other fields were provided for update
            if (req.file) deleteFile(req.file.filename);
            return res.status(400).json({ success: false, message: 'No fields provided for update.' });
        }

        const sql = `UPDATE admin_blogs SET ${updates.join(', ')} WHERE id = ?`;
        params.push(id);
        
        const [result] = await db.query(sql, params);
        
        if (result.affectedRows === 0) {
            return res.status(200).json({ success: true, message: `Blog post ID ${id} found, but no changes were made.` });
        }
        
        res.status(200).json({ success: true, message: `Blog post ID ${id} updated successfully.` });
    } catch (error) {
        console.error(`Error updating blog ID ${id}:`, error);
        
        // Clean up the newly uploaded file on database error
        if (req.file) {
            deleteFile(req.file.filename);
        }
        
        res.status(500).json({ success: false, message: 'Failed to update blog post.' });
    }
});


// ====================================================================
// 5. DELETE BLOG POST (Delete)
// Endpoint: DELETE /api/blogs/:id
// ====================================================================
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    
    try {
        // 1. Fetch the banner image URL before deletion
        const [blogs] = await db.query('SELECT banner_image FROM admin_blogs WHERE id = ?', [id]);
        
        if (blogs.length === 0) {
            return res.status(404).json({ success: false, message: `Blog with ID ${id} not found.` });
        }
        
        const bannerPath = blogs[0].banner_image;

        // 2. Delete from database
        const [result] = await db.query('DELETE FROM admin_blogs WHERE id = ?', [id]);
        
        if (result.affectedRows === 0) {
            // Should not happen if the SELECT found it, but good defensive check
            return res.status(404).json({ success: false, message: `Blog with ID ${id} not found.` });
        }

        // 3. Delete the physical image file
        if (bannerPath) {
            deleteFile(bannerPath);
        }
        
        res.status(200).json({ success: true, message: `Blog post ID ${id} and its banner deleted successfully.` });
    } catch (error) {
        console.error(`Error deleting blog ID ${id}:`, error);
        res.status(500).json({ success: false, message: 'Failed to delete blog post.' });
    }
});

module.exports = router;