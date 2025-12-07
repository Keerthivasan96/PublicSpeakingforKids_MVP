// frontend/api/generate.js
// Vercel Serverless Function — customized for your PublicSpeakingforKids_MVP frontend
// - Accepts POST { prompt, temperature, max_tokens }
// - Set env vars in Vercel: GEMINI_API_KEY, GEMINI_MODEL (optional), GEMINI_AUTH_TYPE (optional: "bearer" or "key")
// - Default model: gemini-2.5-flash (change via GEMINI_MODEL)

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const GEMINI_KEY = process.env.GEMINI_API_KEY;
    const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    const GEMINI_AUTH_TYPE = (process.env.GEMINI_AUTH_TYPE || "key").toLowerCase(); // "key" or "bearer"

    if (!GEMINI_KEY) {
      return res.status(500).json({ error: "Missing GEMINI_API_KEY in environment" });
    }

    const { prompt, temperature, max_tokens } = req.body || {};
    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "Missing or invalid 'prompt' in request body" });
    }

    // Map frontend fields -> Gemini/Google GL parameters
    const payload = {
      // Many Google examples accept `prompt: { text: "..." }`
      prompt: { text: prompt },
      // optional generation params (only include if provided)
      ...(typeof temperature === "number" ? { temperature } : {}),
      ...(typeof max_tokens === "number" ? { maxOutputTokens: max_tokens } : {})
    };

    // Prepare URL + headers depending on auth type
    // Default: API key in query param (common with Google Generative Language REST)
    let url = `https://generativelanguage.googleapis.com/v1/models/${encodeURIComponent(GEMINI_MODEL)}:generateText`;
    let headers = { "Content-Type": "application/json" };

    if (GEMINI_AUTH_TYPE === "key") {
      // Attach API key as query param
      url += `?key=${encodeURIComponent(GEMINI_KEY)}`;
    } else {
      // Use Authorization: Bearer <key>
      headers["Authorization"] = `Bearer ${GEMINI_KEY}`;
    }

    // Call the external API
    const apiResp = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    // Try to parse returned JSON (may vary by provider/version)
    const data = await apiResp.json().catch(() => null);

    // Normalize to a single reply string — try several common shapes
    let reply = null;
    try { reply = reply || data?.candidates?.[0]?.content?.parts?.[0]?.text; } catch (e) {}
    try { reply = reply || data?.candidates?.[0]?.content?.[0]?.text; } catch (e) {}
    try { 
      if (!reply && Array.isArray(data?.output)) {
        // output: [{ content: [{ text: "..." }] }]
        reply = data.output.map(o => {
          if (!o) return "";
          if (o?.content) {
            return o.content.map(c => c?.text || (c?.parts || []).map(p => p?.text).join(" ")).join(" ");
          }
          return "";
        }).join("\n");
      }
    } catch (e) {}
    reply = reply || data?.text || data?.responseText || data?.reply || data?.message || null;

    // Fallback: If still empty, attempt to stringify small useful parts for debugging
    if (!reply) {
      // Log a small hint to function logs (do NOT expose secrets)
      console.warn("Unrecognized Gemini response shape, keys:", Object.keys(data || {}).slice(0,20));
      return res.status(200).json({ reply: "Sorry — model returned an unexpected response. Check server logs." });
    }

    // Return the single field your frontend expects
    return res.status(200).json({ reply });

  } catch (err) {
    console.error("Serverless function error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
