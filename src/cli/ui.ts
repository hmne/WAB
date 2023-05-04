import { intro, spinner, note, outro, text } from "@clack/prompts";
import color from "picocolors";

const s = spinner();

export const print = (text: string) => {
	console.log(color.green("◇") + "  " + text);
};

export const printIntro = () => {
	intro(color.bgCyan(color.white(" واتس اب مع بوت و رسام ")));
	note("بوت واتس اب فيه ChatGPT و معاه DALL-E يعني كتابه ورسم");
	s.start("تشغيل");
};

export const printQRCode = (qr: string) => {
	s.stop("الكلاينت جاهز");
	note(qr, "امسح الكود الي بشاشه عشان تدخل الواتس اب ويب");
	s.start("انطرك تسوي مسح للكود");
};

export const printLoading = () => {
	s.stop("توثيق");
	s.start("تسجيل الدخول");
};

export const printAuthenticated = () => {
	s.stop("بدايت الجلسه");
	s.start("جاري فتح جلسه");
};

export const printAuthenticationFailure = () => {
	s.stop("افاء مادخل فيه خطأ");
};

export const printOutro = () => {
	s.stop("تحميل");
	outro("الواتس اب مع بوت و رسام جاهزين");
};
