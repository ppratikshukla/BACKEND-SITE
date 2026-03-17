const Subject = require('../models/Subject.model');
const AttendanceLog = require('../models/AttendanceLog.model');

const SUBJECT_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#06b6d4', '#3b82f6'
];

// GET /api/subjects — list all subjects for the logged-in student
const getSubjects = async (req, res) => {
  try {
    const subjects = await Subject.find({ student: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, subjects });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/subjects — add a new subject
const addSubject = async (req, res) => {
  try {
    const { name, code } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: 'Subject name is required.' });
    }

    // Pick a color based on count
    const count = await Subject.countDocuments({ student: req.user._id });
    const color = SUBJECT_COLORS[count % SUBJECT_COLORS.length];

    const subject = await Subject.create({
      name,
      code: code || '',
      student: req.user._id,
      color
    });

    res.status(201).json({ success: true, message: 'Subject added!', subject });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /api/subjects/:id
const deleteSubject = async (req, res) => {
  try {
    const subject = await Subject.findOne({ _id: req.params.id, student: req.user._id });
    if (!subject) {
      return res.status(404).json({ success: false, message: 'Subject not found.' });
    }

    await Subject.findByIdAndDelete(req.params.id);
    await AttendanceLog.deleteMany({ subject: req.params.id });

    res.json({ success: true, message: 'Subject deleted.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/subjects/:id/mark — mark today's attendance
const markAttendance = async (req, res) => {
  try {
    const { status, date, note } = req.body; // status: 'present' | 'absent'

    if (!['present', 'absent'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Status must be present or absent.' });
    }

    const subject = await Subject.findOne({ _id: req.params.id, student: req.user._id });
    if (!subject) {
      return res.status(404).json({ success: false, message: 'Subject not found.' });
    }

    const logDate = date ? new Date(date) : new Date();
    logDate.setHours(0, 0, 0, 0);

    // Check if already marked for this date
    const existing = await AttendanceLog.findOne({
      subject: req.params.id,
      student: req.user._id,
      date: logDate
    });

    if (existing) {
      // Update existing
      const wasPresentBefore = existing.status === 'present';
      const isPresentNow = status === 'present';

      existing.status = status;
      existing.note = note || '';
      await existing.save();

      // Adjust counts
      if (wasPresentBefore && !isPresentNow) subject.presentCount--;
      if (!wasPresentBefore && isPresentNow) subject.presentCount++;
      await subject.save();

      return res.json({ success: true, message: 'Attendance updated!', subject });
    }

    // Create new log
    await AttendanceLog.create({
      subject: req.params.id,
      student: req.user._id,
      date: logDate,
      status,
      note: note || ''
    });

    subject.totalClasses++;
    if (status === 'present') subject.presentCount++;
    await subject.save();

    res.json({ success: true, message: `Marked as ${status}!`, subject });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/subjects/:id/logs — get attendance history for a subject
const getAttendanceLogs = async (req, res) => {
  try {
    const subject = await Subject.findOne({ _id: req.params.id, student: req.user._id });
    if (!subject) {
      return res.status(404).json({ success: false, message: 'Subject not found.' });
    }

    const logs = await AttendanceLog.find({
      subject: req.params.id,
      student: req.user._id
    }).sort({ date: -1 });

    res.json({ success: true, subject, logs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/subjects/dashboard — overall stats
const getDashboard = async (req, res) => {
  try {
    const subjects = await Subject.find({ student: req.user._id });

    const totalPresent = subjects.reduce((sum, s) => sum + s.presentCount, 0);
    const totalClasses = subjects.reduce((sum, s) => sum + s.totalClasses, 0);
    const overallPercentage = totalClasses > 0
      ? parseFloat(((totalPresent / totalClasses) * 100).toFixed(1))
      : 0;

    const subjectStats = subjects.map(s => ({
      _id: s._id,
      name: s.name,
      code: s.code,
      color: s.color,
      totalClasses: s.totalClasses,
      presentCount: s.presentCount,
      absentCount: s.totalClasses - s.presentCount,
      percentage: s.totalClasses > 0
        ? parseFloat(((s.presentCount / s.totalClasses) * 100).toFixed(1))
        : 0,
      isLow: s.totalClasses > 0 && (s.presentCount / s.totalClasses) * 100 < 75
    }));

    const alerts = subjectStats.filter(s => s.isLow);

    res.json({
      success: true,
      overallPercentage,
      totalPresent,
      totalClasses,
      totalSubjects: subjects.length,
      subjectStats,
      alerts,
      hasAlerts: alerts.length > 0
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getSubjects, addSubject, deleteSubject, markAttendance, getAttendanceLogs, getDashboard };
