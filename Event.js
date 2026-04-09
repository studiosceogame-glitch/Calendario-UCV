const mongoose = require('mongoose');

const EventSchema = new mongoose.Schema({
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  title: { type: String, required: true },
  description: { type: String },
  date: { type: Date, required: true },
  type: { type: String, enum: ['tarea', 'examen', 'proyecto', 'exposicion', 'otro'], default: 'tarea' },
  color: { type: String, default: '#7c6aff' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  authorName: { type: String },
  createdAt: { type: Date, default: Date.now },
  completions: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    userName: { type: String },
    completed: { type: Boolean, default: false },
    completedAt: { type: Date }
  }],
  reactions: {
    like: { type: Number, default: 0 },
    love: { type: Number, default: 0 },
    haha: { type: Number, default: 0 },
    wow: { type: Number, default: 0 },
    sad: { type: Number, default: 0 }
  }
});

module.exports = mongoose.model('Event', EventSchema);
