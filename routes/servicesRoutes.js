const express = require('express');
const router = express.Router();
const db = require('../db'); // Assuming Promise-based db connection
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// --- SLUG GENERATION HELPER ---
const slugify = (text) => {
    return text
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '') // Remove all non-word characters
        .replace(/[\s_-]+/g, '-')   // Replace spaces and hyphens with a single hyphen
        .replace(/^-+|-+$/g, '');   // Remove leading/trailing hyphens
};

// --- MULTER SETUP (Handles 2 Image Fields) ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = 'public/services/';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Use fieldname to differentiate (image vs bannerImage)
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
});


// Add to your imports
const adminDocumentsStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = 'public/admin-documents/';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'admin-' + file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const adminDocumentsUpload = multer({
    storage: adminDocumentsStorage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /pdf|doc|docx|jpg|jpeg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only PDF, DOC, DOCX, JPG, PNG, GIF, WEBP files are allowed.'));
        }
    }
});

// New endpoint to handle status change with document upload
router.put('/admin/application/:applicationId/status-with-document', 
    adminDocumentsUpload.single('admin_document'),
    async (req, res) => {
        try {
            const { applicationId } = req.params;
            const { 
                status, 
                admin_notes, 
                assigned_to,
                document_name,
                document_type 
            } = req.body;

            console.log('Request body:', req.body);
            console.log('Request file:', req.file);

            if (!status || !['pending', 'under_review', 'approved', 'rejected', 'needs_more_info'].includes(status)) {
                // Cleanup uploaded file if validation fails
                if (req.file && fs.existsSync(req.file.path)) {
                    fs.unlinkSync(req.file.path);
                }
                return res.status(400).json({ 
                    status: 400, 
                    error: 'Valid status is required.' 
                });
            }

            await db.query('START TRANSACTION');

            try {
                // Update application status with document info
                const updateSql = `
                    UPDATE service_applications 
                    SET status = ?, 
                        admin_notes = ?, 
                        assigned_to = ?, 
                        updated_at = CURRENT_TIMESTAMP,
                        admin_document_path = ?,
                        admin_document_name = ?,
                        admin_document_type = ?,
                        admin_document_size = ?
                    WHERE application_id = ?
                `;

                await db.query(updateSql, [
                    status, 
                    admin_notes || null, 
                    assigned_to || null,
                    req.file ? `/public/admin-documents/${req.file.filename}` : null,
                    req.file ? req.file.originalname : null,
                    document_type || (req.file ? req.file.mimetype : null),
                    req.file ? req.file.size : null,
                    applicationId
                ]);

                // If using separate admin_documents table
                if (req.file) {
                    const adminDocSql = `
                        INSERT INTO admin_application_documents (
                            application_id, document_name, document_type,
                            file_path, file_size, file_type, uploaded_by
                        ) VALUES (?, ?, ?, ?, ?, ?, ?)
                    `;
                    
                    await db.query(adminDocSql, [
                        applicationId,
                        document_name || req.file.originalname,
                        document_type || 'admin_document',
                        `/public/admin-documents/${req.file.filename}`,
                        req.file.size,
                        req.file.mimetype,
                        req.user?.id || 'Admin'
                    ]);
                }

                // Add to history with document note
                const historyNotes = req.file 
                    ? `${admin_notes || 'Status updated'} [Document attached: ${req.file.originalname}]`
                    : admin_notes || 'Status updated';

                const historySql = `
                    INSERT INTO application_history (application_id, status, notes, changed_by)
                    VALUES (?, ?, ?, ?)
                `;
                await db.query(historySql, [applicationId, status, historyNotes, req.user?.id || null]);

                await db.query('COMMIT');

                res.status(200).json({
                    status: 200,
                    message: req.file 
                        ? 'Application status updated with document.' 
                        : 'Application status updated.',
                    data: req.file ? {
                        document: {
                            name: req.file.originalname,
                            path: `/public/admin-documents/${req.file.filename}`,
                            size: req.file.size,
                            type: req.file.mimetype
                        }
                    } : null
                });

            } catch (error) {
                await db.query('ROLLBACK');
                
                // Cleanup uploaded file on DB error
                if (req.file && fs.existsSync(req.file.path)) {
                    fs.unlinkSync(req.file.path);
                }
                
                throw error;
            }

        } catch (error) {
            console.error('Error updating application status with document:', error);
            res.status(500).json({ 
                status: 500, 
                error: 'Failed to update application status.',
                details: error.message 
            });
        }
    }
);

