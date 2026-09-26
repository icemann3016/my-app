import { siteConfig } from "@/lib/site";

function layout(text: string, url: string, cta: string) {
  return `<p>${text.replaceAll("\n", "<br>")}</p>
<p><a href="${url}" style="display:inline-block;padding:10px 16px;background:#0b5bd3;color:#fff;border-radius:6px;text-decoration:none">${cta}</a></p>
<p style="color:#666;font-size:12px">If the button doesn't work, copy this link into your browser:<br>${url}</p>`;
}

export function verifyEmailEmail({ name, url }: { name: string; url: string }) {
  const text = `Hi ${name},\n\nPlease confirm your email address to finish setting up your ${siteConfig.name} account.`;
  return {
    subject: `Confirm your email for ${siteConfig.name}`,
    text: `${text}\n\n${url}\n`,
    html: layout(text, url, "Confirm email"),
  };
}

export function resetPasswordEmail({ name, url }: { name: string; url: string }) {
  const text = `Hi ${name},\n\nWe received a request to reset your ${siteConfig.name} password. The link is valid for one hour. If you didn't ask for this, you can ignore this email.`;
  return {
    subject: `Reset your ${siteConfig.name} password`,
    text: `${text}\n\n${url}\n`,
    html: layout(text, url, "Choose a new password"),
  };
}
