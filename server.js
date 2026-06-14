const express = require('express');
const app = express();

app.use(express.json());

const FAL_API_KEY = 'd3ad61e7-ed88-48d4-b2db-6cb32423e5c5:27be2771ad2597d155e82aaadff2235f';
const FAL_SUBMIT_URL = 'https://queue.fal.run/fal-ai/flux-pro/v1.1';
const PORT = process.env.PORT || 3000;

const falHeaders = {
  'Authorization': `Key ${FAL_API_KEY}`,
  'Content-Type': 'application/json'
};

// Store status_url and response_url keyed by request_id
const requestMap = new Map();

app.get('/', (req, res) => {
  res.json({ ok: true });
});

app.post('/submit', async (req, res) => {
  const { prompt, id } = req.body;
  console.log(`[SUBMIT] id: ${id}, prompt: "${prompt?.slice(0, 80)}..."`);

  if (!prompt) {
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

  try {
    const falRes = await fetch(FAL_SUBMIT_URL, {
      method: 'POST',
      headers: falHeaders,
      body: JSON.stringify(payload)
    });

    const text = await falRes.text();
    console.log(`[SUBMIT] Fal.ai status: ${falRes.status}, body: ${text}`);

    if (!falRes.ok) {
      return res.status(502).json({ error: 'Fal.ai submission failed', details: text });
    }

    const data = JSON.parse(text);
    console.log(`[SUBMIT] Full response:`, JSON.stringify(data));

    const request_id = data.request_id;
    if (!request_id) {
      return res.status(502).json({ error: 'No request_id from Fal.ai', raw: data });
    }

    // Store the exact URLs Fal.ai gives us
    requestMap.set(request_id, {
      status_url: data.status_url,
      response_url: data.response_url,
      request_id
    });

    console.log(`[SUBMIT] Stored — request_id: ${request_id}, status_url: ${data.status_url}, response_url: ${data.response_url}`);
    return res.json({ request_id });

  } catch (err) {
    console.log('[SUBMIT] EXCEPTION:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

app.get('/status/:requestId', async (req, res) => {
  const { requestId } = req.params;
  const stored = requestMap.get(requestId);

  // Use stored status_url if available, otherwise construct it
  const statusUrl = stored?.status_url
    || `https://queue.fal.run/fal-ai/flux-pro/v1.1/requests/${requestId}/status`;

  console.log(`[STATUS] request_id: ${requestId}, url: ${statusUrl}`);

  try {
    const statusRes = await fetch(statusUrl, { headers: falHeaders });
    const statusText = await statusRes.text();
    console.log(`[STATUS] code: ${statusRes.status}, body: "${statusText}"`);

    if (!statusText || statusText.trim() === '') {
      return res.json({ status: 'processing', url: null });
    }

    let statusData;
    try {
      statusData = JSON.parse(statusText);
    } catch (e) {
      console.log('[STATUS] parse error:', e.message);
      return res.json({ status: 'processing', url: null });
    }

    const status = statusData.status;
    console.log(`[STATUS] status value: "${status}"`);

    if (status === 'COMPLETED' || status === 'completed') {
      // Use stored response_url if available
      const resultUrl = stored?.response_url
        || `https://queue.fal.run/fal-ai/flux-pro/v1.1/requests/${requestId}`;

      console.log(`[STATUS] Fetching result: ${resultUrl}`);
      const resultRes = await fetch(resultUrl, { headers: falHeaders });
      const resultText = await resultRes.text();
      console.log(`[STATUS] result code: ${resultRes.status}, body: ${resultText}`);

      let resultData;
      try {
        resultData = JSON.parse(resultText);
      } catch (e) {
        console.log('[STATUS] result parse error:', e.message);
        return res.json({ status: 'processing', url: null });
      }

      const imageUrl = resultData?.images?.[0]?.url
        || resultData?.output?.images?.[0]?.url
        || null;

      console.log(`[STATUS] COMPLETED — image URL: ${imageUrl}`);
      requestMap.delete(requestId);
      return res.json({ status: 'completed', url: imageUrl });
    }

    if (status === 'FAILED' || status === 'failed' || status === 'ERROR') {
      console.log('[STATUS] FAILED/ERROR');
      requestMap.delete(requestId);
      return res.json({ status: 'failed', url: null });
    }

    // IN_QUEUE, IN_PROGRESS, or anything else = still processing
    return res.json({ status: 'processing', url: null });

  } catch (err) {
    console.log('[STATUS] EXCEPTION:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`[SERVER] flux-proxy running on port ${PORT}`);
});
