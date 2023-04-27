import { Message } from "whatsapp-web.js";

export const sendActivationMessage = async (message: Message) => {
  await message.reply("تم تفعيل البوت. الآن يمكنك إرسال كلمة 'حلل' لمعالجة الرسالة.");
};

export const sendReminderMessage = async (message: Message) => {
  await message.reply("يرجى إرسال كلمة 'بوت' لتفعيل البوت قبل إرسال كلمة 'حلل'.");
};
