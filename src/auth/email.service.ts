import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BrevoClient } from '@getbrevo/brevo';

@Injectable()
export class EmailService {
  private brevo: BrevoClient;
  private from: string;
  private name: string;

  constructor(private readonly configService: ConfigService) {
    this.brevo = new BrevoClient({
      apiKey: this.configService.get('BREVO_API_KEY') || "",
    });
    this.from = this.configService.get('SMTP_FROM') || "";
    this.name = this.configService.get('SMTP_USER') || "Omar";
  }

  private async send(to: string, subject: string, htmlContent: string) {
    await this.brevo.transactionalEmails.sendTransacEmail({
      sender: {
        email: this.from,
        name: this.name
      },
      to: [{ email: to }],
      subject,
      htmlContent,
    });
  }

  async sendVerificationCode(email: string, code: string, name: string) {
    await this.send(email, 'Verify your email', `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Hi ${name}, verify your email</h2>
        <p>Your verification code is:</p>
        <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; text-align: center; padding: 20px; background: #f5f5f5; border-radius: 8px;">
          ${code}
        </div>
        <p>This code expires in 15 minutes.</p>
        <p>If you didn't create an account, you can safely ignore this email.</p>
      </div>
    `);
  }

  async sendPasswordResetEmail(email: string, token: string, name: string) {
    const resetUrl = `${this.configService.get('FRONTEND_URL')}/reset-password?token=${token}`;
    await this.send(email, 'Reset your password', `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Hi ${name}, reset your password</h2>
        <p>Click the button below to reset your password:</p>
        <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background: #2dd4d4; color: white; text-decoration: none; border-radius: 8px; margin: 16px 0;">
          Reset Password
        </a>
        <p>This link expires in 1 hour.</p>
        <p>If you didn't request a password reset, you can safely ignore this email.</p>
      </div>
    `);
  }

  async sendNotificationEmail(
    email: string,
    name: string,
    title: string,
    body: string,
    jobId?: string | null,
  ) {
    const jobUrl = jobId
      ? `${this.configService.get('FRONTEND_URL')}/dashboard/jobs/${jobId}`
      : null;

    await this.send(email, title, `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Hi ${name},</h2>
        <p>${body}</p>
        ${jobUrl ? `
          <a href="${jobUrl}" style="display: inline-block; padding: 12px 24px; background: #2dd4d4; color: white; text-decoration: none; border-radius: 8px; margin: 16px 0;">
            View Job
          </a>
        ` : ''}
        <p style="color: #888; font-size: 12px; margin-top: 32px;">
          You're receiving this because you enabled email notifications.
          You can disable them in your account settings.
        </p>
      </div>
    `);
  }
}