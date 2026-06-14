const express = require('express');
const app = express();

app.use(express.json());

const FAL_API_KEY = 'd3ad61e7-ed88-48d4-b2db-6cb32423e5c5:27be2771ad2597d155e82aaadff2235f';
const FAL_URL = 'https://fal.run/fal-ai/flux-pro/v1.1';
const PORT = process.env.PORT || 3000;

const falHeaders = {
  'Authorization': `Key ${FAL_API_KEY}`,
  'Content-Type': 'application/json'
};

// In-memory job store
const jobs = new Map();

app.get('/', (req, res) => res.json({ ok: true }));

app.post('/submit', async (req, res) => {
  const { prompt, id } = req.body;
  console.log(`[SUBMIT] id: ${id}, prompt: "${prompt?.slice(0, 80)}..."`);

  if (!prompt) return res.status(400).json({ error: 'prompt is required' });

  // Generate our own request ID immediately
  const request_id = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  jobs.set(request_id, { status: 'processing', url: null });

  console.log(`[SUBMIT] Created job ${request_id}, firing Fal.ai in background`);
  res.json({ request_id });

  // Run Fal.ai call in background (after response sent)
  (async () => {
    try {
      console.log(`[JOB ${request_id}] Calling Fal.ai...`);
      const falRes = await fetch(FAL_URL, {
        method: 'POST',
        headers: falHeaders,
        body: JSON.stringify({
          prompt,
          image_size: 'landscape_4_3',
          num_images: 1,
          output_format: 'jpeg',
          safety_tolerance: '2',
          enhance_prompt: true
        })
      });

      const text = await falRes.text();
      console.log(`[JOB ${request_id}] Fal.ai status: ${falRes.status}`);
      console.log(`[JOB ${request_id}] Fal.ai body: ${text}`);

      if (!falRes.ok) {
        console.log(`[JOB ${request_id}] FAILED — non-OK response`);
        jobs.set(request_id, { status: 'failed', url: null });
        return;
      }

      const data = JSON.parse(text);
      const url = data?.images?.[0]?.url || data?.image?.url || null;

      console.log(`[JOB ${request_id}] COMPLETED — url: ${url}`);
      jobs.set(request_id, { status: 'completed', url });

    } catch (err) {
      console.log(`[JOB ${request_id}] EXCEPTION: ${err.message}`);
      jobs.set(request_id, { status: 'failed', url: null });
    }
  })();
});

app.get('/status/:requestId', (req, res) => {
  const { requestId } = req.params;
  const job = jobs.get(requestId);

  if (!job) {
    console.log(`[STATUS] Unknown request_id: ${requestId}`);
    return res.json({ status: 'processing', url: null });
  }

  console.log(`[STATUS] ${requestId} -> ${job.status}, url: ${job.url}`);
  return res.json({ status: job.status, url: job.url });
});

app.get('/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`[SERVER] flux-proxy running on port ${PORT}`);
});
