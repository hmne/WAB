import defaultLanguage from "./settings";
import { getLanguage } from "./languages";
import { Message, Client } from 'whatsapp-web.js';
import MessageCollector from "./MessageCollector";
import * as PDFJS from "pdfjs-dist/legacy/build/pdf";
import { searchFlights } from "../features/skyscanner";
import { startsWithIgnoreCase, parseDate } from "../utils";
import { getCountryCode, flightRegex, arLang } from "./userUtils";
import { isCountryOrCodeValid, isDateFormatValid } from "./userUtils";
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

interface ConversationState {
  stage: 'from' | 'to' | 'date';
  from?: string;
  to?: string;
  date?: string;
}

// Handles message
async function handleIncomingMessage(message: Message) {
  const messageString = message.body.trim();
  const conversationId = message.info.remoteJID;

  if (startsWithIgnoreCase(messageString, '.رحله')) {
    if (messageString === '.رحله') {
      conversations[conversationId] = { stage: 'from' };
      await message.reply('من؟');
    } else {
      const messageParts = messageString.split(' ');

      if (messageParts.length === 6) {
        const from = messageParts[2];
        const to = messageParts[4];
        const date = messageParts[6];

        const fromCode = getCountryCode(from);
        const toCode = getCountryCode(to);
        const parsedDate = parseDate(date);

        if (!fromCode || !toCode || !parsedDate) {
          await message.reply('المعلومات المدخلة غير صحيحة. يرجى التحقق من بيانات البحث والمحاولة مرة أخرى.');
        } else {
          const flightResults = await searchFlights(fromCode, toCode, parsedDate.toISOString());
          await message.reply(flightResults);
        }
      } else {
        await message.reply('يرجى إرسال الرسالة بالتنسيق التالي: .رحله من [المدينة المغادرة] إلى [المدينة الواصلة] بتاريخ [تاريخ الرحلة]');
      }
    }
  } else {
    const conversation = conversations[conversationId];

    if (conversation) {
      if (conversation.stage === 'from') {
        conversation.from = messageString;
        conversation.stage = 'to';
        await message.reply('إلى؟');
      } else if (conversation.stage === 'to') {
        conversation.to = messageString;
        conversation.stage = 'date';
        await message.reply('أي تاريخ؟');
      } else if (conversation.stage === 'date') {
        conversation.date = messageString;
        delete conversations[conversationId];

        const fromCode = getCountryCode(conversation.from);
        const toCode = getCountryCode(conversation.to);
        const parsedDate = parseDate(conversation.date);

        if (!fromCode || !toCode || !parsedDate) {
          await message.reply('المعلومات المدخلة غير صحيحة. يرجى التحقق من بيانات البحث والمحاولة مرة أخرى.');
        } else {
          const flightResults = await searchFlights(fromCode, toCode, parsedDate.toISOString());
          await message.reply(flightResults);
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
