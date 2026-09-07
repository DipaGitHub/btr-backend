// resources.js

const express = require('express');
const router = express.Router();
const db = require('../db'); // Assuming the database connection is available here
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// --- Multer Setup for handling PDF resource upload ---

// Storage for mandatory PDF resource files
const resourceStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = 'public/resources/pdfs/'; // Adjusted path for PDF resources
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Use original filename but prepend timestamp for uniqueness
        cb(null, `resource_${Date.now()}${path.extname(file.originalname)}`);
    }
});

// Upload middleware for creating/updating a resource.
const upload = multer({
    storage: resourceStorage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit for PDF resources
    },
    fileFilter: (req, file, cb) => {
        if (file.fieldname === 'resourceFile') {
            const allowedPdfTypes = /pdf/;
            const extname = allowedPdfTypes.test(path.extname(file.originalname).toLowerCase());
            const mimetype = allowedPdfTypes.test(file.mimetype);
            if (mimetype && extname) return cb(null, true);
            cb(new Error('Only PDF files are allowed for the resource.'));
        } else {
            cb(new Error('Invalid file field name. Expecting "resourceFile".'));
        }
    }
});

// Helper function to delete files if an error occurs
const cleanupFile = (file) => {
    if (file && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
    }
};

// Helper function to get the relative URL
const getResourceUrl = (file) => {
    // The URL path should be relative to the root public directory
    return `/public/resources/pdfs/${file.filename}`;
};

/**
 * @route POST /api/resources/create
 * @desc Create a new resource (PDF upload mandatory)
 */
router.post('/create', upload.single('resourceFile'), async (req, res) => {
    try {
        const { title, description } = req.body;
        const resourceFile = req.file; // File data is in req.file for single upload

        // 1. Validation: Title and PDF file are required
        if (!title || !resourceFile) {
            cleanupFile(resourceFile);
            return res.status(400).json({
                status: 400,
                error: 'Title and a PDF resource file are required.'
            });
        }

        // 2. Construct URL
        const resourceUrl = getResourceUrl(resourceFile);

        // 3. Insert the new resource into the database
        const query = `
            INSERT INTO admin_resources (title, description, resource_url) 
            VALUES (?, ?, ?)
        `;
        const [result] = await db.query(query, [title, description || null, resourceUrl]);

        res.status(201).json({
            status: 201,
            message: 'Resource created successfully',
            resourceId: result.insertId
        });

    } catch (error) {
        console.error('Error creating resource:', error);
        // Delete uploaded file if database insertion fails
        cleanupFile(req.file);

        res.status(500).json({
            status: 500,
            error: 'Failed to create resource.'
        });
    }
});

// ----------------------------------------------------------------------
// GET ALL and GET SINGLE
// ----------------------------------------------------------------------

/**
 * @route GET /api/resources
 * @desc Get all resources with search functionality
 */
router.get('/', async (req, res) => {
    try {
        const { search } = req.query;
        let query = 'SELECT * FROM admin_resources';
        let params = [];

        // Build query based on search
        if (search) {
            query += ' WHERE title LIKE ? OR description LIKE ?';
            params.push(`%${search}%`, `%${search}%`);
        }

        query += ' ORDER BY created_at DESC';

        const [resources] = await db.query(query, params);

        res.status(200).json({
            status: 200,
            message: 'Resources fetched successfully',
            data: resources,
            total: resources.length
        });

    } catch (error) {
        console.error('Error fetching resources:', error);
        res.status(500).json({
            status: 500,
            error: 'Failed to fetch resources.'
        });
    }
});

/**
 * @route GET /api/resources/:id
 * @desc Get a single resource by ID
 */
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const [resources] = await db.query('SELECT * FROM admin_resources WHERE id = ?', [id]);

        if (resources.length === 0) {
            return res.status(404).json({
                status: 404,
                error: 'Resource not found.'
            });
        }

        res.status(200).json({
            status: 200,
            message: 'Resource fetched successfully',
            data: resources[0]
        });

    } catch (error) {
        console.error('Error fetching resource:', error);
        res.status(500).json({
            status: 500,
            error: 'Failed to fetch resource.'
        });
    }
});

// ----------------------------------------------------------------------
// UPDATE
// ----------------------------------------------------------------------

/**
 * @route PUT /api/resources/update/:id
 * @desc Update a resource, optionally replacing the PDF
 */
