import { config } from "dotenv";
import fs from "fs";
import axios from "axios";
import tmp from "tmp";
import FormData from "form-data";

config();

const API_KEY = process.env.OCR_SPACE_API_KEY;

export async function recognizeImage(imageBuffer: Buffer, language: string): Promise<any> {
  // إنشاء ملف مؤقت لحفظ الصورة
  const tmpFile = tmp.fileSync({ postfix: ".jpg" });
  fs.writeFileSync(tmpFile.name, imageBuffer);

  const formData = new FormData();
  const fileStream = fs.createReadStream(tmpFile.name);
  fileStream.on("error", (err) => {
    console.error("Error reading tmp file:", err);
  });
  formData.append("file", fileStream, {
    filepath: tmpFile.name,
    knownLength: imageBuffer.length,
  });
  formData.append("apikey", API_KEY);
  formData.append("language", language || "ara");

  try {
    const response = await axios.post("https://api.ocr.space/parse/image", formData, {
      headers: {
        ...formData.getHeaders(),
      },
    });

    if (response.data) {
      return response.data;
    } else {
      throw new Error("OCR.space API returned no results or an error occurred.");
    }
  } catch (error) {
    console.error("Error in OCR.space API:", error);
    throw error;
  } finally {
    // تنظيف الملف المؤقت بعد الانتهاء من استخدامه
    tmpFile.removeCallback();
  }
}
