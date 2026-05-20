// Resend email client. Plain fetch, no SDK dependency.
// Sender is hard-coded to hunter@buildmyblast.com (the verified domain).

import { log } from './log.js';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const FROM = 'Directory Hunter <hunter@buildmyblast.com>';

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `Missing env var ${name}. Copy .env.example to .env.local and fill it in, ` +
      `or pass it to node via --env-file=.env.local.`
    );
  }
  return v;
}

// Sends one email via Resend. Returns the provider message id.
// Throws on non-2xx.
export async function sendEmail({ to, subject, html, text }) {
  const apiKey = requireEnv('RESEND_API_KEY');
  if (!to) throw new Error('sendEmail: missing to');
  if (!subject) throw new Error('sendEmail: missing subject');
  if (!html && !text) throw new Error('sendEmail: need html or text');

  const body = {
    from: FROM,
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
    text
  };

  const res = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const payload = await res.json().catch(() => ({}));

  if (!res.ok) {
    log.error('sendEmail failed', { status: res.status, payload });
    throw new Error(`sendEmail: Resend returned ${res.status}: ${payload?.message || 'unknown error'}`);
  }

  log.info('sendEmail ok', { id: payload.id, to: body.to, subject });
  return { id: payload.id };
}
