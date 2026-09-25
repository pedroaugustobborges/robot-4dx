import OpenAI from "openai";
import { NextRequest } from "next/server";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { image } = await req.json();

    if (!image || typeof image !== "string") {
      return Response.json({ error: "image is required" }, { status: 400 });
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${image}`,
                detail: "low",
              },
            },
            {
              type: "text",
              text: `Você é ÍRIS, uma robô de inteligência artificial em uma palestra sobre IA na saúde em um hospital brasileiro.
Observe esta imagem da audiência e crie UMA saudação calorosa, profissional e específica em português brasileiro.
Mencione o que você observa (aproximadamente quantas pessoas, onde estão, o ambiente, etc.).
Seja criativa, simpática e profissional. Máximo 2 frases.
Responda APENAS com o texto da saudação, sem explicações adicionais, sem aspas.`,
            },
          ],
        },
      ],
      max_tokens: 150,
    });

    const text = response.choices[0]?.message?.content?.trim() ?? "";
    return Response.json({ text });
  } catch (error) {
    console.error("Vision error:", error);
    return Response.json({ error: "Vision analysis failed" }, { status: 500 });
  }
}
