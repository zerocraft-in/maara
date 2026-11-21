/**
 * Server-only mailer for invitation emails.
 *
 * Uses Nodemailer with Gmail SMTP. All configuration is read from
 * server-side environment variables. This module must never be imported
 * by client components.
 */

import "server-only";

import nodemailer, { type Transporter } from "nodemailer";

export type MailConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  appPassword: string;
  fromName: string;
  fromEmail: string;
};

export type InvitationMailInput = {
  to: string;
  organizationName: string;
  role: string;
  acceptanceUrl: string;
};

let transporter: Transporter | null = null;

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function loadConfig(): MailConfig {
  const host = requiredEnv("MAIL_HOST");
  const portRaw = requiredEnv("MAIL_PORT");
  const user = requiredEnv("MAIL_USER");
  const appPassword = requiredEnv("MAIL_APP_PASSWORD");
  const fromEmail = requiredEnv("MAIL_FROM_EMAIL");
  const fromName = process.env.MAIL_FROM_NAME ?? "Maara Merch";

  const port = Number(portRaw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid MAIL_PORT: ${portRaw}`);
  }

  const secure = process.env.MAIL_SECURE === "true";

  return {
    host,
    port,
    secure,
    user,
    appPassword,
    fromName,
    fromEmail,
  };
}

function getTransporter(): Transporter {
  if (!transporter) {
    const config = loadConfig();
    transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.appPassword,
      },
    });
  }
  return transporter;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function sendInvitationEmail(
  input: InvitationMailInput,
): Promise<void> {
  const config = loadConfig();
  const transporter = getTransporter();

  const safeOrgName = escapeHtml(input.organizationName);
  const safeRole = escapeHtml(input.role);
  const safeAcceptanceUrl = escapeHtml(input.acceptanceUrl);

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>You've been invited to ${safeOrgName}</title>
    </head>
    <body style="margin:0; padding:0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif; line-height:1.5; color:#1f2937; background-color:#f3f4f6;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; margin:0 auto; padding:40px 20px;">
        <tr>
          <td align="center" style="padding-bottom:32px;">
            <div style="display:inline-block; width:48px; height:48px; background-color:#2563eb; border-radius:12px; display:flex; align-items:center; justify-content:center;">
              <span style="color:#ffffff; font-weight:bold; font-size:20px;">M</span>
            </div>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding-bottom:24px;">
            <h1 style="margin:0; font-size:24px; font-weight:600; color:#111827;">You&rsquo;ve been invited to ${safeOrgName}</h1>
          </td>
        </tr>
        <tr>
          <td align="left" style="padding-bottom:24px;">
            <p style="margin:0 0 12px 0; font-size:16px; color:#374151;">
              You&rsquo;ve been invited to join <strong>${safeOrgName}</strong> as a <strong>${safeRole}</strong>.
            </p>
            <p style="margin:0;">
              Accept the invitation to access your organization&rsquo;s dashboard and start collaborating with your team.
            </p>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding-bottom:32px;">
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="border-radius:6px; background-color:#2563eb;">
                  <a href="${safeAcceptanceUrl}" target="_blank" style="display:inline-block; padding:14px 28px; font-size:16px; font-weight:600; color:#ffffff; text-decoration:none; border-radius:6px;">Accept Invitation</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td align="left" style="padding-bottom:24px;">
            <p style="margin:0 0 8px 0; font-size:14px; color:#6b7280;">
              This invitation expires in <strong>72 hours</strong>. If you do not accept within this time, the invitation will be revoked.
            </p>
            <p style="margin:0; font-size:14px; color:#6b7280;">
              If you did not expect this invitation, you can safely ignore this email.
            </p>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding-top:32px; border-top:1px solid #e5e7eb;">
            <p style="margin:0; font-size:12px; color:#9ca3af;">
              Maara Merch &mdash; Retail management for clothing businesses
            </p>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const text = `
You've been invited to ${input.organizationName} as a ${input.role}.

You've been invited to join ${input.organizationName} as a ${input.role}.
Accept the invitation to access your organization's dashboard and start collaborating with your team.

Accept the invitation: ${input.acceptanceUrl}

This invitation expires in 72 hours. If you do not accept within this time, the invitation will be revoked.

If you did not expect this invitation, you can safely ignore this email.

Maara Merch -- Retail management for clothing businesses
  `;

  await transporter.sendMail({
    from: `"${config.fromName}" <${config.fromEmail}>`,
    to: input.to,
    subject: `Invitation to join ${input.organizationName}`,
    html,
    text,
  });
}

export async function sendInvitationEmailWithFallback(
  input: InvitationMailInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await sendInvitationEmail(input);
    return { ok: true };
  } catch {
    return { ok: false, error: "Unable to send invitation email." };
  }
}
