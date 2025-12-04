/**
 * server.js
 * Express backend (ESM) for speaking-avatar-mvp
 *
 * - Supports Google Gemini via REST when GEMINI_API_KEY is set
 * - Falls back to OpenAI Chat Completions when OPENAI_API_KEY is set
 * - Robust extraction of text from provider responses
 * - Placeholder /api/tts endpoint (use frontend speechSynthesis for MVP)
 *
 * Notes:
 *  - Node 18+ recommended (global fetch available). You're on Node 24 so it's fine.
 *  - Ensure backend/.env contains GEMINI_API_KEY or OPENAI_API_KEY as appropriate.
 */

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 4000);

// CORS origin for frontend (set in .env)
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*",
  })
);

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.json({
    ok: true,
    message: "Speaking-avatar-mvp backend is running",
    providers: {
      gemini: !!process.env.GEMINI_API_KEY,
      openai: !!process.env.OPENAI_API_KEY,
    },
  });
});

/**
 * Robust extractor for provider responses.
 * Handles the Gemini candidate shape and OpenAI-like shapes.
 */
function extractTextFromResponse(obj) {
  if (!obj) return null;

  // 1) Gemini candidate common shape:
  //    { candidates: [ { content: { parts: [ { text: "..." } ] } } ] }
  try {
    const cand = obj?.candidates?.[0];
    const gemContent = cand?.content;
    const partText = gemContent?.parts?.[0]?.text;
    if (typeof partText === "string" && partText.trim()) return partText.trim();
  } catch (e) {
    // ignore
  }

  // 2) Another possible Gemini-like shape: outputs -> content -> text
  try {
    const c2 = obj?.outputs?.[0]?.content?.[0]?.text;
    if (typeof c2 === "string" && c2.trim()) return c2.trim();
  } catch (e) {}

  // 3) Convenience fields
  if (typeof obj?.text === "string" && obj.text.trim()) return obj.text.trim();
  if (typeof obj?.response?.text === "string" && obj.response.text.trim()) return obj.response.text.trim();

  // 4) OpenAI-like structure: choices[0].message.content OR choices[0].text
  try {
    const openaiMsg = obj?.choices?.[0]?.message?.content ?? obj?.choices?.[0]?.text;
    if (typeof openaiMsg === "string" && openaiMsg.trim()) return openaiMsg.trim();
  } catch (e) {}

  // 5) If Gemini candidate content has multiple parts, join them
  try {
    const cand = obj?.candidates?.[0];
    const parts = cand?.content?.parts;
    if (Array.isArray(parts) && parts.length) {
      const joined = parts.map((p) => (typeof p?.text === "string" ? p.text : "")).filter(Boolean).join("\n\n");
      if (joined.trim()) return joined.trim();
    }
  } catch (e) {}

  // 6) Last-resort: serialize object
  try {
    return JSON.stringify(obj);
  } catch (e) {
    return String(obj);
  }
}

/**
 * POST /api/chat
 * Body: { prompt: string } (or { text: string })
 * Returns: { ok: true, reply: string } or { ok: false, error: ... }
 *
 * Uses:
 *  - GEMINI_API_KEY + GEMINI_MODEL (preferred)
 *  - otherwise OPENAI_API_KEY + OPENAI_MODEL
 */
app.post("/api/chat", async (req, res) => {
  const prompt = (req.body && (req.body.prompt ?? req.body.text)) || "";
  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ ok: false, error: "Missing 'prompt' in request body." });
  }

  // --- Gemini path ---
  if (process.env.GEMINI_API_KEY) {
    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    const baseUrl = process.env.GEMINI_API_URL || "https://generativelanguage.googleapis.com/v1beta";
    const endpoint = `${baseUrl}/models/${encodeURIComponent(model)}:generateContent`;

    try {
      const body = {
        // Gemini expects contents array with parts
        contents: [
          {
            parts: [{ text: prompt }],
            role: "user",
          },
        ],
        // you can tune generation params here (temperature, candidateCount, etc.)
        // temperature: 0.7,
        // candidateCount: 1,
      };

      const resp = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY,
        },
        body: JSON.stringify(body),
      });

      const json = await resp.json().catch(() => null);

      if (!resp.ok) {
        console.error("Gemini API error", resp.status, json);
        return res.status(502).json({ ok: false, error: "Gemini API error", status: resp.status, body: json });
      }

      const reply = extractTextFromResponse(json);
      return res.json({ ok: true, reply: String(reply) });
    } catch (err) {
      console.error("Error calling Gemini:", err);
      return res.status(500).json({ ok: false, error: "Server error calling Gemini", details: String(err) });
    }
  }

  // --- OpenAI path ---
  if (process.env.OPENAI_API_KEY) {
    try {
      const model = process.env.OPENAI_MODEL || "gpt-3.5-turbo";
      const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7,
          max_tokens: 800,
        }),
      });

      if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        console.error("OpenAI API error:", resp.status, text);
        return res.status(502).json({ ok: false, error: "OpenAI API returned an error", status: resp.status, body: text });
      }

      const data = await resp.json();
      const reply = extractTextFromResponse(data);
      return res.json({ ok: true, reply: String(reply) });
    } catch (err) {
      console.error("Error calling OpenAI:", err);
      return res.status(500).json({ ok: false, error: "Server error calling OpenAI", details: String(err) });
    }
  }

  // No provider configured
  return res.status(500).json({
    ok: false,
    error: "No LLM provider configured. Set GEMINI_API_KEY or OPENAI_API_KEY in backend/.env",
  });
});

/**
 * POST /api/tts
 * Placeholder for TTS integration.
 * For the MVP, use the browser speechSynthesis (frontend) to speak assistant replies.
 *
 * If you later add a TTS provider, implement provider calls here and stream audio bytes
 * with appropriate Content-Type (audio/mpeg or audio/wav).
 */
app.post("/api/tts", async (req, res) => {
  const text = (req.body && req.body.text) || "";
  if (!text) return res.status(400).json({ ok: false, error: "Missing 'text' in request body." });

  if (!process.env.TTS_PROVIDER) {
    return res.status(501).json({
      ok: false,
      error: "TTS provider not configured on backend.",
      suggestion: "Use frontend speechSynthesis.speak() for MVP, or set TTS_PROVIDER and implement server-side TTS.",
    });
  }

  // Placeholder: add provider-specific implementation here (Coqui, ElevenLabs, OpenAI TTS, etc.)
  return res.status(501).json({ ok: false, error: "TTS not implemented on backend yet." });
});

// Optional static audio folder for files you might save
app.use("/audio", express.static(path.join(process.cwd(), "audio")));

app.listen(PORT, () => {
  console.log(`🚀 Backend running on http://localhost:${PORT} (CORS=${process.env.CORS_ORIGIN || "*"})`);
  console.log("Providers:", {
    gemini: !!process.env.GEMINI_API_KEY,
    openai: !!process.env.OPENAI_API_KEY,
    tts: !!process.env.TTS_PROVIDER,
  });
});
