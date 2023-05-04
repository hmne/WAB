import defaultLanguage from "./settings";
import { getLanguage } from "./languages";
import { startsWithIgnoreCase } from "../utils";
import { Message, Client } from 'whatsapp-web.js';
import MessageCollector from "./MessageCollector";
//import { parseDate, isValidDate } from './userUtils';
import * as PDFJS from "pdfjs-dist/legacy/build/pdf";
import { searchFlights } from "../features/skyscanner";
//import { isCountryOrCodeValid, isDateFormatValid, handleFlightRequest } from "./userUtils";
import { handleIncomingMessage as handleIncomingMessageLanguage } from "./languages";
import { extractTextFromImage, extractTextFromPdf, detectLanguage } from "../features/text-extraction";
import { parseDate, isValidDate, getCountryCode,isCountryOrCodeValid, isDateFormatValid, handleFlightRequest, flightRegex, arLang } from "./userUtils";


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

function createUniqueId(senderId: string): string {
  return `user-${senderId}`;
}

const conversations: { [key: string]: any } = {};

// Handles message
async function handleIncomingMessage(message: Message, client: Client) {
  const senderId = message.from;
  const userUniqueId = createUniqueId(senderId);
  const messageString = message.body.trim();
  console.log(`◇ البوت وصلة مسج من ${senderId}: ${messageString}`);

  if (messageString.startsWith(".رحله")) {
    if (messageString === '.رحله') {
      // Begin interactive flight search
      console.log(`◇ البوت بدأ بحث رحلة تفاعلي لـ ${senderId}`);
      conversations[userUniqueId] = { stage: 'from', tries: 0, userId: senderId };
      await message.reply('من؟');
    } else {
      // Direct flight search
      console.log(`◇ البوت بدأ بحث رحلة مباشرة لـ ${senderId}`);
      const messageParts = messageString.split(' ');

      if (messageParts.length === 7) {
        const from = messageParts[2];
        const to = messageParts[4];
        const date = messageParts[6];

        const fromCode = getCountryCode(from);
        const toCode = getCountryCode(to);
        const parsedDate = parseDate(date);

        if (!fromCode) {
          console.log(`◇ البوت لم يستطع العثور على مكان المغادرة لـ ${senderId}`);
          await message.reply(`لم يتم العثور على مكان المغادرة: ${from}. يرجى التحقق من الإدخال والمحاولة مرة أخرى.`);
        } else if (!toCode) {
          console.log(`◇ البوت لم يستطع العثور على مكان الوصول لـ ${senderId}`);
          await message.reply(`لم يتم العثور على مكان الوصول: ${to}. يرجى التحقق من الإدخال والمحاولة مرة أخرى.`);
        } else if (!parsedDate) {
          console.log(`◇ البوت تلقى تاريخ غير صحيح من ${senderId}`);
          await message.reply('التاريخ غير صحيح. يرجى المحاولة مرة أخرى.');
        } else {
          await handleFlightRequest(client, message, [null, from, to, date]);
        }
              } else {
          console.log(`◇ البوت تلقى تنسيق رسالة غير صحيح من ${senderId}`);
          await message.reply('يرجى إرسال الرسالة بالتنسيق التالي: .رحله من [مكان المغادرة] إلى [مكان الوصول] بتاريخ [تاريخ الرحلة]');
        }
      }
  } else if (conversations[userUniqueId] && conversations[userUniqueId].userId === senderId) {
    const currentStage = conversations[userUniqueId].stage;
    const currentTries = conversations[userUniqueId].tries;
    let validInput = false;
    let errorMessage = '';

    if (currentStage === 'from') {
      const fromCode = getCountryCode(messageString);
      if (fromCode) {
        validInput = true;
        conversations[userUniqueId].from = fromCode;
        conversations[userUniqueId].stage = 'to';
        conversations[userUniqueId].tries = 0; // إعادة تعيين عدد المحاولات
        console.log(`◇ البوت تلقى مكان المغادرة الصحيح من ${senderId}`);
        await message.reply('إلى؟');
      } else {
        errorMessage = 'اسم الدولة أو المدينة غير صحيح. يرجى المحاولة مرة أخرى.';
      }
    } else if (currentStage === 'to') {
      const toCode = getCountryCode(messageString);
      if (toCode) {
        validInput = true;
        conversations[userUniqueId].to = toCode;
        conversations[userUniqueId].stage = 'date';
        conversations[userUniqueId].tries = 0; // إعادة تعيين عدد المحاولات
        console.log(`◇ البوت تلقى مكان الوصول الصحيح من ${senderId}`);
        await message.reply('بتاريخ؟');
      } else {
        errorMessage = 'اسم الدولة أو المدينة غير صحيح. يرجى المحاولة مرة أخرى.';
      }
    } else if (currentStage === 'date') {
      const parsedDate = parseDate(messageString);
      if (parsedDate) {
        validInput = true;
        console.log(`◇ البوت تلقى تاريخ الرحلة الصحيح من ${senderId}`);
        await handleFlightRequest(client, message, [null, conversations[userUniqueId].from, conversations[userUniqueId].to, messageString]);
        delete conversations[userUniqueId];
      } else {
        errorMessage = 'التاريخ غير صحيح. يرجى المحاولة مرة أخرى.';
      }
    }

    if (!validInput) {
      console.log(`◇ البوت تلقى معلومات غير صحيحة من ${senderId}: ${errorMessage}`);
      conversations[userUniqueId].tries++;
      if (currentTries >= 2) {
        delete conversations[userUniqueId];
        console.log(`◇ البوت ألغى البحث بسبب تجاوز عدد المحاولات المسموح بها لـ ${senderId}`);
        await message.reply('تم إلغاء البحث بسبب تجاوز عدد المحاولات المسموح بها. يمكنك المحاولة مرة أخرى بإرسال: .رحله');
      } else {
        await message.reply(errorMessage);
      }
    }
  } else {
    console.log(`◇ البوت تلقى رسالة غير متوقعة من ${senderId}: ${messageString}`);
  }

  if (message.hasMedia) {
    const media = await message.downloadMedia();
    console.log(`◇ البوت تلقى وسائط من ${senderId}: ${media.mimetype}`);
    const language = getLanguage(message.body, { defaultLanguage: "ar" });
    console.log(`◇ البوت حدد اللغة: ${language.code}`);
    if (
      message.body.includes(language.activationKeyword) ||
      message.body.includes(language.requestKeyword)
    ) {
      if (media.mimetype.startsWith("image/")) {
        console.log(`◇ البوت يستخرج النص من الصورة لـ ${senderId}`);
        const extractedText = await extractTextFromImage(Buffer.from(media.data, "base64"));
        console.log(`◇ البوت استخرج النص من الصورة لـ ${senderId}: ${extractedText}`);
        const detectedLanguage = await detectLanguage(extractedText);
        message.reply(`تم استخراج النص من الصورة:\n${extractedText} \n(اللغة: ${detectedLanguage})`);
        return;
      } else if (media.mimetype === "application/pdf") {
        console.log(`◇ البوت يستخرج النص من ملف PDF لـ ${senderId}`);
        const extractedText = await extractTextFromPdf(Buffer.from(media.data, "base64"));
        console.log(`◇ البوت استخرج النص من ملف PDF لـ ${senderId}: ${extractedText}`);
        const detectedLanguage = await detectLanguage(extractedText);
        message.reply(`تم استخراج النص من الملف PDF: ${extractedText} (اللغة: ${detectedLanguage})`
        );
        return;
      }
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
