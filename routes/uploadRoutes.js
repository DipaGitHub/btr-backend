const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory structure exists
const uploadsRootDir = path.join(__dirname, '..', 'uploads');
const latestUpdatesDir = path.join(uploadsRootDir, 'latest-updates');

// Create directories if they don't exist
if (!fs.existsSync(uploadsRootDir)) {
    fs.mkdirSync(uploadsRootDir, { recursive: true });
}
if (!fs.existsSync(latestUpdatesDir)) {
    fs.mkdirSync(latestUpdatesDir, { recursive: true });
}

console.log('📁 Upload directories:');
console.log('Root:', uploadsRootDir);
console.log('Latest Updates:', latestUpdatesDir);

// Configure multer storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, latestUpdatesDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname) || '.png';
        const filename = 'update-' + uniqueSuffix + ext;
        console.log('📸 Saving file as:', filename);
        cb(null, filename);
    }
});

// File filter
const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'));
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Upload endpoint
router.post('/upload', upload.single('image'), (req, res) => {
    try {
        console.log('📤 Upload request received');
        
        if (!req.file) {
            console.log('❌ No file in request');
            return res.status(400).json({ 
                success: false, 
                message: 'No image file uploaded' 
            });
        }

        console.log('📸 File details:', {
            filename: req.file.filename,
            originalname: req.file.originalname,
            path: req.file.path,
            size: req.file.size,
            mimetype: req.file.mimetype
        });

        // Check if file exists
        if (!fs.existsSync(req.file.path)) {
            console.error('❌ File was not saved:', req.file.path);
            return res.status(500).json({ 
                success: false, 
                message: 'File was not saved on server' 
            });
        }

        // Construct the URL to access the image
        const imageUrl = `/uploads/latest-updates/${req.file.filename}`;
        
        console.log('✅ Image uploaded successfully:', imageUrl);
        
        res.status(200).json({ 
            success: true, 
            message: 'Image uploaded successfully',
            imageUrl: imageUrl,
            fullUrl: `https://geemadhura.braventra.in${imageUrl}` // Provide full URL
        });

    } catch (error) {
        console.error('❌ Error uploading image:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to upload image',
            error: error.message 
        });
    }
});

// Test endpoint
router.get('/test-route', (req, res) => {
    res.status(200).json({ 
        success: true, 
        message: 'Upload route is working',
        timestamp: new Date().toISOString()
    });
});

module.exports = router;