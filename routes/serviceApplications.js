const express = require('express');
const router = express.Router();
const db = require('../db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const sendEmail = require('../utils/sendEmail');

// --- Helper Functions ---
const generateApplicationId = () => {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const random = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `APP${year}${month}${random}`;
};

// --- Service-Specific Required Documents ---
const serviceDocuments = {
    'Homestay Registration': [
        'Property Ownership Proof',
        'Address Proof',
        'ID Proof',
        'Property Photos',
        'Fire Safety Certificate',
        'Police Verification'
    ],
    'Trade License': [
        'Business Address Proof',
        'Owner ID Proof',
        'Property Tax Receipt',
        'NOC from Property Owner',
        'Site Plan'
    ],
    'FoSTaC Trainings and Certification': [
        'Applicant ID Proof',
        'Educational Certificates',
        'Passport Size Photos',
        'Previous Experience Certificates'
    ],
    'GST & Business Registration': [
        'PAN Card',
        'Aadhaar Card',
        'Business Address Proof',
        'Bank Account Details',
        'Digital Signature Certificate'
    ],
    'ISO Certifications': [
        'Company Registration Certificate',
        'PAN Card',
        'Process Documentation',
        'Quality Manual',
        'Organization Chart'
    ],
    'Pollution Certificate': [
        'Industry Registration',
        'Layout Plan',
        'Water & Air Consent Application',
        'Effluent Treatment Plant Details',
        'NOC from Local Authority'
    ],
    'Factory License': [
        'Building Plan Approval',
        'Stability Certificate',
        'Fire NOC',
        'Electrical Installation Certificate',
        'Machinery List'
    ],
    'Fire Safety NOC': [
        'Building Plan',
        'Fire Fighting Equipment List',
        'Emergency Exit Plan',
        'No Objection Certificate Application'
    ],
    'Bar License': [
        'Premises Ownership Proof',
        'Police Verification',
        'Health Department NOC',
        'Municipal Corporation NOC',
        'Layout Plan'
    ],
    'FSSAI License': [
        'Form-B',
        'Food Safety Management Plan',
        'List of Food Products',
        'Proof of Possession of Premises',
        'Partnership Deed/Incorporation Certificate'
    ]
};

// --- Multer Setup for Document Uploads ---
const documentsStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = 'public/application-documents/';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const documentsUpload = multer({
    storage: documentsStorage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit per file
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

// Multiple file upload - up to 10 files
const uploadMultiple = documentsUpload.array('documents', 10);

// --- Middleware to handle Multer errors ---
const handleMulterError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                status: 400,
                error: 'File too large. Maximum size is 5MB per file.'
            });
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
            return res.status(400).json({
                status: 400,
                error: 'Unexpected field name. Field should be named "documents"'
            });
        }
        return res.status(400).json({
            status: 400,
            error: `File upload error: ${err.message}`
        });
    } else if (err) {
        return res.status(400).json({
            status: 400,
            error: err.message
        });
    }
    next();
};


// Add this endpoint to your backend to serve documents separately
router.get('/admin/application/:applicationId/documents', async (req, res) => {
    try {
        const { applicationId } = req.params;
        
        const [documents] = await db.query(
            `SELECT * FROM application_documents WHERE application_id = ? ORDER BY uploaded_at`,
            [applicationId]
        );
        
        res.status(200).json({
            status: 200,
            data: documents
        });
        
    } catch (error) {
        console.error('Error fetching application documents:', error);
        res.status(500).json({ 
            status: 500, 
            error: 'Failed to fetch application documents.' 
        });
    }
});

// --- API Endpoints ---

// 1. GET Service Details and Required Documents
router.get('/service-details/:serviceId', async (req, res) => {
    try {
        const { serviceId } = req.params;
        
        const [services] = await db.query(
            'SELECT id, name, description, scope_title, scope_content FROM admin_services WHERE id = ? AND is_active = 1',
            [serviceId]
        );
        
        if (services.length === 0) {
            return res.status(404).json({ 
                status: 404, 
                error: 'Service not found or inactive.' 
            });
        }
        
        const service = services[0];
        const requiredDocuments = serviceDocuments[service.name] || [];
        
        res.status(200).json({
            status: 200,
            data: {
                service,
                requiredDocuments
            }
        });
        
    } catch (error) {
        console.error('Error fetching service details:', error);
        res.status(500).json({ 
            status: 500, 
            error: 'Failed to fetch service details.' 
        });
    }
});

