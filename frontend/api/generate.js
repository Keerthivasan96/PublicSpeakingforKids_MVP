export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const GEMINI_KEY = process.env.GEMINI_API_KEY;
    const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

    if (!GEMINI_KEY) {
      console.error('GEMINI_API_KEY not set');
      return res.status(500).json({ error: 'Missing GEMINI_API_KEY in environment' });
    }

    const { prompt, temperature, max_tokens } = req.body || {};
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid prompt' });
    }

    console.log('Calling Gemini API...');

    const payload = {
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        ...(typeof temperature === 'number' ? { temperature } : {}),
        ...(typeof max_tokens === 'number' ? { maxOutputTokens: max_tokens } : {})
      }
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(GEMINI_KEY)}`;

    const apiResp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await apiResp.json();

    if (!apiResp.ok) {
      console.error('Gemini API error:', JSON.stringify(data));
      return res.status(apiResp.status).json({ 
        error: 'Gemini API error', 
        details: data 
      });
    }

    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!reply) {
      console.error('No reply in response:', JSON.stringify(data));
      return res.status(500).json({ 
        error: 'No reply from Gemini',
        reply: 'Sorry, I could not generate a response. Please try again.'
      });
    }

    console.log('Success! Reply length:', reply.length);
    return res.status(200).json({ reply });

  } catch (err) {
    console.error('Serverless function error:', err);
    return res.status(500).json({ 
      error: 'Server error', 
      message: err.message 
    });
  }
}