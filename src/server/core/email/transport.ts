import { randomUUID } from "node:crypto";

/**
 * Email transports, mirrors `core/email/transport.py`. The browser never sees
 * these — they run server-side only. The default `ConsoleTransport` just logs
 * the message (so the app boots and sends "work" without any SMTP config); the
 * `SmtpTransport` lazily imports `nodemailer` so the heavy SDK is only loaded
 * when EMAIL_TRANSPORT=smtp with EMAIL_HOST configured.
 */

export interface EmailSendArgs {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

export interface EmailSendResult {
  id: string;
}

export interface EmailTransport {
  send(args: EmailSendArgs): Promise<EmailSendResult>;
}

/** Default transport: logs the message as JSON and returns a random id. */
export class ConsoleTransport implements EmailTransport {
  async send(args: EmailSendArgs): Promise<EmailSendResult> {
    const id = randomUUID();
    // eslint-disable-next-line no-console
    console.log(
      "[email:console] " +
        JSON.stringify({
          id,
          to: args.to,
          from: args.from ?? null,
          subject: args.subject,
          html: args.html,
          text: args.text ?? null,
        }),
    );
    return { id };
  }
}

export interface SmtpConfig {
  host: string;
  port: number;
  username: string | null;
  password: string | null;
  fromEmail: string;
  senderName: string;
}

/**
 * SMTP transport backed by nodemailer. The SDK is imported lazily inside
 * `send` so importing this module never pulls nodemailer into the bundle unless
 * a message is actually dispatched through SMTP.
 */
export class SmtpTransport implements EmailTransport {
  private readonly config: SmtpConfig;
  private transporter: unknown = null;

  constructor(config: SmtpConfig) {
    this.config = config;
  }

  private async getTransporter(): Promise<{
    sendMail(opts: Record<string, unknown>): Promise<{ messageId?: string }>;
  }> {
    if (this.transporter) {
      return this.transporter as {
        sendMail(opts: Record<string, unknown>): Promise<{ messageId?: string }>;
      };
    }
    // Lazy import so the app boots without nodemailer being loaded.
    const nodemailer = await import("nodemailer");
    const createTransport =
      (nodemailer as { createTransport?: unknown }).createTransport ??
      (nodemailer as { default?: { createTransport?: unknown } }).default?.createTransport;
    if (typeof createTransport !== "function") {
      throw new Error("nodemailer.createTransport is unavailable");
    }
    const auth =
      this.config.username && this.config.password
        ? { user: this.config.username, pass: this.config.password }
        : undefined;
    this.transporter = (createTransport as (opts: Record<string, unknown>) => unknown)({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.port === 465,
      auth,
    });
    return this.transporter as {
      sendMail(opts: Record<string, unknown>): Promise<{ messageId?: string }>;
    };
  }

  async send(args: EmailSendArgs): Promise<EmailSendResult> {
    const transporter = await this.getTransporter();
    const fromAddress = args.from ?? this.config.fromEmail;
    const from = this.config.senderName
      ? `${this.config.senderName} <${fromAddress}>`
      : fromAddress;
    const info = await transporter.sendMail({
      from,
      to: args.to,
      subject: args.subject,
      html: args.html,
      text: args.text ?? undefined,
    });
    return { id: info.messageId ?? randomUUID() };
  }
}