// 2. SUBMIT Application (with document uploads)
router.post('/submit-application', (req, res, next) => {
    uploadMultiple(req, res, function(err) {
        if (err) {
            return handleMulterError(err, req, res, next);
        }
        next();
    });
}, async (req, res) => {
    try {
        // Debug: Log what we received
        console.log('Received files:', req.files ? req.files.length : 0);
        console.log('Received body keys:', Object.keys(req.body));
        
        // Parse form data
        let formData;
        if (req.body.applicationData) {
            try {
                formData = JSON.parse(req.body.applicationData);
            } catch (parseError) {
                console.error('Error parsing applicationData:', parseError);
                return res.status(400).json({
                    status: 400,
                    error: 'Invalid application data format'
                });
            }
        } else {
            // If no applicationData field, use req.body directly
            formData = req.body;
        }
        
        console.log('Parsed form data:', formData);
        
        const {
            service_id,
            service_name,
            customer_name,
            customer_email,
            customer_phone,
            customer_address,
            customer_city,
            customer_state,
            customer_pincode,
            business_name,
            business_type,
            application_details
        } = formData || {};
        
        // Validation
        if (!service_id || !customer_name || !customer_email || !customer_phone) {
            // Cleanup uploaded files if validation fails
            if (req.files) {
                req.files.forEach(file => {
                    if (fs.existsSync(file.path)) {
                        fs.unlinkSync(file.path);
                    }
                });
            }
            return res.status(400).json({ 
                status: 400, 
                error: 'Service ID, Name, Email, and Phone are required.' 
            });
        }
        
        // Generate application ID
        const applicationId = generateApplicationId();
        
        // Start transaction
        await db.query('START TRANSACTION');
        
        try {
            // Insert application
            const applicationSql = `
                INSERT INTO service_applications (
                    application_id, service_id, service_name,
                    customer_name, customer_email, customer_phone,
                    customer_address, customer_city, customer_state,
                    customer_pincode, business_name, business_type,
                    application_details, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
            `;
            
            const applicationValues = [
                applicationId, 
                parseInt(service_id) || 0, 
                service_name || '',
                customer_name || '',
                customer_email || '',
                customer_phone || '',
                customer_address || null,
                customer_city || null,
                customer_state || null,
                customer_pincode || null,
                business_name || null,
                business_type || null,
                application_details ? JSON.stringify(application_details) : null
            ];
            
            const [applicationResult] = await db.query(applicationSql, applicationValues);
            
            // Save uploaded documents
            if (req.files && req.files.length > 0) {
                console.log('Saving', req.files.length, 'documents');
                
                const documentPromises = req.files.map(file => {
                    const documentSql = `
                        INSERT INTO application_documents (
                            application_id, document_type, document_name,
                            file_path, file_size, file_type
                        ) VALUES (?, ?, ?, ?, ?, ?)
                    `;
                    
                    const docType = 'uploaded_document';
                    const filePath = `/public/application-documents/${file.filename}`;
                    
                    console.log('Saving document:', file.originalname, 'to', filePath);
                    
                    return db.query(documentSql, [
                        applicationId,
                        docType,
                        file.originalname,
                        filePath,
                        file.size,
                        file.mimetype
                    ]);
                });
                
                await Promise.all(documentPromises);
                console.log('All documents saved successfully');
            }
            
            // Add to history
            const historySql = `
                INSERT INTO application_history (application_id, status, notes)
                VALUES (?, 'pending', 'Application submitted successfully.')
            `;
            await db.query(historySql, [applicationId]);
            
            await db.query('COMMIT');
            
            console.log('Application submitted successfully:', applicationId);
            
            // Send email notification asynchronously
            sendEmail({
                subject: `New Service Application: ${customer_name} (${service_name})`,
                html: `
                    <h3>New Service Application</h3>
                    <p><strong>Application ID:</strong> ${applicationId}</p>
                    <p><strong>Service:</strong> ${service_name}</p>
                    <p><strong>Applicant Name:</strong> ${customer_name}</p>
                    <p><strong>Email:</strong> ${customer_email}</p>
                    <p><strong>Phone:</strong> ${customer_phone}</p>
                    <p><strong>City/State:</strong> ${customer_city || 'N/A'}, ${customer_state || 'N/A'}</p>
                `
            });

            res.status(201).json({
                status: 201,
                message: 'Application submitted successfully!',
                data: {
                    applicationId,
                    applicationNumber: applicationId,
                    submittedAt: new Date().toISOString()
                }
            });
            
        } catch (dbError) {
            await db.query('ROLLBACK');
            
            console.error('Database error:', dbError);
            
            // Cleanup uploaded files on DB error
            if (req.files) {
                req.files.forEach(file => {
                    if (fs.existsSync(file.path)) {
                        fs.unlinkSync(file.path);
                    }
                });
            }
            
            throw dbError;
        }
        
    } catch (error) {
        console.error('Error submitting application:', error);
        res.status(500).json({ 
            status: 500, 
            error: 'Failed to submit application.', 
            details: error.message 
        });
    }
});

