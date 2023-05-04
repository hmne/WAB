import { Message } from "./message";
import { extractTextFromImage, extractTextFromPdf, detectLanguage } from "../features/text-extraction";

interface LanguageOptions {
  defaultLanguage?: "en" | "ar";
}

export function getLanguage(message: string, options: LanguageOptions = {}): { activationKeyword: string, requestKeyword: string, activationMessage: string, reminderMessage: string } {
  // يمكنك إضافة شروط للغات المختلفة هنا حسب رغبتك
  if (message.includes("بوت") || options.defaultLanguage === "ar") {
    return {
      activationKeyword: "بوت",
      requestKeyword: "حلل",
      activationMessage: "تم تفعيل البوت لاستخراج النص من الصور وملفات PDF.",
      reminderMessage: "يرجى إرسال الصورة أو ملف PDF لاستخراج النص.",
    };
  } else {
    return {
      activationKeyword: "bot",
      requestKeyword: "extract",
      activationMessage: "Bot activated for extracting text from images and PDF files.",
      reminderMessage: "Please send the image or PDF file to extract the text.",
    };
  }
}

export async function handleIncomingMessage(message: Message, settings: { defaultLanguage: "en" | "ar" }) {
  const language = getLanguage(message.body, settings);

  if (language.activationKeyword && message.body.includes(language.activationKeyword)) {
    if (language.requestKeyword && message.body.includes(language.requestKeyword)) {
      // المستخدم أرسل كلمات التفعيل والطلب معًا
      // قم بمعالجة الرسالة هنا (مثل استخراج النص من الوسائط المتعددة وإرساله إلى ChatGPT)

      if (message.hasMedia) {
        const media = await message.downloadMedia();

        if (media.mimetype.startsWith("image/")) {
          const extractedText = await extractTextFromImage(Buffer.from(media.data, "base64"), settings.defaultLanguage === "ar" ? "ara" : "eng");
          const detectedLanguage = await detectLanguage(extractedText);
          message.reply(`تم استخراج النص من الصورة: ${extractedText} (اللغة: ${detectedLanguage})`);
          return;
        } else if (media.mimetype === "application/pdf") {
          const extractedText = await extractTextFromPdf(Buffer.from(media.data, "base64"));
          const detectedLanguage = await detectLanguage(extractedText);
          message.reply(`تم استخراج النص من الملف PDF: ${extractedText} (اللغة: ${detectedLanguage})`);
          return;
        }
      }

    } else {
      // المستخدم أرسل كلمة التفعيل فقط
      await message.reply(language.activationMessage);
    }
  } else if (language.requestKeyword && message.body.includes(language.requestKeyword)) {
    // المستخدم أرسل كلمة الطلب فقط
    await message.reply(language.reminderMessage);
  }
}
