import { Message } from "whatsapp-web.js";
import { aiConfigTarget, aiConfigTypes, aiConfigValues, IAiConfig } from "../types/ai-config";
import { dalleImageSize } from "../types/dalle-config";

const aiConfig: IAiConfig = {
	dalle: {
		size: dalleImageSize["1024x1024"]
	}
	// chatgpt: {}
};

const handleMessageAIConfig = async (message: Message, prompt: any) => {
	try {
		console.log("[AI-Config] Received prompt from " + message.from + ": " + prompt);

		const args: string[] = prompt.split(" ");

		/*
			ضبط1
			ضبط1 مساعدة
		*/
		if (args.length == 1 || prompt === "مساعدة") {
			let helpMessage = "الاوامر المتوفره:\n";
			for (let target in aiConfigTarget) {
				for (let type in aiConfigTypes[target]) {
					helpMessage += `\tضبط1 ${target} ${type} <القيمه> - ضبط ${target} ${type} لل <قيمه>\n`;
				}
			}
			helpMessage += "\nالقيم المتوفره:\n";
			for (let target in aiConfigTarget) {
				for (let type in aiConfigTypes[target]) {
					helpMessage += `\t${target} ${type}: ${Object.keys(aiConfigValues[target][type]).join(", ")}\n`;
				}
			}
			message.reply(helpMessage);
			return;
		}

		// ضبط1 <target> <type> <value>
		if (args.length !== 3) {
			message.reply(
				"قيم خطا الستخدم القيم التالية مثال : <الهدف> <النوع> <القيمه> او اكتب ضبط1 مساعدة للمزيد من المساعدة"
			);
			return;
		}

		const target: string = args[0];
		const type: string = args[1];
		const value: string = args[2];

		if (!(target in aiConfigTarget)) {
			message.reply("قيمه خاطئه، استعمل احد القيم التالية: " + Object.keys(aiConfigTarget).join(", "));
			return;
		}

		if (!(type in aiConfigTypes[target])) {
			message.reply("قيمه خاطئه، استعمل احد القيم التالية: " + Object.keys(aiConfigTypes[target]).join(", "));
			return;
		}

		if (!(value in aiConfigValues[target][type])) {
			message.reply("قيمه خاطئه، استعمل احد القيم التالية: " + Object.keys(aiConfigValues[target][type]).join(", "));
			return;
		}

		aiConfig[target][type] = value;

		message.reply("تم الظب بنجاح " + target + " " + type + " لل " + value);
	} catch (error: any) {
		console.error("حدث خطا ماعليش", error);
		message.reply("حدث خطا الرجائ التواصل مع المالك. (" + error.message + ")");
	}
};

export { aiConfig, handleMessageAIConfig };
