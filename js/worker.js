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

      // Determine recipient: if 'to' field provided, send notification to that address
      // Otherwise, it's a contact form — send to info@gacp.llc
      const isNotification = !!body.to;
      const recipient = isNotification
        ? { email: body.to, name: body.to_name || '' }
        : { email: 'info@gacp.llc', name: 'GACP LLC' };

      const replyTo = isNotification
        ? { email: 'info@gacp.llc', name: 'GACP LLC' }
        : { email: email, name: name };

      const emailContent = isNotification
        ? message
        : [
            `Name: ${name}`,
            `Email: ${email}`,
            `Subject: ${subject || 'General Enquiry'}`,
            `Company: ${body.company || 'N/A'}`,
            '',
            'Message:',
            message,
            '',
            '---',
            `IP: ${request.headers.get('cf-connecting-ip') || 'N/A'}`,
            `Country: ${request.cf?.country || 'N/A'}`,
            `City: ${request.cf?.city || 'N/A'}`,
            `Region: ${request.cf?.region || 'N/A'}`,
            `Org: ${request.cf?.asOrganization || 'N/A'}`,
          ].join('\n');

      // Send via MailChannels
      const mailRes = await fetch('https://api.mailchannels.net/tx/v1/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': env.MAILCHANNELS_API_KEY,
        },
        body: JSON.stringify({
          personalizations: [{ to: [recipient] }],
          from: {
            email: 'noreply@gacp.llc',
            name: 'GACP LLC',
          },
          reply_to: replyTo,
          subject: subject || `Contact Form: ${name}`,
          content: [{ type: 'text/plain', value: emailContent }],
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
