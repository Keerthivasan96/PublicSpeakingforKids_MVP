// frontend/api/generate.js
// VERIFIED WORKING - Based on successful local test

export default async function handler(req, res) {
  try {
    // Only allow POST requests
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    // Get prompt from request
    const { prompt, temperature, max_tokens } = req.body;
    
    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "Missing or invalid 'prompt' in request body" });
    }

    // Get environment variables
    const GEMINI_KEY = process.env.GEMINI_API_KEY;
    const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

    if (!GEMINI_KEY) {
      return res.status(500).json({ error: "Missing GEMINI_API_KEY in environment variables" });
    }

    // Build API URL (same format as your successful local test)
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`;

    // Build request body (same format as your successful local test)
    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: prompt
            }
          ]
        }
      ]
    };

    // Add optional generation config
    if (temperature !== undefined || max_tokens !== undefined) {
      requestBody.generationConfig = {};
      if (temperature !== undefined) {
        requestBody.generationConfig.temperature = temperature;
      }
      if (max_tokens !== undefined) {
        requestBody.generationConfig.maxOutputTokens = max_tokens;
      }
    }

    console.log("🚀 Calling Gemini API");
    console.log("Model:", GEMINI_MODEL);
    console.log("Prompt length:", prompt.length);

    // Call Gemini API
    const apiResp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody)
    });

    console.log("📥 Response status:", apiResp.status);

    // Parse response
    const raw = await apiResp.json();

    // Log raw response for debugging
    console.log("📄 Raw response keys:", Object.keys(raw));

    // Check for API errors
    if (!apiResp.ok) {
      console.error("❌ Gemini API error:", JSON.stringify(raw));
      return res.status(apiResp.status).json({
        error: "Gemini API error",
        details: raw.error?.message || "Unknown error",
        status: apiResp.status
      });
    }

    // Extract text - EXACT format from your successful local test
    const reply = raw?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!reply || !reply.trim()) {
      console.error("❌ No text found in response");
      console.error("Response structure:", JSON.stringify(raw, null, 2));
      
      return res.status(500).json({
        error: "No text content in model response",
        hint: "Check Vercel function logs for full response",
        responseKeys: Object.keys(raw),
        hasCandidates: !!raw.candidates,
        candidatesLength: raw.candidates?.length || 0
      });
    }

    console.log("✅ Success! Reply length:", reply.length);

    // Return response in format frontend expects
    return res.status(200).json({
      reply: reply.trim()
    });

  } catch (err) {
    console.error("❌ Function error:", err.message);
    console.error("Stack:", err.stack);
    
    return res.status(500).json({
      error: "Server error",
      message: err.message
    });
  }
}