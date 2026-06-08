const PROXY_URL = 'https://flux-proxy--icdemo26.replit.app';
const business = $('Code in JavaScript').item.json.business_name || 'business';

const prompts = [
  `Professional wide-angle commercial photography of ${business}. Golden hour lighting, warm sunlight, natural environment. Modern professional workspace showing team collaboration. Shot from chest level, looking slightly upward. Genuine human emotion, confident posture. High contrast, crisp details, 4K quality. Photorealistic, no filters, professional grade cinematography.`,
  
  `Macro close-up product and hands detail photography of ${business} service in action. Shallow depth of field, razor-sharp focus on key details. Hands working with precision, showing craftsmanship and expertise. Studio lighting with soft fill light, professional product photography. Authentic texture, genuine materials, high-end commercial style. 8K detail, photorealistic quality. Premium luxury aesthetic.`,
  
  `Candid action shot of person actively using ${business} service, genuine satisfaction visible. Medium shot, dynamic composition, authentic lifestyle moment. Natural indoor lighting mixed with practical task lighting. Documentary-style street photography approach but premium quality. Authentic emotion, real people, real environment. Photorealistic, sharp focus, professional color grading. High energy, positive moment captured authentically.`
];

const images = [];

for (let i = 0; i < prompts.length; i++) {
  try {
    console.log(`[${i + 1}] Submitting...`);
    
    // Submit request
    const submitRes = await fetch(`${PROXY_URL}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: prompts[i], id: `img_${i}` })
    });

    const submitData = await submitRes.json();
    const requestId = submitData.request_id;
    
    console.log(`[${i + 1}] Request ID: ${requestId}`);

    // Poll for completion
    let completed = false;
    let polls = 0;
    
    while (!completed && polls < 120) {
      await new Promise(r => setTimeout(r, 5000));
      polls++;

      const statusRes = await fetch(`${PROXY_URL}/status/${requestId}`);
      const statusData = await statusRes.json();

      console.log(`[${i + 1}] Poll ${polls}: ${statusData.status}`);

      if (statusData.status === 'completed') {
        console.log(`[${i + 1}] ✅ Got image`);
        images.push(statusData.url);
        completed = true;
      }

      if (statusData.status === 'failed') {
        console.log(`[${i + 1}] ❌ Failed`);
        images.push(null);
        completed = true;
      }
    }

    if (!completed) {
      console.log(`[${i + 1}] Timeout`);
      images.push(null);
    }
  } catch (error) {
    console.log(`[${i + 1}] Error:`, error.message);
    images.push(null);
  }
}

return {
  json: {
    hero_image: images[0],
    support_image: images[1],
    action_image: images[2],
    business_name: business
  }
};
