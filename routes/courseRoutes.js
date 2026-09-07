const express = require('express');
const router = express.Router();
const db = require('../db'); // Assuming the database connection is available here
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// --- Multer Setup for handling Course Image uploads ---

// Storage for optional Course Image files (The only file upload remaining)
const imageStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = 'public/resources/images/';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Use a unique name for the image
        cb(null, `img_${Date.now()}${path.extname(file.originalname)}`);
    }
});

// Combined upload middleware for creating/updating a course.
const upload = multer({
    storage: imageStorage, // Use the image storage directly
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit for resources
    },
    fileFilter: (req, file, cb) => {
        if (file.fieldname === 'courseImage') {
            const allowedImageTypes = /jpeg|jpg|png|gif|webp/;
            const extname = allowedImageTypes.test(path.extname(file.originalname).toLowerCase());
            const mimetype = allowedImageTypes.test(file.mimetype);
            if (mimetype && extname) return cb(null, true);
            cb(new Error('Only image files are allowed for the course image.'));
        } else {
            // This case should ideally not be hit since we only upload one field,
            // but it serves as a safety catch.
            cb(new Error('Invalid file type or field name.'));
        }
    }
});

// Helper function to delete files if an error occurs
const cleanupFiles = (files) => {
    // Check if an image was uploaded during the failed operation
    if (files && files.courseImage && files.courseImage[0]) {
        fs.unlinkSync(files.courseImage[0].path);
    }
};

/**
 * @route POST /api/courses/create
 * @desc Create a new course/resource
 */
router.post('/create', upload.fields([
    // Removed 'pdfFile' field
    { name: 'courseImage', maxCount: 1 }
]), async (req, res) => {
    try {
        const { title, description } = req.body;
        // Removed pdfFile variable
        const courseImage = req.files && req.files['courseImage'] ? req.files['courseImage'][0] : null;

        // Validation: Title is required (PDF is no longer mandatory)
        if (!title) {
            cleanupFiles(req.files);
            return res.status(400).json({
                status: 400,
                error: 'Title is required.'
            });
        }

        // Construct URL
        // Removed pdfUrl variable
        const imageUrl = courseImage ? `/public/resources/images/${courseImage.filename}` : null;

        // Insert the new course into the database
        const [result] = await db.query(
            // Removed pdf_url from the column list and the placeholder list
            `INSERT INTO admin_courses (title, description, image_url) VALUES (?, ?, ?)`,
            [title, description || '', imageUrl]
        );

        res.status(201).json({
            status: 201,
            message: 'Course resource created successfully',
            courseId: result.insertId
        });

    } catch (error) {
        console.error('Error creating course resource:', error);
        // Delete uploaded files if database insertion fails
        cleanupFiles(req.files);

        res.status(500).json({
            status: 500,
            error: 'Failed to create course resource.'
        });
    }
});

/**
 * @route GET /api/courses
 * @desc Get all courses with search and filter functionality
 */
router.get('/', async (req, res) => {
    try {
        const { search, hasImage } = req.query;
        // The pdf_url column is still selected in the DB query, but it is now expected to be NULL/ignored
        let query = 'SELECT * FROM admin_courses'; 
        let params = [];

        // Build query based on filters
        const conditions = [];

        if (search) {
            conditions.push('(title LIKE ? OR description LIKE ?)');
            params.push(`%${search}%`, `%${search}%`);
        }

        if (hasImage !== undefined) {
            if (hasImage === 'true') {
                conditions.push('image_url IS NOT NULL');
            } else if (hasImage === 'false') {
                conditions.push('image_url IS NULL');
            }
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        query += ' ORDER BY created_at DESC';

        const [courses] = await db.query(query, params);

        res.status(200).json({
            status: 200,
            message: 'Course resources fetched successfully',
            data: courses,
            total: courses.length
        });

    } catch (error) {
        console.error('Error fetching course resources:', error);
        res.status(500).json({
            status: 500,
            error: 'Failed to fetch course resources.'
        });
    }
});

/**
 * @route GET /api/courses/:id
 * @desc Get a single course by ID
 */
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const [courses] = await db.query('SELECT * FROM admin_courses WHERE id = ?', [id]);

        if (courses.length === 0) {
            return res.status(404).json({
                status: 404,
                error: 'Course resource not found.'
            });
        }

        res.status(200).json({
            status: 200,
            message: 'Course resource fetched successfully',
            data: courses[0]
        });

    } catch (error) {
        console.error('Error fetching course resource:', error);
        res.status(500).json({
            status: 500,
            error: 'Failed to fetch course resource.'
        });
    }
});

/**
 * @route PUT /api/courses/update/:id
 * @desc Update a course/resource, optionally replacing Image
 */
