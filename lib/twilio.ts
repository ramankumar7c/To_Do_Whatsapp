import twilio from 'twilio';

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

export const sendWhatsAppMessage = async (message: string) => {
  await client.messages.create({
    from: process.env.TWILIO_WHATSAPP_FROM!,
    to: process.env.TWILIO_WHATSAPP_TO!,
    body: message,
  });
};
