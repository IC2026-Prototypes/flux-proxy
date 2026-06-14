const express = require('express');
const app = express();

app.use(express.json());

const FAL_API_KEY = 'd3ad61e7-ed88-48d4-b2db-6cb32423e5c5:27be2771ad2597d155e82aaadff2235f';
const FAL_SUBMIT_URL = 'https://queue.fal.run/fal-ai/flux-pro/v1.1';
const FAL_QUEUE_BASE = 'https://queue.fal.run/fal-ai/flux-pro/v1.1';
const PORT = process.env.PORT || 3000;

const falHeaders = {
  'Authorization': `Key ${FAL_API_KEY}`,
  'Content-Type': 'application/json'
};

app.get('/', (req, res) => {
  res.json({ ok: true });
});

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

  console.log('[SUBMIT] Calling Fal.ai queue:', FAL_SUBMIT_URL);

  try {
    const falRes = await fetch(FAL_SUBMIT_URL, {
      method: 'POST',
      headers: falHeaders,
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
  const statusUrl = `${FAL_QUEUE_BASE}/requests/${requestId}/status`;
  console.log(`[STATUS] Checking status for request_id: ${requestId}`);
  console.log(`[STATUS] URL: ${statusUrl}`);

  try {
    const statusRes = await fetch(statusUrl, { headers: falHeaders });
    const statusText = await statusRes.text();
    console.log(`[STATUS] Status response code: ${statusRes.status}`);
    console.log(`[STATUS] Status response body: "${statusText}"`);

    if (!statusText || statusText.trim() === '') {
      console.log('[STATUS] Empty body from Fal.ai — treating as processing');
      return res.json({ status: 'processing', url: null });
    }

    let statusData;
    try {
      statusData = JSON.parse(statusText);
    } catch (parseErr) {
      console.log('[STATUS] JSON parse error:', parseErr.message, '— body was:', statusText);
      return res.json({ status: 'processing', url: null });
    }

    if (!statusRes.ok) {
      console.log('[STATUS] ERROR: Fal.ai status check failed:', statusData);
      return res.status(502).json({ error: 'Status check failed', details: statusText });
    }

    const status = statusData.status;
    console.log(`[STATUS] Current status: ${status}`);

    if (status === 'COMPLETED' || status === 'completed') {
      const resultUrl = `${FAL_QUEUE_BASE}/requests/${requestId}/response`;
      console.log(`[STATUS] Fetching result from: ${resultUrl}`);

      const resultRes = await fetch(resultUrl, { headers: falHeaders });
      const resultText = await resultRes.text();
      console.log(`[STATUS] Result response code: ${resultRes.status}`);
      console.log(`[STATUS] Result response body: ${resultText}`);

      let resultData;
      try {
        resultData = JSON.parse(resultText);
      } catch (parseErr) {
        console.log('[STATUS] Result JSON parse error:', parseErr.message);
        return res.json({ status: 'processing', url: null });
      }

      const imageUrl = resultData?.images?.[0]?.url
        || resultData?.output?.images?.[0]?.url
        || null;

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
