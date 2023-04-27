import defaultLanguage from "./settings";
import { getLanguage } from "./languages";
import { createUniqueId } from "./userUtils";
import { startsWithIgnoreCase } from "../utils";
import { Message, Client } from 'whatsapp-web.js';
import MessageCollector from "./MessageCollector";
import * as PDFJS from "pdfjs-dist/legacy/build/pdf";
import arLang from "i18n-iso-countries/langs/ar.json";
import { searchFlights } from "../features/skyscanner";
import { registerLocale, getAlpha2Code } from "i18n-iso-countries";
import { handleIncomingMessage as handleIncomingMessageLanguage } from "./languages";
import { extractTextFromImage, extractTextFromPdf, detectLanguage } from "../features/text-extraction";


// Config & Constants
import config from "../config";

// CLI
import * as cli from "../cli/ui";

// ChatGPT & DALLE
import { handleMessageGPT, handleDeleteConversation } from "../handlers/gpt";
import { handleMessageDALLE } from "../handlers/dalle";
import { handleMessageAIConfig } from "../handlers/ai-config";

// Speech API & Whisper
import { TranscriptionMode } from "../types/transcription-mode";
import { transcribeRequest } from "../providers/speech";
import { transcribeAudioLocal } from "../providers/whisper-local";
import { transcribeWhisperApi } from "../providers/whisper-api";
import { transcribeOpenAI } from "../providers/openai";

// For deciding to ignore old messages
import { botReadyTimestamp } from "../index";

registerLocale(arLang);

function getCountryCode(countryName: string): string {
  const countryCode = getAlpha2Code(countryName, "ar");
  if (!countryCode) {
    throw new Error(`Country not found for name: ${countryName}`);
  }
  return countryCode;
}

const flightRegex = /^\.رحله(?: من (\S+))?(?: ل(\S+))?(?: بتاريخ (\S+))?$/;


interface SessionData {
  step: number;
  maxAttempts: number;
  attempts: number;
  origin: string | null;
  destination: string | null;
  date: string | null;
}

export function isCountryOrCodeValid(input: string): boolean {
  // يمكنك استخدام هذه الدالة للتحقق من صحة اسم الدولة باللغة العربية أو رمز الدولة
  const country = arabicCountries.find(
    (c) => c.name === input.trim() || c.code === input.trim().toUpperCase()
  );
  return !!country;
}


function isDateValid(date: string): boolean {
  // يمكنك إضافة كود التحقق من صحة التاريخ هنا
  return true;
}


