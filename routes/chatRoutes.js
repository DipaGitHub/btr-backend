const express = require('express');
const router = express.Router();
const chatController = require('./chatController');

// Public - for frontend widget
router.get('/config', chatController.getChatConfig);

// Admin - for admin panel
router.get('/admin/config', chatController.getAdminConfig);
router.post('/admin/topics/toggle', chatController.toggleTopic);
router.put('/admin/topics/label', chatController.updateTopicLabel);
router.post('/admin/questions', chatController.createQuestion);
router.delete('/admin/questions/:id', chatController.deleteQuestion);

module.exports = router;