// Get admin documents for an application
router.get('/admin/application/:applicationId/admin-documents', async (req, res) => {
    try {
        const { applicationId } = req.params;
        
        // Using separate table approach
        const [documents] = await db.query(
            `SELECT * FROM admin_application_documents 
             WHERE application_id = ? 
             ORDER BY uploaded_at DESC`,
            [applicationId]
        );
        
        // Also get from service_applications table (if using that approach)
        const [appData] = await db.query(
            `SELECT admin_document_path, admin_document_name, 
                    admin_document_type, admin_document_size
             FROM service_applications 
             WHERE application_id = ? 
               AND admin_document_path IS NOT NULL`,
            [applicationId]
        );

        res.status(200).json({
            status: 200,
            data: {
                separate_documents: documents,
                main_document: appData.length > 0 ? appData[0] : null
            }
        });

    } catch (error) {
        console.error('Error fetching admin documents:', error);
        res.status(500).json({ 
            status: 500, 
            error: 'Failed to fetch admin documents.' 
        });
    }
});

// Delete admin document
router.delete('/admin/document/:documentId', async (req, res) => {
    try {
        const { documentId } = req.params;
        
        // First get the file path
        const [documents] = await db.query(
            'SELECT file_path FROM admin_application_documents WHERE id = ?',
            [documentId]
        );
        
        if (documents.length === 0) {
            return res.status(404).json({ 
                status: 404, 
                error: 'Document not found.' 
            });
        }
        
        const filePath = documents[0].file_path.replace('/public', 'public');
        
        // Delete from database
        const [result] = await db.query(
            'DELETE FROM admin_application_documents WHERE id = ?',
            [documentId]
        );
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ 
                status: 404, 
                error: 'Document not found.' 
            });
        }
        
        // Delete file from server
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        
        res.status(200).json({
            status: 200,
            message: 'Document deleted successfully.'
        });
        
    } catch (error) {
        console.error('Error deleting document:', error);
        res.status(500).json({ 
            status: 500, 
            error: 'Failed to delete document.' 
        });
    }
});