// Handles message
async function handleMessage(client: Client, message: Message) {
  const senderId = message?.sender?.id;

  if (!senderId) {
    return;
  }

  const uniqueId = createUniqueId(senderId);

  if (!sessions[uniqueId]) {
    sessions[uniqueId] = {
      step: 0,
      maxAttempts: 3,
      attempts: 0,
      origin: null,
      destination: null,
      date: null,
    };
  }

  const session = sessions[uniqueId];

  const messageContent = message.body.toLowerCase().trim();

  if (messageContent === ".رحله") {
    session.step = 1;
    session.attempts = 0;
    await client.sendMessage(
      message.from,
      "الرجاء إدخال اسم الدولة أو رمز الدولة الذي ترغب في السفر منه."
    );
    return;
  }

  if (session.step === 0) {
    if (messageContent.startsWith(".رحله من ")) {
      // تحقق من صحة البيانات المدخلة مباشرة
      const [_, origin, destination, date] = messageContent.split(" ");
      if (isCountryOrCodeValid(origin) && isCountryOrCodeValid(destination) && isDateValid(date)) {
        // يمكنك إضافة كود لإنشاء الرحلة هنا
        await client.sendMessage(message.from, "تم إنشاء الرحلة بنجاح.");
        return;
      } else {
        await client.sendMessage(message.from, "البيانات المدخلة غير صحيحة. الرجاء التأكد من صحة المعلومات المقدمة.");
        return;
      }
    }
  }

  if (session.step > 0) {
    if (session.attempts < session.maxAttempts) {
      if (session.step === 1) {
        if (isCountryOrCodeValid(messageContent)) {
          session.origin = messageContent;
          session.step = 2;
          session.attempts = 0;
                    await client.sendMessage(
            message.from,
            "الرجاء إدخال اسم الدولة أو رمز الدولة الذي ترغب في السفر إليه."
          );
          return;
        } else {
          session.attempts++;
          if (session.attempts < session.maxAttempts) {
            await client.sendMessage(
              message.from,
              "اسم الدولة أو رمز الدولة غير صحيح. الرجاء المحاولة مرة أخرى."
            );
          } else {
            await client.sendMessage(
              message.from,
              "لقد تجاوزت عدد المحاولات المسموح بها. تم إيقاف الخدمة."
            );
            delete sessions[uniqueId];
          }
          return;
        }
      } else if (session.step === 2) {
        if (isCountryOrCodeValid(messageContent)) {
          session.destination = messageContent;
          session.step = 3;
          session.attempts = 0;
          await client.sendMessage(
            message.from,
            "الرجاء إدخال تاريخ الرحلة بالتنسيق الصحيح (مثال: 25/5/2023)."
          );
          return;
        } else {
          session.attempts++;
          if (session.attempts < session.maxAttempts) {
            await client.sendMessage(
              message.from,
              "اسم الدولة أو رمز الدولة غير صحيح. الرجاء المحاولة مرة أخرى."
            );
          } else {
            await client.sendMessage(
              message.from,
              "لقد تجاوزت عدد المحاولات المسموح بها. تم إيقاف الخدمة."
            );
            delete sessions[uniqueId];
          }
          return;
        }
      } else if (session.step === 3) {
        if (isDateValid(messageContent)) {
          session.date = messageContent;
          // يمكنك إضافة كود لإنشاء الرحلة هنا
          await client.sendMessage(message.from, "تم إنشاء الرحلة بنجاح.");
          delete sessions[uniqueId];
          return;
        } else {
          session.attempts++;
          if (session.attempts < session.maxAttempts) {
            await client.sendMessage(
              message.from,
              "التاريخ المدخل غير صحيح. الرجاء المحاولة مرة أخرى."
            );
          } else {
            await client.sendMessage(
              message.from,
              "لقد تجاوزت عدد المحاولات المسموح بها. تم إيقاف الخدمة."
            );
            delete sessions[uniqueId];
          }
          return;
        }
      }
    }
  }

  if (message.hasMedia) {
    const media = await message.downloadMedia();
    const language = getLanguage(message.body, { defaultLanguage: "ar" });
    if (
      message.body.includes(language.activationKeyword) ||
      message.body.includes(language.requestKeyword)
    ) {
      if (media.mimetype.startsWith("image/")) {
        const extractedText = await extractTextFromImage(Buffer.from(media.data, "base64"));
        const detectedLanguage = await detectLanguage(extractedText);
        message.reply(`تم استخراج النص من الصورة:\n${extractedText} \n(اللغة: ${detectedLanguage})`);
        return;
      } else if (media.mimetype === "application/pdf") {
        const extractedText = await extractTextFromPdf(Buffer.from(media.data, "base64"));
        const detectedLanguage = await detectLanguage(extractedText);
        message.reply(`تم استخراج النص من الملف PDF: ${extractedText} (اللغة: ${detectedLanguage})`
        );
        return;
      }
    }

  // Prevent handling old messages
  if (message.timestamp != null) {
    const messageTimestamp = new Date(message.timestamp * 1000);

    // If startTimestamp is null, the bot is not ready yet
    if (botReadyTimestamp == null) {
      cli.print("تجاهل الرسالة لأن البوت ليس جاهزًا: " + messageString);
      return;
    }

    // Ignore messages that are sent before the bot is started
    if (messageTimestamp < botReadyTimestamp) {
      cli.print("تجاهل الرسائل القديمة: " + messageString);
      return;
    }
  }

  // Ignore group chats if disabled
  if ((await message.getChat()).isGroup && !config.groupchatsEnabled) return;

  // Transcribe audio
  if (message.hasMedia) {
    const media = await message.downloadMedia();

    // Ignore non-audio media
    if (!media || !media.mimetype.startsWith("audio/")) return;

    // Check if transcription is enabled (Default: false)
    if (!config.transcriptionEnabled) {
 	     cli.print("تم استلام رسالة صوتية لكن الخدمة معطلة");
 	     return;
 	   }

  	  // Convert media to base64 string
  	  const mediaBuffer = Buffer.from(media.data, "base64");

 	   // Transcribe locally or with Speech API
 	   cli.print(`[Transcription] تحويل الصوت إلى نص من خلال وضع "${config.transcriptionMode}"...`);

	    let res;
   	 switch (config.transcriptionMode) {
   	   case TranscriptionMode.Local:
   	     res = await transcribeAudioLocal(mediaBuffer);
   	     break;
   	   case TranscriptionMode.OpenAI:
   	     res = await transcribeOpenAI(mediaBuffer);
   	     break;
   	   case TranscriptionMode.WhisperAPI:
   	     res = await transcribeWhisperApi(new Blob([mediaBuffer]));
   	     break;
  	    case TranscriptionMode.SpeechAPI:
   	     res = await transcribeRequest(new Blob([mediaBuffer]));
   	     break;
   	   default:
   	     cli.print(`[Transcription] نوع التحويل غير مدعوم: ${config.transcriptionMode}`);
   	 }
		const { text: transcribedText, language: transcribedLanguage } = res;

		// Check transcription is null (error)
		if (transcribedText == null) {
			message.reply("مو فاهم الجحش شنو قال");
			return;
		}

		// Check transcription is empty (silent voice message)
		if (transcribedText.length == 0) {
			message.reply("مو فاهم شنو قلت");
			return;
		}

		// Log transcription
		cli.print(`[Transcription] الرد على التنصيص: ${transcribedText} (الغه: ${transcribedLanguage})`);

		// Reply with transcription
		const reply = `انت قلت: ${transcribedText}${transcribedLanguage ? " (الغه: " + transcribedLanguage + ")" : ""}`;
		message.reply(reply);

		// Handle message GPT
		await handleMessageGPT(message, transcribedText);
		return;
	}

	// Clear conversation context (!clear)
	if (startsWithIgnoreCase(messageString, config.resetPrefix)) {
		await handleDeleteConversation(message);
		return;
	}

	// AiConfig (!config <args>)
	if (startsWithIgnoreCase(messageString, config.aiConfigPrefix)) {
		const prompt = messageString.substring(config.aiConfigPrefix.length + 1);
		await handleMessageAIConfig(message, prompt);
		return;
	}

	// GPT (only <prompt>)

	const selfNotedMessage = message.fromMe && message.hasQuotedMsg === false && message.from === message.to;

	// GPT (!gpt <prompt>)
	if (startsWithIgnoreCase(messageString, config.gptPrefix)) {
		const prompt = messageString.substring(config.gptPrefix.length + 1);
		await handleMessageGPT(message, prompt);
		return;
	}

	// DALLE (!dalle <prompt>)
	if (startsWithIgnoreCase(messageString, config.dallePrefix)) {
		const prompt = messageString.substring(config.dallePrefix.length + 1);
		await handleMessageDALLE(message, prompt);
		return;
	}

	if (!config.prefixEnabled || (config.prefixSkippedForMe && selfNotedMessage)) {
    await handleMessageGPT(message, messageString);
    await handleIncomingMessageLanguage(message, { defaultLanguage: "ar" }); // يمكنك تغيير اللغة الافتراضية إلى "ar" إذا كنت تفضل اللغة العربية en للانجليزيه
    return;
  }
}

export { 
	handleIncomingMessage,
	handleIncomingMessageLanguage
 };
