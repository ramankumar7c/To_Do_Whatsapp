import mongoose from 'mongoose';

const TaskSchema = new mongoose.Schema({
  message: String,
  dueDate: Date,
  reminderDate: Date,
  createdAt: { type: Date, default: Date.now },
});

export const Task = mongoose.models.Task || mongoose.model('Task', TaskSchema);
