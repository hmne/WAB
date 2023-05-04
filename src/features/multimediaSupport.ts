import { Message } from "whatsapp-web.js";
import * as Tesseract from "tesseract.js";
import { getDocument } from "pdfjs-dist/es5/build/pdf";


const activationKeyword = 'بوت';
const requestKeyword = 'حلل';

export const hasActivationKeyword = (message: Message) => {
  return message.body.includes(activationKeyword);
};

export const hasRequestKeyword = (message: Message) => {
  return message.body.includes(requestKeyword);
};
