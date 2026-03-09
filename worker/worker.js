/**
 * GACP LLC — Contact Form Worker
 * Receives form submissions and forwards via MailChannels API
 *
 * Deployed to: gacp.llc/api/contact*
 * Worker name: gacp-contact-form
 */

export default {
  async fetch(request, env) {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': 'https://gacp.llc',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      const body = await request.json();

      const { name, email, message, subject } = body;

      if (!name || !email || !message) {
        return new Response(JSON.stringify({ error: 'Missing required fields' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Send via MailChannels
      const mailRes = await fetch('https://api.mailchannels.net/tx/v1/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personalizations: [
            {
              to: [{ email: 'info@gacp.llc', name: 'GACP LLC' }],
            },
          ],
          from: {
            email: 'noreply@gacp.llc',
            name: 'GACP Website',
          },
          reply_to: {
            email: email,
            name: name,
          },
          subject: subject || `Contact Form: ${name}`,
          content: [
            {
              type: 'text/plain',
              value: [
                `Name: ${name}`,
                `Email: ${email}`,
                `Subject: ${subject || 'General Enquiry'}`,
                '',
                'Message:',
                message,
                '',
                '---',
                `IP Country: ${body.ip_country || 'N/A'}`,
                `IP City: ${body.ip_city || 'N/A'}`,
              ].join('\n'),
            },
          ],
        }),
      });

      if (!mailRes.ok) {
        const errText = await mailRes.text();
        console.error('MailChannels error:', errText);
        return new Response(JSON.stringify({ error: 'Email delivery failed' }), {
          status: 500,
          headers: corsHeaders(),
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: corsHeaders(),
      });
    } catch (err) {
      console.error('Worker error:', err);
      return new Response(JSON.stringify({ error: 'Internal error' }), {
        status: 500,
        headers: corsHeaders(),
      });
    }
  },
};

function corsHeaders() {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': 'https://gacp.llc',
  };
}
