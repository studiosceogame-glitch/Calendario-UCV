const express = require('express');
const router = express.Router();
const Course = require('./Course');
const Event = require('./Event');
const Comment = require('./Comment');
const User = require('./User');

// ===== COURSES =====

// Create course (admin only)
router.post('/courses', async (req, res) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Only admins can create courses' });
  }

  try {
    const course = await Course.create({
      name: req.body.name,
      description: req.body.description,
      color: req.body.color,
      createdBy: req.user._id
    });
    res.json(course);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== EVENTS =====

// Create event (admin only)
router.post('/courses/:courseId/events', async (req, res) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Only admins can create events' });
  }

  try {
    const event = await Event.create({
      course: req.params.courseId,
      title: req.body.title,
      description: req.body.description,
      date: req.body.date,
      type: req.body.type,
      color: req.body.color,
      createdBy: req.user._id,
      authorName: req.user.name
    });
    res.json(event);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== COMMENTS =====

// Create comment
router.post('/events/:eventId/comments', async (req, res) => {
  try {
    const comment = await Comment.create({
      event: req.params.eventId,
      text: req.body.text,
      createdBy: req.user._id,
      authorName: req.user.name,
      authorAvatar: req.user.avatar
    });
    res.json(comment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== REACTIONS =====

// Add reaction to comment
router.post('/comments/:commentId/reactions', async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    const reactionType = req.body.type; // 'like', 'love', 'haha', etc
    if (!comment.reactions) {
      comment.reactions = {};
    }

    if (!comment.reactions[reactionType]) {
      comment.reactions[reactionType] = 0;
    }
    comment.reactions[reactionType]++;

    await comment.save();
    res.json(comment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== TASK COMPLETION =====

// Mark task as completed/incomplete
router.post('/events/:eventId/completion', async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Find or create completion record for this user
    let completion = event.completions?.find(c => c.userId.toString() === req.user._id.toString());
    
    if (!completion) {
      completion = {
        userId: req.user._id,
        userName: req.user.name,
        completed: req.body.completed,
        completedAt: req.body.completed ? new Date() : null
      };
      if (!event.completions) event.completions = [];
      event.completions.push(completion);
    } else {
      completion.completed = req.body.completed;
      completion.completedAt = req.body.completed ? new Date() : null;
    }

    await event.save();
    res.json(event);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== EVENT REACTIONS =====

// Add reaction to event
router.post('/events/:eventId/reactions', async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const reactionType = req.body.type; // 'like', 'love', 'haha', 'wow', 'sad'
    if (!event.reactions) {
      event.reactions = {};
    }

    if (!event.reactions[reactionType]) {
      event.reactions[reactionType] = 0;
    }
    event.reactions[reactionType]++;

    await event.save();
    res.json(event);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== ADMIN =====

// Promote user to admin
router.post('/admin/promote', async (req, res) => {
  const { email, secret } = req.body;

  // Check admin secret
  if (secret !== process.env.ADMIN_SECRET) {
    return res.status(403).json({ error: 'Invalid admin secret' });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.role = 'admin';
    await user.save();

    res.json({ message: `User ${email} promoted to admin` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
