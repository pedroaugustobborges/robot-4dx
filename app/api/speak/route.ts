import OpenAI from "openai";
import { NextRequest } from "next/server";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();

    if (!text || typeof text !== "string") {
      return new Response(JSON.stringify({ error: "text is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Sanitize expression-only commands
    const cleanText = text.replace(/\[expressão:.*?\]/gi, "").trim();
    if (!cleanText) {
      return new Response(new ArrayBuffer(0), {
        headers: { "Content-Type": "audio/mpeg" },
      });
    }

    const mp3 = await openai.audio.speech.create({
      model: "tts-1",
      voice: "nova",
      input: cleanText,
      speed: 1.0,
    });

    const buffer = Buffer.from(await mp3.arrayBuffer());

    return new Response(buffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": buffer.length.toString(),
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("TTS error:", error);
    return new Response(JSON.stringify({ error: "TTS generation failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
