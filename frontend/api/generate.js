// frontend/api/generate.js
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).send({ error: "Method not allowed" });

    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "Missing prompt" });

    const key = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

    // Build request body for the generativelanguage endpoint (adjust if you have a custom shape)
    const body = {
      prompt: {
        text: prompt
      }
    };

    // Use the appropriate endpoint your code expects
    const url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${key}`;

    const apiResp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        // fallback request shape — if your previous code used a different shape adjust accordingly
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    const raw = await apiResp.json();

    // LOG the full raw response so it appears in Vercel function logs
    console.log("GENIE RAW:", JSON.stringify(raw, null, 2));

    // Defensive parsing (covers several known shapes)
    const text =
      raw?.candidates?.[0]?.content?.parts?.[0]?.text ||
      raw?.candidates?.[0]?.content?.[0]?.text ||
      raw?.output?.[0]?.content?.text ||
      raw?.message ||
      raw?.result?.output_text ||
      raw?.reply ||
      null;

    if (!text) {
      // Return raw for debugging (temporary). Remove this behavior after fix.
      return res.status(500).json({
        ok: false,
        error: "Model returned unexpected response. See GENIE RAW in function logs.",
        raw // <-- debug: remove later
      });
    }

    return res.json({ ok: true, reply: text });
  } catch (err) {
    console.error("GENERATE ERROR:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
