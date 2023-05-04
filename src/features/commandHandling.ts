import { Message } from "whatsapp-web.js";
import { hasActivationKeyword, hasRequestKeyword } from "./multimediaSupport";
import { sendActivationMessage, sendReminderMessage } from "./userPreferences";

export const handleIncomingMessage = async (message: Message) => {
  if (hasActivationKeyword(message)) {
    if (hasRequestKeyword(message)) {
      // المستخدم أرسل "بوت" و "حلل" معًا
      // قم بمعالجة الرسالة هنا (مثل استخراج النص من الوسائط المتعددة وإرساله إلى ChatGPT)
    } else {
      // المستخدم أرسل "بوت" فقط
      await sendActivationMessage(message);
    }
  } else if (hasRequestKeyword(message)) {
    // المستخدم أرسل "حلل" فقط
    await sendReminderMessage(message);
  }
};
