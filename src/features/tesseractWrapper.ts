import { createWorker } from 'tesseract.js';

export async function recognizeImage(imagePath: string): Promise<string> {
  const worker = createWorker({
    logger: m => console.log(m),
  });

  await worker.load();
  await worker.loadLanguage('eng+ara');
  await worker.initialize('eng+ara');

  const { data: { text } } = await worker.recognize(imagePath);

  await worker.terminate();

  return text.trim();
}