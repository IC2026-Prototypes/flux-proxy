const express = require('express');
const app = express();

app.use(express.json());

const FAL_API_KEY = 'd3ad61e7-ed88-48d4-b2db-6cb32423e5c5:27be2771ad2597d155e82aaadff2235f';
const FAL_SUBMIT_URL = 'https://fal.run/fal-ai/flux-pro/v1.1';
const FAL_STATUS_BASE = 'https://fal.run/fal-ai/flux-pro/requests';
const PORT = process.env.PORT || 3000;

const falHeaders = {
  'Authorization': `Key ${FAL_API_KEY}`,
  'Content-Type': 'application/json'
};

app.post('/submit', async (req, res) => {
  const { prompt, id } = req.body;
  console.log(`[SUBMIT] Received request — id: ${id}, prompt: "${prompt?.slice(0, 80)}..."`);

  if (!prompt) {
    console.log('[SUBMIT] ERROR: Missing prompt');
    return res.status(400).json({ error: 'prompt is required' });
  }

  const payload = {
    prompt,
    image_size: 'landscape_4_3',
    num_images: 1,
    output_format: 'jpeg',
    safety_tolerance: '2',
    enhance_prompt: true
  };

  console.log('[SUBMIT] Calling Fal.ai:', FAL_SUBMIT_URL);

  try {
    const falRes = await fetch(FAL_SUBMIT_URL, {
      method: 'POST',
      headers: { ...falHeaders, 'prefer': 'respond-async' },
      body: JSON.stringify(payload)
    });

    const text = await falRes.text();
    console.log(`[SUBMIT] Fal.ai response status: ${falRes.status}`);
    console.log(`[SUBMIT] Fal.ai response body: ${text}`);

    if (!falRes.ok) {
      console.log('[SUBMIT] ERROR: Fal.ai returned non-OK status');
      return res.status(502).json({ error: 'Fal.ai submission failed', details: text });
    }

    const data = JSON.parse(text);
    const request_id = data.request_id;

    if (!request_id) {
      console.log('[SUBMIT] ERROR: No request_id in response:', data);
      return res.status(502).json({ error: 'No request_id returned from Fal.ai', raw: data });
    }

    console.log(`[SUBMIT] Success — request_id: ${request_id}`);
    return res.json({ request_id });

  } catch (err) {
    console.log('[SUBMIT] EXCEPTION:', err.message);
    return res.status(500).json({ error: 'Internal error during submit', message: err.message });
  }
});

app.get('/status/:requestId', async (req, res) => {
  const { requestId } = req.params;
  const url = `${FAL_STATUS_BASE}/${requestId}`;
  console.log(`[STATUS] Checking request_id: ${requestId}`);

  try {
    const falRes = await fetch(url, { headers: falHeaders });
    const text = await falRes.text();
    console.log(`[STATUS] Fal.ai response status: ${falRes.status}`);
    console.log(`[STATUS] Fal.ai response body: ${text}`);

    if (!falRes.ok) {
      console.log('[STATUS] ERROR: Fal.ai returned non-OK status');
      return res.status(502).json({ error: 'Fal.ai status check failed', details: text });
    }

    const data = JSON.parse(text);
    const status = data.status;

    if (status === 'COMPLETED' || status === 'completed') {
      const imageUrl = data?.output?.images?.[0]?.url || data?.images?.[0]?.url || null;
      console.log(`[STATUS] COMPLETED — image URL: ${imageUrl}`);
      return res.json({ status: 'completed', url: imageUrl });
    }

    if (status === 'FAILED' || status === 'failed') {
      console.log('[STATUS] FAILED');
      return res.json({ status: 'failed', url: null });
    }

    console.log(`[STATUS] Still processing — status: ${status}`);
    return res.json({ status: 'processing', url: null });

  } catch (err) {
    console.log('[STATUS] EXCEPTION:', err.message);
    return res.status(500).json({ error: 'Internal error during status check', message: err.message });
  }
});

app.get('/health', (req, res) => {
  console.log('[HEALTH] ping');
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`[SERVER] flux-proxy running on port ${PORT}`);
});
