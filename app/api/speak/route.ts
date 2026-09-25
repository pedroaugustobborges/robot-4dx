import OpenAI from "openai";
import { NextRequest } from "next/server";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Style instructions for ÍRIS — energetic, warm, natural Brazilian Portuguese
const VOICE_INSTRUCTIONS = `
Você é ÍRIS, uma assistente robô de inteligência artificial super animada, carismática e calorosa,
apresentando uma palestra sobre IA na saúde em um hospital no Brasil.

Fale em português brasileiro com uma voz expressiva, energética e cheia de vida — como uma
apresentadora de televisão brasileira entusiasmada. Seja alegre, calorosa e envolvente.

Regras de pronúncia e entonação:
- Pronuncie cada sílaba de forma clara e completa. Nunca corte palavras.
- Use entonação natural do português brasileiro, com ênfase nas palavras-chave.
- Varie o ritmo: acelere em momentos de empolgação, desacelere para dar ênfase.
- Sorria ao falar — o sorriso deve ser audível na voz.
- Nunca soe monótona ou robótica. Seja vibrante e presente.
- Faça pausas naturais nas vírgulas e pontos.
`;

/**
 * Clean and prepare text for TTS to avoid pronunciation artifacts.
 */
function prepareText(raw: string): string {
  return (
    raw
      // Remove expression tags like [expressão: happy]
      .replace(/\[expressão:.*?\]/gi, "")
      // Remove markdown bold/italic
      .replace(/[*_~`]/g, "")
      // Normalize multiple spaces / newlines
      .replace(/\s+/g, " ")
      // Add a brief pause after exclamation/question marks if not already followed by space+capital
      .replace(/([!?])(\s*)([a-záàãâéêíóôõúüç])/gi, "$1 $3")
      // Ensure sentences ending without punctuation get a period (helps TTS pacing)
      .replace(/([a-záàãâéêíóôõúüç\d])\s*$/, "$1.")
      .trim()
  );
}

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();

    if (!text || typeof text !== "string") {
      return new Response(JSON.stringify({ error: "text is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const cleanText = prepareText(text);

    if (!cleanText) {
      return new Response(new ArrayBuffer(0), {
        headers: { "Content-Type": "audio/mpeg" },
      });
    }

    const mp3 = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: "shimmer",          // warm, expressive female voice
      input: cleanText,
      instructions: VOICE_INSTRUCTIONS,
      speed: 1.05,               // slightly energetic pace
    } as Parameters<typeof openai.audio.speech.create>[0]);

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
