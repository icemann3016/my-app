import "server-only";

import nodemailer from "nodemailer";

export type Email = { to: string; subject: string; text: string; html?: string };

/**
 * Send an email. EMAIL_DRIVER picks the provider:
 * - "console" (default): prints the email in the server terminal. For development.
 * - "smtp": any SMTP service (Resend, SendGrid, Azure Communication Services, Mailgun…).
 *
 * Returns whether the email really went somewhere a person can read it. With the console driver
 * in production it did not: nothing is printed (emails can hold reset links and medical dates),
 * and callers that track delivery (expiry reminders) try again later.
 */
export async function sendEmail(email: Email): Promise<boolean> {
  const driver = process.env.EMAIL_DRIVER ?? "console";

  if (driver === "smtp") {
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
        : undefined,
    });
    await transport.sendMail({ from: process.env.EMAIL_FROM, ...email });
    return true;
  }

  if (process.env.NODE_ENV === "production") {
    console.warn("[email] EMAIL_DRIVER=console in production: an email was NOT sent.");
    return false;
  }
  console.info(`\n[email] To: ${email.to}\n[email] Subject: ${email.subject}\n\n${email.text}\n`);
  return true;
}