router.put('/update/:id', upload.fields([
    // Removed 'pdfFile' field
    { name: 'courseImage', maxCount: 1 }
]), async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description } = req.body;
        const files = req.files;

        // 1. Check if course exists
        // pdf_url is selected here, but only to avoid DB errors if the column still exists.
        const [existingCourses] = await db.query('SELECT * FROM admin_courses WHERE id = ?', [id]);

        if (existingCourses.length === 0) {
            cleanupFiles(files);
            return res.status(404).json({
                status: 404,
                error: 'Course resource not found.'
            });
        }

        const existingCourse = existingCourses[0];
        // Removed pdfUrl variable
        let imageUrl = existingCourse.image_url;

        // 2. Handle Image update (PDF handling removed)
        if (files.courseImage && files.courseImage[0]) {
            // Delete old Image file if it exists
            if (existingCourse.image_url) {
                const oldImagePath = path.join(__dirname, '..', existingCourse.image_url);
                if (fs.existsSync(oldImagePath)) {
                    fs.unlinkSync(oldImagePath);
                }
            }
            // Set new Image URL
            imageUrl = `/public/resources/images/${files.courseImage[0].filename}`;
        }
        
        // Ensure no new PDF file was uploaded by mistake and cleanup
        if (files.pdfFile && files.pdfFile[0]) {
             // In a real application, you'd throw an error or handle this, but for simplicity
             // of removing the feature, we'll just delete the file if it somehow got past the middleware.
             fs.unlinkSync(files.pdfFile[0].path);
        }

        // 3. Update course in database
        const [result] = await db.query(
            // Removed pdf_url from the UPDATE statement
            `UPDATE admin_courses SET title = ?, description = ?, image_url = ? WHERE id = ?`,
            [
                title || existingCourse.title,
                description || existingCourse.description,
                imageUrl,
                id
            ]
        );

        res.status(200).json({
            status: 200,
            message: 'Course resource updated successfully'
        });

    } catch (error) {
        console.error('Error updating course resource:', error);

        // Delete newly uploaded files if DB update fails
        cleanupFiles(req.files);

        res.status(500).json({
            status: 500,
            error: 'Failed to update course resource.'
        });
    }
});

/**
 * @route DELETE /api/courses/delete/:id
 * @desc Delete a single course
 */
router.delete('/delete/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Fetch the course first to get file URLs
        // pdf_url is still selected here for safety, but its deletion logic is removed below.
        const [courses] = await db.query('SELECT pdf_url, image_url FROM admin_courses WHERE id = ?', [id]);

        if (courses.length === 0) {
            return res.status(404).json({
                status: 404,
                error: 'Course resource not found.'
            });
        }

        const course = courses[0];

        // Delete from database
        const [result] = await db.query('DELETE FROM admin_courses WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                status: 404,
                error: 'Course resource not found.'
            });
        }

        // Delete the optional image file (PDF deletion logic removed)
        if (course.image_url) {
            const imagePath = path.join(__dirname, '..', course.image_url);
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
            }
        }
        
        // NOTE: The previous version included logic to delete the PDF file here.
        // Since we are removing the feature, we assume no *new* PDF files will be stored.
        // However, if old records still reference pdf_url, this file should be manually cleaned up
        // or a migration script should be run to remove the old files and drop the column.
        // For this code, the *new* logic does not touch the pdf_url field's existence on DELETE.

        res.status(200).json({
            status: 200,
            message: 'Course resource deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting course resource:', error);
        res.status(500).json({
            status: 500,
            error: 'Failed to delete course resource.'
        });
    }
});

/**
 * @route POST /api/courses/delete-multiple
 * @desc Delete multiple courses
 */
router.post('/delete-multiple', async (req, res) => {
    try {
        const { ids } = req.body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({
                status: 400,
                error: 'No course resource IDs provided.'
            });
        }

        // 1. Fetch courses to get file URLs
        const placeholders = ids.map(() => '?').join(',');
        // pdf_url is selected here for safety, but its deletion logic is removed below.
        const [courses] = await db.query(
            `SELECT id, pdf_url, image_url FROM admin_courses WHERE id IN (${placeholders})`, ids
        );

        // 2. Delete from database
        const [result] = await db.query(`DELETE FROM admin_courses WHERE id IN (${placeholders})`, ids);

        // 3. Delete file resources
        courses.forEach(course => {
            // Delete optional image file (PDF deletion logic removed)
            if (course.image_url) {
                const imagePath = path.join(__dirname, '..', course.image_url);
                if (fs.existsSync(imagePath)) {
                    fs.unlinkSync(imagePath);
                }
            }
        });

        res.status(200).json({
            status: 200,
            message: `${result.affectedRows} course resource(s) deleted successfully`
        });

    } catch (error) {
        console.error('Error deleting multiple course resources:', error);
        res.status(500).json({
            status: 500,
            error: 'Failed to delete course resources.'
        });
    }
});

module.exports = router;