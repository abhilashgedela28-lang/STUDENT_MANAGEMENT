const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');
const { requireAuth } = require('../middlewares/authMiddleware');

router.use(requireAuth);

router.get('/links', profileController.getLinkedPlatforms);
router.post('/link', profileController.initiateLink);
router.post('/verify', profileController.verifyLink);
router.delete('/unlink', profileController.unlinkPlatform);

module.exports = router;