// 3. GET All Applications (Admin)
router.get('/admin/applications', async (req, res) => {
    try {
        const { 
            page = 1, 
            limit = 10, 
            status, 
            service_id, 
            search,
            startDate,
            endDate
        } = req.query;
        
        const offset = (page - 1) * limit;
        let query = `
            SELECT 
                sa.*,
                COUNT(ad.id) as document_count,
                (SELECT status FROM application_history 
                 WHERE application_id = sa.application_id 
                 ORDER BY changed_at DESC LIMIT 1) as last_status
            FROM service_applications sa
            LEFT JOIN application_documents ad ON sa.application_id = ad.application_id
        `;
        
        let countQuery = `SELECT COUNT(*) as total FROM service_applications sa`;
        let conditions = [];
        let params = [];
        let countParams = [];
        
        if (status) {
            conditions.push('sa.status = ?');
            params.push(status);
            countParams.push(status);
        }
        
        if (service_id) {
            conditions.push('sa.service_id = ?');
            params.push(service_id);
            countParams.push(service_id);
        }
        
        if (search) {
            conditions.push(`
                (sa.application_id LIKE ? OR 
                 sa.customer_name LIKE ? OR 
                 sa.customer_email LIKE ? OR 
                 sa.customer_phone LIKE ?)
            `);
            const searchParam = `%${search}%`;
            params.push(searchParam, searchParam, searchParam, searchParam);
            countParams.push(searchParam, searchParam, searchParam, searchParam);
        }
        
        if (startDate && endDate) {
            conditions.push('DATE(sa.created_at) BETWEEN ? AND ?');
            params.push(startDate, endDate);
            countParams.push(startDate, endDate);
        }
        
        if (conditions.length > 0) {
            const whereClause = ' WHERE ' + conditions.join(' AND ');
            query += whereClause;
            countQuery += whereClause;
        }
        
        query += ` GROUP BY sa.id ORDER BY sa.created_at DESC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));
        
        const [applications] = await db.query(query, params);
        const [countResult] = await db.query(countQuery, countParams);
        const total = countResult[0].total;
        
        res.status(200).json({
            status: 200,
            data: applications,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / limit)
            }
        });
        
    } catch (error) {
        console.error('Error fetching applications:', error);
        res.status(500).json({ 
            status: 500, 
            error: 'Failed to fetch applications.' 
        });
    }
});

// 4. GET Single Application Details (Admin)
router.get('/admin/application/:applicationId', async (req, res) => {
    try {
        const { applicationId } = req.params;
        
        // Get application details
        const [applications] = await db.query(
            `SELECT * FROM service_applications WHERE application_id = ?`,
            [applicationId]
        );
        
        if (applications.length === 0) {
            return res.status(404).json({ 
                status: 404, 
                error: 'Application not found.' 
            });
        }
        
        // Get documents
        const [documents] = await db.query(
            `SELECT * FROM application_documents WHERE application_id = ? ORDER BY uploaded_at`,
            [applicationId]
        );
        
        // Get status history
        const [history] = await db.query(
            `SELECT * FROM application_history WHERE application_id = ? ORDER BY changed_at DESC`,
            [applicationId]
        );
        
        res.status(200).json({
            status: 200,
            data: {
                application: applications[0],
                documents,
                history
            }
        });
        
    } catch (error) {
        console.error('Error fetching application details:', error);
        res.status(500).json({ 
            status: 500, 
            error: 'Failed to fetch application details.' 
        });
    }
});

// 5. UPDATE Application Status (Admin)
router.put('/admin/application/:applicationId/status', async (req, res) => {
    try {
        const { applicationId } = req.params;
        const { status, admin_notes, assigned_to } = req.body;
        
        if (!status || !['pending', 'under_review', 'approved', 'rejected', 'needs_more_info'].includes(status)) {
            return res.status(400).json({ 
                status: 400, 
                error: 'Valid status is required.' 
            });
        }
        
        await db.query('START TRANSACTION');
        
        try {
            // Update application status
            const updateSql = `
                UPDATE service_applications 
                SET status = ?, admin_notes = ?, assigned_to = ?, updated_at = CURRENT_TIMESTAMP 
                WHERE application_id = ?
            `;
            
            await db.query(updateSql, [status, admin_notes || null, assigned_to || null, applicationId]);
            
            // Add to history
            const historySql = `
                INSERT INTO application_history (application_id, status, notes, changed_by)
                VALUES (?, ?, ?, ?)
            `;
            await db.query(historySql, [applicationId, status, admin_notes || 'Status updated', req.user?.id || null]);
            
            await db.query('COMMIT');
            
            res.status(200).json({
                status: 200,
                message: 'Application status updated successfully.'
            });
            
        } catch (error) {
            await db.query('ROLLBACK');
            throw error;
        }
        
    } catch (error) {
        console.error('Error updating application status:', error);
        res.status(500).json({ 
            status: 500, 
            error: 'Failed to update application status.' 
        });
    }
});

// 6. UPDATE Document Verification Status
router.put('/admin/document/:documentId/verify', async (req, res) => {
    try {
        const { documentId } = req.params;
        const { verified, verification_notes } = req.body;
        
        const updateSql = `
            UPDATE application_documents 
            SET verified = ?, verification_notes = ? 
            WHERE id = ?
        `;
        
        const [result] = await db.query(updateSql, [verified || false, verification_notes || null, documentId]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ 
                status: 404, 
                error: 'Document not found.' 
            });
        }
        
        res.status(200).json({
            status: 200,
            message: 'Document verification status updated.'
        });
        
    } catch (error) {
        console.error('Error updating document verification:', error);
        res.status(500).json({ 
            status: 500, 
            error: 'Failed to update document verification.' 
        });
    }
});

// 7. GET Application Statistics (Dashboard)
router.get('/admin/statistics', async (req, res) => {
    try {
        const [stats] = await db.query(`
            SELECT 
                COUNT(*) as total_applications,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = 'under_review' THEN 1 ELSE 0 END) as under_review,
                SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
                SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
                SUM(CASE WHEN status = 'needs_more_info' THEN 1 ELSE 0 END) as needs_more_info,
                COUNT(DISTINCT service_id) as unique_services,
                DATE(created_at) as date,
                COUNT(*) as daily_count
            FROM service_applications 
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            GROUP BY DATE(created_at)
            ORDER BY date DESC
        `);
        
        const [serviceStats] = await db.query(`
            SELECT 
                service_name,
                COUNT(*) as count,
                service_id
            FROM service_applications 
            GROUP BY service_id, service_name
            ORDER BY count DESC
            LIMIT 10
        `);
        
        res.status(200).json({
            status: 200,
            data: {
                dailyStats: stats,
                serviceStats,
                summary: {
                    total: stats.reduce((sum, day) => sum + day.total_applications, 0),
                    pending: stats.reduce((sum, day) => sum + day.pending, 0),
                    under_review: stats.reduce((sum, day) => sum + day.under_review, 0),
                    approved: stats.reduce((sum, day) => sum + day.appmitted, 0)
                }
            }
        });
        
    } catch (error) {
        console.error('Error fetching statistics:', error);
        res.status(500).json({ 
            status: 500, 
            error: 'Failed to fetch statistics.' 
        });
    }
});

// 8. GET User's Applications (if user is logged in)
router.get('/my-applications', async (req, res) => {
    try {
        // Assuming user ID comes from auth middleware
        const userId = req.user?.id;
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;
        
        if (!userId) {
            return res.status(401).json({ 
                status: 401, 
                error: 'Authentication required.' 
            });
        }
        
        const [applications] = await db.query(`
            SELECT 
                sa.*,
                COUNT(ad.id) as document_count
            FROM service_applications sa
            LEFT JOIN application_documents ad ON sa.application_id = ad.application_id
            WHERE sa.user_id = ?
            GROUP BY sa.id
            ORDER BY sa.created_at DESC
            LIMIT ? OFFSET ?
        `, [userId, parseInt(limit), parseInt(offset)]);
        
        const [countResult] = await db.query(
            'SELECT COUNT(*) as total FROM service_applications WHERE user_id = ?',
            [userId]
        );
        
        res.status(200).json({
            status: 200,
            data: applications,
            pagination: {
                total: countResult[0].total,
                page: parseInt(page),
                limit: parseInt(limit)
            }
        });
        
    } catch (error) {
        console.error('Error fetching user applications:', error);
        res.status(500).json({ 
            status: 500, 
            error: 'Failed to fetch applications.' 
        });
    }
});

// 9. ADD Additional Documents to Application
router.post('/application/:applicationId/documents', documentsUpload.array('documents', 5), async (req, res) => {
    try {
        const { applicationId } = req.params;
        
        // Check if application exists
        const [applications] = await db.query(
            'SELECT id FROM service_applications WHERE application_id = ?',
            [applicationId]
        );
        
        if (applications.length === 0) {
            // Cleanup files
            if (req.files) {
                req.files.forEach(file => fs.unlinkSync(file.path));
            }
            return res.status(404).json({ 
                status: 404, 
                error: 'Application not found.' 
            });
        }
        
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ 
                status: 400, 
                error: 'No documents provided.' 
            });
        }
        
        // Save documents
        const documentPromises = req.files.map(file => {
            return db.query(`
                INSERT INTO application_documents (
                    application_id, document_type, document_name,
                    file_path, file_size, file_type
                ) VALUES (?, ?, ?, ?, ?, ?)
            `, [
                applicationId,
                req.body.document_type || 'additional',
                file.originalname,
                `/public/application-documents/${file.filename}`,
                file.size,
                file.mimetype
            ]);
        });
        
        await Promise.all(documentPromises);
        
        res.status(201).json({
            status: 201,
            message: 'Documents uploaded successfully.',
            count: req.files.length
        });
        
    } catch (error) {
        console.error('Error uploading additional documents:', error);
        if (req.files) {
            req.files.forEach(file => {
                if (fs.existsSync(file.path)) {
                    fs.unlinkSync(file.path);
                }
            });
        }
        res.status(500).json({ 
            status: 500, 
            error: 'Failed to upload documents.' 
        });
    }
});

// 10. DOWNLOAD Application Documents (ZIP all documents)
router.get('/admin/application/:applicationId/download', async (req, res) => {
    try {
        const { applicationId } = req.params;
        
        // Get all documents for this application
        const [documents] = await db.query(
            'SELECT file_path, document_name FROM application_documents WHERE application_id = ?',
            [applicationId]
        );
        
        if (documents.length === 0) {
            return res.status(404).json({ 
                status: 404, 
                error: 'No documents found for this application.' 
            });
        }
        
        // In a real implementation, you would create a ZIP file here
        // For now, return the list of files
        
        res.status(200).json({
            status: 200,
            data: {
                applicationId,
                documents: documents.map(doc => ({
                    name: doc.document_name,
                    path: doc.file_path,
                    url: `${req.protocol}://${req.get('host')}${doc.file_path}`
                }))
            }
        });
        
    } catch (error) {
        console.error('Error preparing download:', error);
        res.status(500).json({ 
            status: 500, 
            error: 'Failed to prepare download.' 
        });
    }
});

module.exports = router;