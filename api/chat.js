// Vercel serverless function: forwards chat requests to OpenAI using the
// OPENAI_API_KEY set in the Vercel project settings, so the key never reaches
// the browser. Locked to one cheap model with short outputs.
const MODEL = "gpt-4o-mini";
const MAX_TOKENS = 600;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: "OPENAI_API_KEY is not set" });

  const { messages, temperature, max_tokens } = req.body ?? {};
  if (!Array.isArray(messages) || messages.length > 4 || JSON.stringify(messages).length > 20000) {
    return res.status(400).json({ error: "Bad request" });
  }

  const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: Math.min(Number(temperature) || 0.7, 1),
      max_tokens: Math.min(Number(max_tokens) || 300, MAX_TOKENS),
      response_format: { type: "json_object" },
    }),
  });
  res.status(upstream.status).json(await upstream.json());
}
