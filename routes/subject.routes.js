const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const {
  getSubjects, addSubject, deleteSubject,
  markAttendance, getAttendanceLogs, getDashboard
} = require('../controllers/subject.controller');

router.use(protect);

router.get('/dashboard', getDashboard);
router.get('/', getSubjects);
router.post('/', addSubject);
router.delete('/:id', deleteSubject);
router.post('/:id/mark', markAttendance);
router.get('/:id/logs', getAttendanceLogs);

module.exports = router;
