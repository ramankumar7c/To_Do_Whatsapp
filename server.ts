import express from 'express';
import bodyParser from 'body-parser';
import { connectDB } from './lib/db';
import { Task } from './models/Task';
import { startCronJob } from './cron';

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));

app.post('/webhook', async (req, res) => {
  await connectDB();
  const messageBody = req.body.Body;

  const [message, dueDateStr, reminderBeforeStr] = messageBody.split('|').map((v: string) => v.trim());


  const dueDate = new Date(dueDateStr);
  const reminderDate = new Date(dueDate.getTime() - Number(reminderBeforeStr) * 60_000);

  await Task.create({ message, dueDate, reminderDate });

  res.set('Content-Type', 'text/xml');
  res.send(`<Response><Message>✅ Task added successfully!</Message></Response>`);
});

app.get('/', (req, res) => {
  res.send('To-Do WhatsApp Reminder App is running ✅');
});

app.listen(process.env.PORT || 3000, () => {
  console.log('✅ Server started on port 3000');
  startCronJob();
});
