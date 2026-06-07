const express = require('express');
const app = express();

app.use(express.json());

const FAL_API_KEY = 'd3ad61e7-ed88-48d4-b2db-6cb32423e5c5:27be2771ad2597d155e82aaadff2235f';
const FAL_ENDPOINT = 'https://fal.run/fal-ai/flux-pro/v1.1';
const FAL_STATUS = 'https://fal.run/fal-ai/flux-pro/requests';

app.post('/generate', async (req, res) => {
  try {
    const { prompt } = req.body;
    console.log('Received prompt:', prompt.substring(0, 50) + '...');
    
    const submitRes = await fetch(FAL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${FAL_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: prompt,
        image_size: 'landscape_4_3',
        num_images: 1,
        output_format: 'jpeg',
        safety_tolerance: '2',
        enhance_prompt: true
      })
    });

    const submitData = await submitRes.json();
    console.log('Submit response:', submitRes.status);
    
    const requestId = submitData.request_id;

    if (!requestId) {
      console.log('No request ID:', submitData);
      return res.status(400).json({ error: 'No request ID', details: submitData });
    }

    console.log('Request ID:', requestId);

    let attempts = 0;
    while (attempts < 60) {
      await new Promise(r => setTimeout(r, 5000));
      attempts++;

      const statusRes = await fetch(`${FAL_STATUS}/${requestId}`, {
        method: 'GET',
        headers: { 'Authorization': `Key ${FAL_API_KEY}` }
      });

      const statusData = await statusRes.json();
      console.log(`Poll ${attempts}: ${statusData.status}`);

      if (statusData.status === 'completed') {
        const imageUrl = statusData.result?.images?.[0]?.url;
        console.log('Image ready:', imageUrl ? 'YES' : 'NO');
        return res.json({ url: imageUrl });
      }

      if (statusData.status === 'failed') {
        console.log('Generation failed:', statusData);
        return res.status(400).json({ error: 'Image generation failed' });
      }
    }

    return res.status(408).json({ error: 'Timeout after 5 minutes' });
  } catch (error) {
    console.log('Server error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
