const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders });
    }

    if (!env.SLACK_WEBHOOK_URL) {
      return new Response('Worker not configured', { status: 500, headers: corsHeaders });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response('Invalid JSON body', { status: 400, headers: corsHeaders });
    }

    // Accept { data: { name, message } } (form block) or { name, message } (flat)
    const payload = body?.data || body || {};
    const { name, message } = payload;
    if (!name || !message) {
      return new Response('Missing fields', { status: 400, headers: corsHeaders });
    }

    const slackPayload = {
      text: `📩 New Contact Form Submission\n*Name:* ${name}\n*Message:* ${message}`,
    };

    const webhookResponse = await fetch(env.SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(slackPayload),
    });

    return new Response('OK', {
      status: webhookResponse.ok ? 200 : 500,
      headers: corsHeaders,
    });
  },
};
