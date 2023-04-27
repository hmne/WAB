import os from "os";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { Message, MessageMedia } from "whatsapp-web.js";
import { chatgpt } from "../providers/openai";
import * as cli from "../cli/ui";
import config from "../config";

// TTS
import { ttsRequest as speechTTSRequest } from "../providers/speech";
import { ttsRequest as awsTTSRequest } from "../providers/aws";
import { TTSMode } from "../types/tts-mode";

// Moderation
import { moderateIncomingPrompt } from "./moderation";

// Mapping from number to last conversation id
const conversations = {};

const handleMessageGPT = async (message: Message, prompt: string) => {
	try {
		// Get last conversation
		const lastConversationId = conversations[message.from];

		cli.print(`البوت وصلة مسج من ${message.from}: ${prompt}`);

		// Prompt Moderation
		if (config.promptModerationEnabled) {
			try {
				await moderateIncomingPrompt(prompt);
			} catch (error: any) {
				message.reply(error.message);
				return;
			}
		}

		const start = Date.now();

		// Check if we have a conversation with the user
		let response: string;
		if (lastConversationId) {
			// Handle message with previous conversation
			response = await chatgpt.ask(prompt, lastConversationId);
		} else {
			// Create new conversation
			const convId = randomUUID();
			const conv = chatgpt.addConversation(convId);

			// Set conversation
			conversations[message.from] = conv.id;

			cli.print(`المحادثة الجديدة مع البوت ${message.from} (ID: ${conv.id})`);

			// Pre prompt
			if (config.prePrompt != null && config.prePrompt.trim() != "") {
				cli.print(`البري برومت للبوت: ${config.prePrompt}`);
				const prePromptResponse = await chatgpt.ask(config.prePrompt, conv.id);
				cli.print("رد البوت على البري برومت: " + prePromptResponse);
			}

			// Handle message with new conversation
			response = await chatgpt.ask(prompt, conv.id);
		}

		const end = Date.now() - start;

		cli.print(`البوت رد على ${message.from}: ${response}  | الوقت الي حتاجة عشان يرد ${end}ms)`);

		// TTS reply (Default: disabled)
		if (config.ttsEnabled) {
			sendVoiceMessageReply(message, response);
			return;
		}

		// Default: Text reply
		message.reply(response);
	} catch (error: any) {
		console.error("حصل خطأ", error);
		message.reply("حصل خطأ، كلم المالك او الادمن (" + error.message + ")");
	}
};

const handleDeleteConversation = async (message: Message) => {
	// Delete conversation
	delete conversations[message.from];

	// Reply
	message.reply("Conversation context was resetted!");
};

async function sendVoiceMessageReply(message: Message, gptTextResponse: string) {
	var logTAG = "[TTS]";
	var ttsRequest = async function (): Promise<Buffer | null> {
		return await speechTTSRequest(gptTextResponse);
	};

	switch (config.ttsMode) {
		case TTSMode.SpeechAPI:
			logTAG = "[SpeechAPI]";
			ttsRequest = async function (): Promise<Buffer | null> {
				return await speechTTSRequest(gptTextResponse);
			};
			break;

		case TTSMode.AWSPolly:
			logTAG = "[AWSPolly]";
			ttsRequest = async function (): Promise<Buffer | null> {
				return await awsTTSRequest(gptTextResponse);
			};
			break;

		default:
			logTAG = "[SpeechAPI]";
			ttsRequest = async function (): Promise<Buffer | null> {
				return await speechTTSRequest(gptTextResponse);
			};
			break;
	}

	// Get audio buffer
	cli.print(`${logTAG} تحويل رد البوت الى صوت "${gptTextResponse}"...`);
	const audioBuffer = await ttsRequest();

	// Check if audio buffer is valid
	if (audioBuffer == null || audioBuffer.length == 0) {
		message.reply(`${logTAG} مو قادر احول الكلام الى صوت كلم الادمن`);
		return;
	}

	cli.print(`${logTAG} تم تحويل الكتابة الى صوت`);

	// Get temp folder and file path
	const tempFolder = os.tmpdir();
	const tempFilePath = path.join(tempFolder, randomUUID() + ".opus");

	// Save buffer to temp file
	fs.writeFileSync(tempFilePath, audioBuffer);

	// Send audio
	const messageMedia = new MessageMedia("audio/ogg; codecs=opus", audioBuffer.toString("base64"));
	message.reply(messageMedia);

	// Delete temp file
	fs.unlinkSync(tempFilePath);
}

export { handleMessageGPT, handleDeleteConversation };
