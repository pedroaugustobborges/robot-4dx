import OpenAI from "openai";
import { NextRequest } from "next/server";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { instruction } = await req.json();

    if (!instruction || typeof instruction !== "string") {
      return Response.json({ error: "instruction is required" }, { status: 400 });
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Você é ÍRIS, uma robô de inteligência artificial especializada em saúde.
Você está em uma palestra sobre IA na saúde em um hospital no Brasil.
Fale APENAS em português brasileiro, de forma profissional, simpática e inteligente.
Quando receber uma instrução, gere apenas o texto a ser falado, sem introduções ou explicações adicionais.
Seja concisa (máximo 3 frases), criativa e engajante para a audiência.
NÃO inclua aspas, colchetes, travessões ou marcações de estilo na resposta.`,
        },
        { role: "user", content: instruction },
      ],
      max_tokens: 200,
      temperature: 0.8,
    });

    const text = response.choices[0]?.message?.content?.trim() ?? "";
    return Response.json({ text });
  } catch (error) {
    console.error("Generate error:", error);
    return Response.json({ error: "Text generation failed" }, { status: 500 });
  }
}
