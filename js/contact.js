/* ============================================================
   GACP LLC — contact.js
   Contact form submission → Cloudflare Worker → MailChannels
   ============================================================ */

function initContactForm() {
  const form = document.getElementById('contact-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('[type="submit"]');
    const originalText = btn.textContent;

    btn.disabled = true;
    btn.textContent = 'Sending…';

    const formData = new FormData(form);
    const payload = Object.fromEntries(formData);

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Failed to send');

      showToast('Message sent successfully!', 'success');
      form.reset();
    } catch (err) {
      showToast('Failed to send message. Please email info@gacp.llc directly.', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  });
}

document.addEventListener('DOMContentLoaded', initContactForm);
