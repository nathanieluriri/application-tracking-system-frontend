import { getSettings } from "@server/core/settings";
import {
  ConsoleTransport,
  SmtpTransport,
  type EmailTransport,
  type EmailSendArgs,
  type EmailSendResult,
} from "./transport";

/**
 * Email dispatch manager, mirrors `core/email/manager.py`. A process-wide
 * singleton chooses a transport from settings (console by default, SMTP when
 * EMAIL_TRANSPORT=smtp + EMAIL_HOST set) and retries sends with a linear
 * backoff using emailRetryAttempts / emailRetryBackoffSeconds.
 *
 * Framework-agnostic: no next/* imports.
 */

export interface EmailManagerConfig {
  transport: EmailTransport;
  senderName: string;
  fromEmail: string | null;
  retryAttempts: number;
  retryBackoffSeconds: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class EmailManager {
  private static instance: EmailManager | null = null;

  private readonly transport: EmailTransport;
  private readonly senderName: string;
  private readonly fromEmail: string | null;
  private readonly retryAttempts: number;
  private readonly retryBackoffSeconds: number;

  constructor(config: EmailManagerConfig) {
    this.transport = config.transport;
    this.senderName = config.senderName;
    this.fromEmail = config.fromEmail;
    this.retryAttempts = Math.max(config.retryAttempts, 1);
    this.retryBackoffSeconds = Math.max(config.retryBackoffSeconds, 0);
  }

  /** Build a manager from the current settings and install it as the singleton. */
  static configureFromSettings(): EmailManager {
    const settings = getSettings();

    let transport: EmailTransport;
    if (settings.emailTransport === "smtp" && settings.emailHost) {
      transport = new SmtpTransport({
        host: settings.emailHost,
        port: settings.emailPort,
        username: settings.emailUsername,
        password: settings.emailPassword,
        fromEmail: settings.emailFromEmail ?? settings.emailUsername ?? "no-reply@localhost",
        senderName: settings.emailSenderName,
      });
    } else {
      transport = new ConsoleTransport();
    }

    const manager = new EmailManager({
      transport,
      senderName: settings.emailSenderName,
      fromEmail: settings.emailFromEmail ?? settings.emailUsername ?? null,
      retryAttempts: settings.emailRetryAttempts,
      retryBackoffSeconds: settings.emailRetryBackoffSeconds,
    });
    EmailManager.instance = manager;
    return manager;
  }

  /** Install an explicit manager (used by tests). */
  static configure(manager: EmailManager): EmailManager {
    EmailManager.instance = manager;
    return manager;
  }

  static getInstance(): EmailManager {
    if (EmailManager.instance === null) {
      return EmailManager.configureFromSettings();
    }
    return EmailManager.instance;
  }

  /** Test-only: drop the singleton so a fresh transport can be picked up. */
  static reset(): void {
    EmailManager.instance = null;
  }

  async send(args: EmailSendArgs): Promise<EmailSendResult> {
    const from = args.from ?? this.fromEmail ?? undefined;
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= this.retryAttempts; attempt += 1) {
      try {
        return await this.transport.send({ ...args, from });
      } catch (err) {
        lastError = err;
        // eslint-disable-next-line no-console
        console.error(
          `[email] send attempt ${attempt}/${this.retryAttempts} failed for ${args.to}:`,
          err,
        );
        if (attempt < this.retryAttempts && this.retryBackoffSeconds > 0) {
          await sleep(this.retryBackoffSeconds * attempt * 1000);
        }
      }
    }
    throw new Error(
      `Unable to send email after ${this.retryAttempts} attempts: ${String(lastError)}`,
    );
  }
}
