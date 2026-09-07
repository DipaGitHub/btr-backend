const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middleware ---
// Strip '/backend' prefix from the URL to support cPanel Passenger
app.use((req, res, next) => {
    if (req.url.startsWith('/backend')) {
        req.url = req.url.substring(8); // Remove '/backend'
    }
    next();
});
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// --- Routes ---
app.use('/api/banners', require('./routes/bannerRoutes'));
app.use('/api/videos', require('./routes/videoRoutes'));
app.use('/api/services', require('./routes/servicesRoutes'));
app.use('/api/faqs', require('./routes/faqRoutes'));
app.use('/api/testimonials', require('./routes/testimonialRoutes'));
app.use('/api/blogs', require('./routes/blogRoutes'));
app.use('/api/serviceApplications', require('./routes/serviceApplications'));
app.use('/api/portfolio', require('./routes/portfolioRoutes'));
app.use('/api/pricing', require('./routes/pricingRoutes'));
app.use('/api/upload', require('./routes/uploadRoutes'));
app.use('/api/leads', require('./routes/leadsRoutes'));
app.use('/api/logo-carousel', require('./routes/logoCarousel'));
app.use('/api/latestUpdates', require('./routes/latestUpdatesRoutes'));
app.use('/api/chat', require('./routes/chatRoutes'));
app.use('/api/email-config', require('./routes/emailConfigRoutes'));

// --- Root Route / Health Check ---
app.get('/', (req, res) => {
    res.status(200).json({
        message: "🚀 Server is running successfully!",
        status: "OK",
        version: "1.0.0"
    });
});

// --- Serve Static Public Assets ---
app.use('/public', express.static(path.join(__dirname, 'public')));

// --- Fallback 404 ---
app.use((req, res) => {
    res.status(404).send("Endpoint Not Found.");
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
