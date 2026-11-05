const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { requireAuth, requireAdmin } = require('../middlewares/authMiddleware');

router.use(requireAuth, requireAdmin);

// Problem management
router.post('/problems/preview', adminController.previewProblemUrl);
router.post('/problems', adminController.createProblem);
router.post('/problems/bulk', adminController.bulkAddProblems);
router.get('/problems', adminController.listProblems);
router.put('/problems/:id', adminController.updateProblem);
router.delete('/problems/:id', adminController.deleteProblem);

// User management
router.get('/users', adminController.listUsers);
router.delete('/links/:platform/:username', async (req, res, next) => {
  try {
    const PlatformLink = require('../models/PlatformLink');
    await PlatformLink.deleteMany({
      platform: req.params.platform.toUpperCase(),
      usernameLower: req.params.username.toLowerCase(),
    });
    res.json({ success: true, message: 'Platform link reset successfully.' });
  } catch (err) {
    next(err);
  }
});

// Snapshot trigger
router.post('/snapshots/trigger', adminController.triggerSnapshot);

module.exports = router;
