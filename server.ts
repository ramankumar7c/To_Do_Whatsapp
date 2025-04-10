import express from 'express';
import bodyParser from 'body-parser';
import mongoose from 'mongoose';
import { Twilio } from 'twilio';
import moment from 'moment-timezone';
import cron from 'node-cron';

const app = express();
const port = process.env.PORT || 3000;

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID!;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN!;
const TWILIO_WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_FROM!;
const TWILIO_WHATSAPP_TO = process.env.TWILIO_WHATSAPP_TO!;

const client = new Twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

const MONGODB_URI = process.env.MONGODB_URI!;

mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch((error) => console.log('Error connecting to MongoDB:', error));

const taskSchema = new mongoose.Schema({
  message: String,
  dueDate: Date,
  reminderDate: Date,
  reminderSent: { type: Boolean, default: false },
});
const Task = mongoose.model('Task', taskSchema);

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

function convertISTToUTC(dateStr: string) {
  const timeZone = 'Asia/Kolkata';
  return moment.tz(dateStr, timeZone).utc().format();
}

function convertUTCToIST(utcDateStr: string) {
  const timeZone = 'Asia/Kolkata';
  return moment.utc(utcDateStr).tz(timeZone).format('DD/MM/YYYY HH:mm:ss');
}

app.post('/webhook', async (req, res) => {
  const messageBody = req.body.Body;
  const [message, dueDateStr, reminderBeforeStr] = messageBody.split(',').map((v: string) => v.trim());

  const dueDateInUTC = convertISTToUTC(dueDateStr);

  const reminderDateInUTC = moment(dueDateInUTC).subtract(parseInt(reminderBeforeStr), 'minutes').format();

  const task = new Task({
    message,
    dueDate: new Date(dueDateInUTC),
    reminderDate: new Date(reminderDateInUTC),
  });
  await task.save();

  console.log("Task saved:", task);

  await client.messages.create({
    from: TWILIO_WHATSAPP_FROM,
    to: TWILIO_WHATSAPP_TO,
    body: `Task: "${message}" has been saved. You will be reminded on ${convertUTCToIST(reminderDateInUTC)}`,
  });

  res.status(200).send('Message received');
});

cron.schedule('* * * * *', async () => {
  const now = new Date();
  const tasks = await Task.find({ reminderDate: { $lte: now }, reminderSent: { $ne: true } });

  for (const task of tasks) {
    await client.messages.create({
      from: TWILIO_WHATSAPP_FROM,
      to: TWILIO_WHATSAPP_TO,
      body: `Reminder: Your task "${task.message}" is due now.`,
    });

    task.reminderSent = true;
    await task.save();
  }
});

app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});