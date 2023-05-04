import { getDocument, GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf";
import { config } from "dotenv";
import { recognizeImage } from './ocrSpaceApi';
import { franc } from 'franc';

config();
async function extractTextFromImage(imageBuffer: Buffer): Promise<string> {
  const response = await recognizeImage(imageBuffer, 'ara');
  const text = response.ParsedResults[0].ParsedText;
  //console.log("Text extracted from image:", text);
  return text;
}

async function extractTextFromPdf(pdfBuffer: Buffer): Promise<string> {
  const uint8ArrayData = new Uint8Array(pdfBuffer.buffer);
  const pdfDocument = await getDocument({ data: uint8ArrayData }).promise;
  const numPages = pdfDocument.numPages;
  let extractedText = "";

  for (let pageIndex = 1; pageIndex <= numPages; pageIndex++) {
    const page = await pdfDocument.getPage(pageIndex);
    const textContent = await page.getTextContent();
    extractedText += textContent.items.map((item) => item.str).join(" ");
  }

  return extractedText;
}

async function detectLanguage(text: string): Promise<string> {
  const langCode = franc(text);
  return langCode;
}

export { extractTextFromImage, extractTextFromPdf, detectLanguage };