router.put('/update/:id', upload.single('resourceFile'), async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description } = req.body;
        const newResourceFile = req.file;
        let updateFields = {};
        let params = [];

        // 1. Check if resource exists
        const [existingResources] = await db.query('SELECT resource_url FROM admin_resources WHERE id = ?', [id]);

        if (existingResources.length === 0) {
            cleanupFile(newResourceFile);
            return res.status(404).json({
                status: 404,
                error: 'Resource not found.'
            });
        }

        const existingResource = existingResources[0];
        let resourceUrl = existingResource.resource_url;
        
        // 2. Handle PDF file update
        if (newResourceFile) {
            // Delete old PDF file
            const oldResourcePath = path.join(__dirname, '..', existingResource.resource_url);
            if (fs.existsSync(oldResourcePath)) {
                fs.unlinkSync(oldResourcePath);
            }
            // Set new PDF URL
            resourceUrl = getResourceUrl(newResourceFile);
            updateFields.resource_url = resourceUrl;
        }

        // 3. Build dynamic UPDATE query
        if (title) {
            updateFields.title = title;
        }
        if (description !== undefined) {
            // Allow description to be explicitly set to NULL/empty string
            updateFields.description = description || null; 
        }

        // If no fields to update and no file was uploaded, return 
        if (Object.keys(updateFields).length === 0 && !newResourceFile) {
             return res.status(200).json({
                status: 200,
                message: 'No changes provided for resource update.'
            });
        }
        
        // Construct the query string
        const setClauses = Object.keys(updateFields).map(key => `${key} = ?`).join(', ');
        params = [...Object.values(updateFields)];
        
        const query = `UPDATE admin_resources SET ${setClauses} WHERE id = ?`;
        params.push(id);

        // 4. Update resource in database
        await db.query(query, params);

        res.status(200).json({
            status: 200,
            message: 'Resource updated successfully'
        });

    } catch (error) {
        console.error('Error updating resource:', error);
        // Delete newly uploaded file if DB update fails
        cleanupFile(req.file);

        res.status(500).json({
            status: 500,
            error: 'Failed to update resource.'
        });
    }
});

// ----------------------------------------------------------------------
// DELETE
// ----------------------------------------------------------------------

/**
 * @route DELETE /api/resources/delete/:id
 * @desc Delete a single resource
 */
router.delete('/delete/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // 1. Fetch the resource first to get file URL
        const [resources] = await db.query('SELECT resource_url FROM admin_resources WHERE id = ?', [id]);

        if (resources.length === 0) {
            return res.status(404).json({
                status: 404,
                error: 'Resource not found.'
            });
        }

        const resource = resources[0];

        // 2. Delete from database
        const [result] = await db.query('DELETE FROM admin_resources WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            // This should ideally not happen if step 1 succeeded, but is a safety check
            return res.status(404).json({
                status: 404,
                error: 'Resource not found after initial check.'
            });
        }

        // 3. Delete the PDF file
        const resourcePath = path.join(__dirname, '..', resource.resource_url);
        if (fs.existsSync(resourcePath)) {
            fs.unlinkSync(resourcePath);
        }

        res.status(200).json({
            status: 200,
            message: 'Resource deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting resource:', error);
        res.status(500).json({
            status: 500,
            error: 'Failed to delete resource.'
        });
    }
});

/**
 * @route POST /api/resources/delete-multiple
 * @desc Delete multiple resources
 */
router.post('/delete-multiple', async (req, res) => {
    try {
        const { ids } = req.body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({
                status: 400,
                error: 'No resource IDs provided.'
            });
        }

        const placeholders = ids.map(() => '?').join(',');

        // 1. Fetch resources to get file URLs
        const [resources] = await db.query(
            `SELECT resource_url FROM admin_resources WHERE id IN (${placeholders})`, ids
        );

        // 2. Delete from database
        const [result] = await db.query(`DELETE FROM admin_resources WHERE id IN (${placeholders})`, ids);

        // 3. Delete file resources
        resources.forEach(resource => {
            const resourcePath = path.join(__dirname, '..', resource.resource_url);
            if (fs.existsSync(resourcePath)) {
                fs.unlinkSync(resourcePath);
            }
        });

        res.status(200).json({
            status: 200,
            message: `${result.affectedRows} resource(s) deleted successfully`
        });

    } catch (error) {
        console.error('Error deleting multiple resources:', error);
        res.status(500).json({
            status: 500,
            error: 'Failed to delete resources.'
        });
    }
});

module.exports = router;