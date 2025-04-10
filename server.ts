import express from 'express';
import bodyParser from 'body-parser';
import mongoose from 'mongoose';
import { twilio } from 'twilio';
import moment from 'moment-timezone';
import cron from 'node-cron';

const app = express();
const port = process.env.PORT || 3000;

// Twilio credentials from environment variables
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID!;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN!;
const TWILIO_WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_FROM!;
const TWILIO_WHATSAPP_TO = process.env.TWILIO_WHATSAPP_TO!;

// Create Twilio client
const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

// MongoDB connection URI
const MONGODB_URI = process.env.MONGODB_URI!;

// Connect to MongoDB
mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB'))
  .catch((error) => console.log('Error connecting to MongoDB:', error));

// Define a Task schema for MongoDB
const taskSchema = new mongoose.Schema({
  message: String,
  dueDate: Date,
  reminderDate: Date,
});
const Task = mongoose.model('Task', taskSchema);

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Helper function to convert IST to UTC
function convertISTToUTC(dateStr: string) {
  const timeZone = 'Asia/Kolkata'; // IST time zone
  return moment.tz(dateStr, timeZone).utc().format(); // Converts IST to UTC
}

// Helper function to convert UTC back to IST
function convertUTCToIST(utcDateStr: string) {
  const timeZone = 'Asia/Kolkata'; // IST time zone
  return moment.utc(utcDateStr).tz(timeZone).format('YYYY-MM-DD HH:mm:ss'); // Converts UTC to IST
}

// Webhook to handle incoming WhatsApp messages
app.post('/webhook', async (req, res) => {
  const messageBody = req.body.Body; // Get the message body
  const [message, dueDateStr, reminderBeforeStr] = messageBody.split('|').map(v => v.trim());

  // Convert the due date from IST to UTC
  const dueDateInUTC = convertISTToUTC(dueDateStr);

  // Calculate reminder time in UTC
  const reminderDateInUTC = moment(dueDateInUTC).subtract(parseInt(reminderBeforeStr), 'minutes').format();

  // Save task to MongoDB
  const task = new Task({
    message,
    dueDate: new Date(dueDateInUTC),
    reminderDate: new Date(reminderDateInUTC),
  });
  await task.save();

  // Log the task details for debugging
  console.log("Task saved:", task);

  // Send a confirmation message to WhatsApp
  await client.messages.create({
    from: TWILIO_WHATSAPP_FROM,
    to: TWILIO_WHATSAPP_TO,
    body: `Task: "${message}" has been saved. You will be reminded on ${convertUTCToIST(reminderDateInUTC)}`,
  });

  res.status(200).send('Message received');
});

// Schedule reminders using cron jobs
cron.schedule('* * * * *', async () => {
  const now = new Date();
  const tasks = await Task.find({ reminderDate: { $lte: now }, reminderSent: { $ne: true } });

  for (const task of tasks) {
    // Send reminder via WhatsApp
    await client.messages.create({
      from: TWILIO_WHATSAPP_FROM,
      to: TWILIO_WHATSAPP_TO,
      body: `Reminder: Your task "${task.message}" is due now.`,
    });

    // Mark the task as reminder sent
    task.reminderSent = true;
    await task.save();
  }
});

// Start the Express server
app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});
