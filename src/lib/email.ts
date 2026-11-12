import "server-only";
import { config } from "./env";

export interface Email {
  to: string;
  subject: string;
  text: string;
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function toHtml(text: string): string {
  const linked = escapeHtml(text).replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" style="color:#2563EB">$1</a>');
  return `<div style="font-family:Inter,Arial,sans-serif;font-size:16px;color:#1F2933;line-height:1.5">${linked.replace(/\n/g, "<br>")}</div>`;
}

/**
 * Sends through Resend's HTTP API (works in Workers, no SDK needed).
 * With no RESEND_API_KEY the email is printed to the terminal instead, so local setup never fails.
 */
export async function sendEmail(email: Email): Promise<{ delivered: boolean; error?: string }> {
  const { RESEND_API_KEY, EMAIL_FROM } = config();
  if (!RESEND_API_KEY) {
    console.log(
      `\n──── FairShare email (RESEND_API_KEY not set — not sent) ────\nTo: ${email.to}\nSubject: ${email.subject}\n\n${email.text}\n─────────────────────────────────────────────────────────────\n`,
    );
    return { delivered: false, error: "Email isn't set up (no RESEND_API_KEY)." };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: EMAIL_FROM, to: [email.to], subject: email.subject, text: email.text, html: toHtml(email.text) }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`Resend rejected the email to ${email.to}: ${res.status} ${body}`);
    let reason = `Email service error ${res.status}.`;
    try {
      reason = (JSON.parse(body) as { message?: string }).message ?? reason;
    } catch {
      // keep the generic reason
    }
    return { delivered: false, error: reason };
  }
  return { delivered: true };
}
