import axios from 'axios';
import { config } from '../config';
import { logger } from '../utils/logger';

export interface EmailRequest {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

export interface ApprovalNotificationData {
  approverName: string;
  itineraryTitle: string;
  clientName: string;
  totalBudget: number;
  startDate: string;
  endDate: string;
  approvalLink: string;
}

export interface BookingConfirmationData {
  clientName: string;
  confirmationNumber: string;
  itineraryTitle: string;
  startDate: string;
  endDate: string;
  totalCost: number;
  currency: string;
}

/**
 * Email Notification Service
 * Handles sending transactional emails via SendGrid
 */
export class EmailService {
  private sendgridApiKey: string;

  constructor() {
    this.sendgridApiKey = config.email.sendgridApiKey;
  }

  /**
   * Send generic email
   */
  async sendEmail(request: EmailRequest): Promise<{ messageId: string }> {
    if (!this.sendgridApiKey) {
      logger.warn('SendGrid not configured, email not sent', {
        to: request.to,
        subject: request.subject,
      });
      // In development, just log the email
      logger.info('Email would be sent:', request);
      return { messageId: `mock_${Date.now()}` };
    }

    try {
      const response = await axios.post(
        'https://api.sendgrid.com/v3/mail/send',
        {
          personalizations: [
            {
              to: [{ email: request.to }],
              subject: request.subject,
            },
          ],
          from: {
            email: request.from || config.email.supportEmail,
            name: 'LuxAI Designer',
          },
          content: [
            {
              type: 'text/html',
              value: request.html,
            },
            ...(request.text
              ? [
                  {
                    type: 'text/plain',
                    value: request.text,
                  },
                ]
              : []),
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${this.sendgridApiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const messageId = response.headers['x-message-id'] || `sg_${Date.now()}`;

      logger.info('Email sent successfully', {
        to: request.to,
        subject: request.subject,
        messageId,
      });

      return { messageId };
    } catch (error: any) {
      logger.error('Failed to send email', {
        error,
        to: request.to,
        subject: request.subject,
      });
      throw error;
    }
  }

  /**
   * Send approval notification email
   */
  async sendApprovalNotification(
    email: string,
    data: ApprovalNotificationData
  ): Promise<void> {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #2c3e50; color: white; padding: 20px; text-align: center; }
            .content { background: #f9f9f9; padding: 30px; }
            .button { display: inline-block; padding: 12px 30px; background: #d4af37; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .details { background: white; padding: 20px; margin: 20px 0; border-left: 4px solid #d4af37; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Approval Required</h1>
            </div>
            <div class="content">
              <p>Dear ${data.approverName},</p>
              <p>A new itinerary requires your approval:</p>

              <div class="details">
                <h3>${data.itineraryTitle}</h3>
                <p><strong>Client:</strong> ${data.clientName}</p>
                <p><strong>Dates:</strong> ${data.startDate} - ${data.endDate}</p>
                <p><strong>Total Budget:</strong> $${data.totalBudget.toLocaleString()} USD</p>
              </div>

              <p>Please review and approve or reject this itinerary:</p>

              <a href="${data.approvalLink}" class="button">Review Itinerary</a>

              <p style="margin-top: 30px; color: #666; font-size: 14px;">
                This approval is part of your organization's multi-stakeholder approval workflow.
              </p>
            </div>
            <div class="footer">
              <p>LuxAI Designer - Your World, Anticipated</p>
              <p>This is an automated message. Please do not reply to this email.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `
Approval Required

Dear ${data.approverName},

A new itinerary requires your approval:

${data.itineraryTitle}
Client: ${data.clientName}
Dates: ${data.startDate} - ${data.endDate}
Total Budget: $${data.totalBudget.toLocaleString()} USD

Please review at: ${data.approvalLink}

---
LuxAI Designer - Your World, Anticipated
    `.trim();

    await this.sendEmail({
      to: email,
      subject: `Approval Required: ${data.itineraryTitle}`,
      html,
      text,
    });
  }

  /**
   * Send booking confirmation email
   */
  async sendBookingConfirmation(
    email: string,
    data: BookingConfirmationData
  ): Promise<void> {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #2c3e50; color: white; padding: 20px; text-align: center; }
            .content { background: #f9f9f9; padding: 30px; }
            .confirmation { background: #d4af37; color: white; padding: 20px; text-align: center; margin: 20px 0; border-radius: 5px; }
            .details { background: white; padding: 20px; margin: 20px 0; border-left: 4px solid #27ae60; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Booking Confirmed!</h1>
            </div>
            <div class="content">
              <p>Dear ${data.clientName},</p>
              <p>Your luxury travel experience has been confirmed!</p>

              <div class="confirmation">
                <h2 style="margin: 0;">Confirmation #${data.confirmationNumber}</h2>
              </div>

              <div class="details">
                <h3>${data.itineraryTitle}</h3>
                <p><strong>Travel Dates:</strong> ${data.startDate} - ${data.endDate}</p>
                <p><strong>Total Investment:</strong> $${data.totalCost.toLocaleString()} ${data.currency}</p>
              </div>

              <p>Your dedicated travel concierge will be in touch shortly with complete details and any final arrangements.</p>

              <p style="margin-top: 30px;">
                <strong>What's Next?</strong>
              </p>
              <ul>
                <li>Complete any required travel documents</li>
                <li>Review your detailed itinerary</li>
                <li>Coordinate with your concierge for special requests</li>
              </ul>
            </div>
            <div class="footer">
              <p>LuxAI Designer - Your World, Anticipated</p>
              <p>Questions? Contact us at ${config.email.supportEmail}</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `
Booking Confirmed!

Dear ${data.clientName},

Your luxury travel experience has been confirmed!

Confirmation Number: ${data.confirmationNumber}

${data.itineraryTitle}
Travel Dates: ${data.startDate} - ${data.endDate}
Total Investment: $${data.totalCost.toLocaleString()} ${data.currency}

Your dedicated travel concierge will be in touch shortly.

Questions? Contact us at ${config.email.supportEmail}

---
LuxAI Designer - Your World, Anticipated
    `.trim();

    await this.sendEmail({
      to: email,
      subject: `Booking Confirmed - ${data.confirmationNumber}`,
      html,
      text,
    });
  }

  /**
   * Send KYC verification reminder
   */
  async sendKYCReminder(email: string, userName: string, verificationLink: string): Promise<void> {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #2c3e50; color: white; padding: 20px; text-align: center; }
            .content { background: #f9f9f9; padding: 30px; }
            .button { display: inline-block; padding: 12px 30px; background: #d4af37; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Complete Your Verification</h1>
            </div>
            <div class="content">
              <p>Dear ${userName},</p>
              <p>To unlock the full luxury travel experience, please complete your identity verification.</p>

              <p>This quick process ensures the security and exclusivity of our platform for all members.</p>

              <a href="${verificationLink}" class="button">Complete Verification</a>

              <p style="margin-top: 30px; color: #666; font-size: 14px;">
                Your information is encrypted and secure. We comply with all KYC/AML regulations.
              </p>
            </div>
            <div class="footer">
              <p>LuxAI Designer - Your World, Anticipated</p>
            </div>
          </div>
        </body>
      </html>
    `;

    await this.sendEmail({
      to: email,
      subject: 'Complete Your Identity Verification',
      html,
    });
  }
}

export const emailService = new EmailService();
