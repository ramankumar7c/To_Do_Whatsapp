import cron from 'node-cron';
import { connectDB } from './lib/db';
import { Task } from './models/Task';
import { sendWhatsAppMessage } from './lib/twilio';

export const startCronJob = () => {
  cron.schedule('* * * * *', async () => {
    await connectDB();
    const now = new Date();

    const tasks = await Task.find({
      reminderDate: { $lte: now },
    });

    for (const task of tasks) {
      await sendWhatsAppMessage(`🛎️ Reminder: ${task.message} at ${task.dueDate.toLocaleString()}`);
      await Task.findByIdAndDelete(task._id);
    }
  });
};