const upload = multer({ 
    storage: storage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit per file
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

const uploadFields = upload.fields([
    { name: 'imageUpload', maxCount: 1 },       // Required Main Image
    { name: 'bannerImageUpload', maxCount: 1 }  // Optional Banner Image
]);

// Helper to remove files on error
const cleanupFiles = (files) => {
    if (!files) return;
    Object.values(files).flat().forEach(file => {
        try {
            fs.unlinkSync(file.path);
        } catch (e) {
            console.error('Failed to cleanup file:', e.message);
        }
    });
};

// --- CREATE Service (/api/services/create) ---
router.post('/create', uploadFields, async (req, res) => {
    try {
        const { 
            serviceName, description, scopeTitle, scopeContent, 
            metaTitle, metaKeyword, metaDescription, active 
        } = req.body;
        
        // Ensure required fields are present
        if (!serviceName || !req.files || !req.files.imageUpload) {
            cleanupFiles(req.files);
            return res.status(400).json({ status: 400, error: 'Service Name and Main Image are required.' });
        }

        const mainImageFile = req.files.imageUpload[0];
        const bannerImageFile = req.files.bannerImageUpload ? req.files.bannerImageUpload[0] : null;

        const imageUrl = `/public/services/${mainImageFile.filename}`;
        const bannerImageUrl = bannerImageFile ? `/public/services/${bannerImageFile.filename}` : null;
        const isActive = active === 'true' || active === true;
        
        // 1. Generate unique slug
        let baseSlug = slugify(serviceName);
        let finalSlug = baseSlug;
        let slugCount = 0;
        
        // Check for slug uniqueness (simple implementation)
        while (true) {
            const [existingService] = await db.query('SELECT id FROM admin_services WHERE slug = ?', [finalSlug]);
            if (existingService.length === 0) {
                break;
            }
            slugCount++;
            finalSlug = `${baseSlug}-${slugCount}`;
        }

        // Get the highest display_order to set new service at the end
        const [maxOrderResult] = await db.query('SELECT COALESCE(MAX(display_order), 0) as max_order FROM admin_services');
        const nextDisplayOrder = maxOrderResult[0].max_order + 1;

        const sql = `
            INSERT INTO admin_services (
                name, slug, description, scope_title, scope_content, 
                meta_title, meta_keyword, meta_description, image_url, 
                banner_image_url, is_active, display_order
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const values = [
            serviceName, finalSlug, description || null, scopeTitle || null, scopeContent || null,
            metaTitle || null, metaKeyword || null, metaDescription || null, imageUrl, 
            bannerImageUrl, isActive, nextDisplayOrder
        ];

        const [result] = await db.query(sql, values);

        res.status(201).json({ 
            status: 201,
            message: 'Service created successfully!',
            serviceId: result.insertId,
            slug: finalSlug,
            display_order: nextDisplayOrder
        });

    } catch (error) {
        console.error('Error creating service:', error);
        cleanupFiles(req.files);
        res.status(500).json({ status: 500, error: 'Failed to create service.', details: error.message });
    }
});

// --- READ ALL Services (/api/services) ---
router.get('/', async (req, res) => {
    try {
        const { search, active } = req.query;
        // ADD display_order to SELECT
        let query = 'SELECT id, name, slug, image_url, description AS service_description_text, is_active, display_order, created_at FROM admin_services';
        let params = [];
        const conditions = [];

        if (search) {
            conditions.push('name LIKE ? OR slug LIKE ?');
            params.push(`%${search}%`, `%${search}%`);
        }
        
        if (active !== undefined) {
            conditions.push('is_active = ?');
            params.push(active === 'true' ? 1 : 0);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        // MODIFIED: Order by display_order first, then created_at
        query += ' ORDER BY display_order ASC, created_at DESC';

        const [services] = await db.query(query, params);

        res.status(200).json({
            status: 200,
            message: 'Services fetched successfully',
            data: services,
            total: services.length
        });

    } catch (error) {
        console.error('Error fetching services:', error);
        res.status(500).json({ status: 500, error: 'Failed to fetch services.' });
    }
});

// --- UPDATE Service Order Sequence (Drag & Drop) ---
router.put('/update-order', async (req, res) => {
    try {
        const { reorderedServices } = req.body;

        if (!Array.isArray(reorderedServices) || reorderedServices.length === 0) {
            return res.status(400).json({ 
                status: 400, 
                error: 'Invalid data: reorderedServices must be a non-empty array.' 
            });
        }

        // Start a transaction for batch update
        await db.query('START TRANSACTION');

        try {
            // Update each service's display_order based on the new order
            for (let i = 0; i < reorderedServices.length; i++) {
                const service = reorderedServices[i];
                await db.query(
                    'UPDATE admin_services SET display_order = ? WHERE id = ?',
                    [i + 1, service.id] // Starting order from 1
                );
            }

            await db.query('COMMIT');

            res.status(200).json({ 
                status: 200, 
                message: 'Service order updated successfully!',
                updatedCount: reorderedServices.length
            });

        } catch (error) {
            await db.query('ROLLBACK');
            throw error;
        }

    } catch (error) {
        console.error('Error updating service order:', error);
        res.status(500).json({ 
            status: 500, 
            error: 'Failed to update service order.', 
            details: error.message 
        });
    }
});

// --- READ Single Service (/api/services/:id) ---
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const [services] = await db.query('SELECT * FROM admin_services WHERE id = ?', [id]);

        if (services.length === 0) {
            return res.status(404).json({ status: 404, error: 'Service not found.' });
        }

        res.status(200).json({
            status: 200,
            message: 'Service fetched successfully',
            data: services[0]
        });

    } catch (error) {
        console.error('Error fetching service:', error);
        res.status(500).json({ status: 500, error: 'Failed to fetch service.' });
    }
});

// --- UPDATE Service (/api/services/update/:id) ---
router.put('/update/:id', uploadFields, async (req, res) => {
    try {
        const { id } = req.params;
        const { 
            serviceName, description, scopeTitle, scopeContent, 
            metaTitle, metaKeyword, metaDescription, active, slug
        } = req.body;

        // 1. Check if service exists
        const [existingServices] = await db.query('SELECT * FROM admin_services WHERE id = ?', [id]);
        if (existingServices.length === 0) {
            cleanupFiles(req.files);
            return res.status(404).json({ status: 404, error: 'Service not found.' });
        }
        const existingService = existingServices[0];

        // 2. Handle image updates and cleanup old files
        let updateFields = {
            name: serviceName || existingService.name,
            slug: slug || existingService.slug, // Allow slug to be updated directly if provided
            description: description || existingService.description,
            scope_title: scopeTitle || existingService.scope_title,
            scope_content: scopeContent || existingService.scope_content,
            meta_title: metaTitle || existingService.meta_title,
            meta_keyword: metaKeyword || existingService.meta_keyword,
            meta_description: metaDescription || existingService.meta_description,
            is_active: active === undefined ? existingService.is_active : (active === 'true' || active === true),
            // Note: display_order is NOT updated here - only through /update-order endpoint
        };

        // Main Image Update
        if (req.files && req.files.imageUpload) {
            const mainImageFile = req.files.imageUpload[0];
            updateFields.image_url = `/public/services/${mainImageFile.filename}`;
            // Delete old file
            if (existingService.image_url) {
                const oldPath = path.join(__dirname, '..', existingService.image_url);
                if (fs.existsSync(oldPath)) {
                    fs.unlink(oldPath, (err) => {
                        if (err) console.error('Error deleting old main image:', err);
                    });
                }
            }
        }
        
        // Banner Image Update
        if (req.files && req.files.bannerImageUpload) {
            const bannerImageFile = req.files.bannerImageUpload[0];
            updateFields.banner_image_url = `/public/services/${bannerImageFile.filename}`;
            // Delete old file
            if (existingService.banner_image_url) {
                const oldPath = path.join(__dirname, '..', existingService.banner_image_url);
                if (fs.existsSync(oldPath)) {
                    fs.unlink(oldPath, (err) => {
                        if (err) console.error('Error deleting old banner image:', err);
                    });
                }
            }
        }

        // 3. Construct and execute SQL UPDATE
        const fieldsToUpdate = Object.keys(updateFields).map(key => `${key} = ?`).join(', ');
        const values = Object.values(updateFields);
        
        const sql = `UPDATE admin_services SET ${fieldsToUpdate} WHERE id = ?`;
        
        const [result] = await db.query(sql, [...values, id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ status: 404, error: 'Service not found or no changes made.' });
        }

        res.status(200).json({ status: 200, message: 'Service updated successfully!' });

    } catch (error) {
        console.error('Error updating service:', error);
        cleanupFiles(req.files);
        res.status(500).json({ status: 500, error: 'Failed to update service.', details: error.message });
    }
});

// --- DELETE Service (/api/services/delete/:id) ---
router.delete('/delete/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Fetch service to get image URLs before deleting
        const [services] = await db.query('SELECT image_url, banner_image_url FROM admin_services WHERE id = ?', [id]);
        if (services.length === 0) {
            return res.status(404).json({ status: 404, error: 'Service not found.' });
        }
        const service = services[0];

        // Start transaction
        await db.query('START TRANSACTION');

        try {
            // Delete from database
            const [result] = await db.query('DELETE FROM admin_services WHERE id = ?', [id]);

            if (result.affectedRows === 0) {
                await db.query('ROLLBACK');
                return res.status(404).json({ status: 404, error: 'Service not found.' });
            }

            // Reorder remaining services to maintain sequence
            await db.query(`
                UPDATE admin_services 
                SET display_order = display_order - 1 
                WHERE display_order > (SELECT COALESCE(MAX(tmp.display_order), 0) 
                FROM (SELECT display_order FROM admin_services WHERE id = ?) as tmp)
            `, [id]);

            await db.query('COMMIT');

            // Delete image files
            const imagePaths = [service.image_url, service.banner_image_url].filter(url => url);
            imagePaths.forEach(relativePath => {
                const absolutePath = path.join(__dirname, '..', relativePath);
                if (fs.existsSync(absolutePath)) {
                    fs.unlink(absolutePath, (err) => {
                        if (err) console.error('Error deleting image file:', err);
                    });
                }
            });

            res.status(200).json({ status: 200, message: 'Service deleted successfully' });

        } catch (error) {
            await db.query('ROLLBACK');
            throw error;
        }

    } catch (error) {
        console.error('Error deleting service:', error);
        res.status(500).json({ status: 500, error: 'Failed to delete service.', details: error.message });
    }
});

router.get('/by-slug/:slug', async (req, res) => {
    try {
        const { slug } = req.params;
        // SELECT * brings all the fields we need for the detail page
        const [services] = await db.query('SELECT * FROM admin_services WHERE slug = ?', [slug]);

        if (services.length === 0) {
            return res.status(404).json({ status: 404, error: 'Service not found.' });
        }

        res.status(200).json({
            status: 200,
            message: 'Service fetched successfully by slug',
            data: services[0] // Return the single service object
        });

    } catch (error) {
        console.error('Error fetching service by slug:', error);
        res.status(500).json({ status: 500, error: 'Failed to fetch service by slug.' });
    }
});

// --- PATCH Toggle Active Status (/api/services/toggle-active/:id) ---
router.patch('/toggle-active/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const sql = 'UPDATE admin_services SET is_active = NOT is_active WHERE id = ?';

        const [result] = await db.query(sql, [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ status: 404, message: 'Service not found.' });
        }
        res.status(200).json({
            status: 200,
            message: 'Service active status toggled successfully.'
        });

    } catch (err) {
        console.error('Error toggling service status:', err);
        return res.status(500).json({ status: 500, message: 'Failed to toggle service status.', error: err.message });
    }
});

// --- GET Service Order Reset (Optional - if you want a reset endpoint) ---
router.post('/reset-order', async (req, res) => {
    try {
        await db.query('START TRANSACTION');

        try {
            // Reset all display_order to 0
            await db.query('UPDATE admin_services SET display_order = 0');
            
            // Re-order based on created_at (or any other criteria)
            const [services] = await db.query('SELECT id FROM admin_services ORDER BY created_at ASC');
            
            for (let i = 0; i < services.length; i++) {
                await db.query(
                    'UPDATE admin_services SET display_order = ? WHERE id = ?',
                    [i + 1, services[i].id]
                );
            }

            await db.query('COMMIT');

            res.status(200).json({
                status: 200,
                message: 'Service order reset successfully!',
                resetCount: services.length
            });

        } catch (error) {
            await db.query('ROLLBACK');
            throw error;
        }

    } catch (error) {
        console.error('Error resetting service order:', error);
        res.status(500).json({
            status: 500,
            error: 'Failed to reset service order.',
            details: error.message
        });
    }
});

// --- GET Next Display Order (Helper endpoint for frontend) ---
router.get('/next-display-order', async (req, res) => {
    try {
        const [result] = await db.query('SELECT COALESCE(MAX(display_order), 0) + 1 as next_order FROM admin_services');
        
        res.status(200).json({
            status: 200,
            nextDisplayOrder: result[0].next_order
        });

    } catch (error) {
        console.error('Error getting next display order:', error);
        res.status(500).json({
            status: 500,
            error: 'Failed to get next display order.'
        });
    }
});

module.exports = router;