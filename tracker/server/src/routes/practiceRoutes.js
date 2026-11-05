const express = require('express');
const router = express.Router();
const practiceController = require('../controllers/practiceController');
const { requireAuth } = require('../middlewares/authMiddleware');

router.use(requireAuth);

router.get('/', practiceController.getProblems);
router.post('/:id/solve', practiceController.startProblem);
router.post('/sync', practiceController.syncProblems);

module.exports = router;
