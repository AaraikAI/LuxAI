import nodemailer from 'nodemailer';
import handlebars from 'handlebars';
import { readFileSync } from 'fs';
import { join } from 'path';
import { config } from '../config';
import { logger } from '../utils/logger';
import { query } from '../db';

export interface EmailOptions {
  to: string | string[];
  subject: string;
  template?: string;
  data?: Record<string, any>;
  html?: string;
  text?: string;
  from?: string;
  userId?: string;
  attachments?: Array<{
    filename: string;
    path?: string;
    content?: Buffer | string;
  }>;
}

export interface EmailLog {
  id: string;
  toEmail: string;
  fromEmail: string;
  subject: string;
  templateName?: string;
  status: 'pending' | 'sent' | 'failed' | 'bounced';
  errorMessage?: string;
  sentAt?: Date;
  messageId?: string;
  userId?: string;
}

/**
 * Email Service
 * Handles sending emails with templates, logging, and error handling
 */
export class EmailService {
  private transporter: nodemailer.Transporter;
  private templateCache: Map<string, handlebars.TemplateDelegate> = new Map();
  private baseLayout?: handlebars.TemplateDelegate;

  constructor() {
    // Initialize nodemailer transporter
    this.transporter = nodemailer.createTransporter({
      host: config.email.smtpHost || process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(config.email.smtpPort || process.env.SMTP_PORT || '587'),
      secure: config.email.smtpSecure !== undefined ? config.email.smtpSecure : false,
      auth: config.email.smtpUser && config.email.smtpPassword
        ? {
            user: config.email.smtpUser,
            pass: config.email.smtpPassword,
          }
        : undefined,
      tls: {
        rejectUnauthorized: false, // Allow self-signed certificates in development
      },
    });

    // Register Handlebars helpers
    this.registerHelpers();

    // Load base layout
    this.loadBaseLayout();
  }

  /**
   * Register Handlebars helpers
   */
  private registerHelpers() {
    handlebars.registerHelper('eq', (a, b) => a === b);
    handlebars.registerHelper('ne', (a, b) => a !== b);
    handlebars.registerHelper('gt', (a, b) => a > b);
    handlebars.registerHelper('lt', (a, b) => a < b);
    handlebars.registerHelper('and', (...args) => {
      const options = args.pop();
      return args.every(Boolean);
    });
    handlebars.registerHelper('or', (...args) => {
      const options = args.pop();
      return args.some(Boolean);
    });
    handlebars.registerHelper('formatNumber', (num: number) => {
      return num.toLocaleString();
    });
    handlebars.registerHelper('formatCurrency', (amount: number, currency: string = 'USD') => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
      }).format(amount);
    });
  }

  /**
   * Load base layout template
   */
  private loadBaseLayout() {
    try {
      const layoutPath = join(__dirname, '../templates/layouts/base.hbs');
      const layoutContent = readFileSync(layoutPath, 'utf-8');
      this.baseLayout = handlebars.compile(layoutContent);
    } catch (error) {
      logger.warn('Base email layout not found, emails will not use layout');
    }
  }

  /**
   * Load and compile email template
   */
  private loadTemplate(templateName: string): handlebars.TemplateDelegate {
    // Check cache first
    if (this.templateCache.has(templateName)) {
      return this.templateCache.get(templateName)!;
    }

    try {
      const templatePath = join(__dirname, `../templates/emails/${templateName}.hbs`);
      const templateContent = readFileSync(templatePath, 'utf-8');
      const compiledTemplate = handlebars.compile(templateContent);

      // Cache the template
      this.templateCache.set(templateName, compiledTemplate);

      return compiledTemplate;
    } catch (error) {
      logger.error(`Failed to load email template: ${templateName}`, error);
      throw new Error(`Email template '${templateName}' not found`);
    }
  }

  /**
   * Render email template with data
   */
  private renderTemplate(templateName: string, data: Record<string, any>): string {
    const template = this.loadTemplate(templateName);
    const body = template(data);

    // Wrap in base layout if available
    if (this.baseLayout) {
      return this.baseLayout({
        body,
        subject: data.subject,
        year: new Date().getFullYear(),
        unsubscribeUrl: data.unsubscribeUrl || `${config.web.url}/unsubscribe`,
        ...data,
      });
    }

    return body;
  }

  /**
   * Log email to database
   */
  private async logEmail(
    options: EmailOptions,
    status: 'pending' | 'sent' | 'failed',
    messageId?: string,
    error?: string
  ): Promise<void> {
    try {
      const toEmail = Array.isArray(options.to) ? options.to[0] : options.to;
      const fromEmail = options.from || config.email.fromEmail || 'noreply@luxai.com';

      await query(
        `INSERT INTO email_logs (
          to_email, from_email, subject, template_name, template_data,
          status, error_message, message_id, user_id, sent_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          toEmail,
          fromEmail,
          options.subject,
          options.template || null,
          options.data ? JSON.stringify(options.data) : null,
          status,
          error || null,
          messageId || null,
          options.userId || null,
          status === 'sent' ? new Date() : null,
        ]
      );
    } catch (error) {
      logger.error('Failed to log email to database', error);
      // Don't throw - logging shouldn't break email sending
    }
  }

  /**
   * Verify SMTP connection
   */
  async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      logger.info('Email service connection verified');
      return true;
    } catch (error) {
      logger.error('Email service connection failed', error);
      return false;
    }
  }

  /**
   * Send email
   */
  async sendEmail(options: EmailOptions): Promise<{ messageId: string }> {
    try {
      // Render template if provided
      let html = options.html;
      let text = options.text;

      if (options.template) {
        const data = {
          ...options.data,
          subject: options.subject,
          baseUrl: config.web.url,
        };
        html = this.renderTemplate(options.template, data);
      }

      // Check if SMTP is configured
      if (!config.email.smtpUser) {
        logger.warn('SMTP not configured, simulating email send', {
          to: options.to,
          subject: options.subject,
          template: options.template,
        });

        // Log to database as sent (for demo/testing)
        const mockMessageId = `mock_${Date.now()}`;
        await this.logEmail(options, 'sent', mockMessageId);

        return { messageId: mockMessageId };
      }

      // Prepare email options
      const mailOptions = {
        from: options.from || `LuxAI Designer <${config.email.fromEmail || 'noreply@luxai.com'}>`,
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        subject: options.subject,
        html,
        text,
        attachments: options.attachments,
      };

      // Log as pending
      await this.logEmail(options, 'pending');

      // Send email
      const info = await this.transporter.sendMail(mailOptions);

      // Log as sent
      await this.logEmail(options, 'sent', info.messageId);

      logger.info('Email sent successfully', {
        to: options.to,
        subject: options.subject,
        messageId: info.messageId,
      });

      return { messageId: info.messageId };
    } catch (error: any) {
      // Log as failed
      await this.logEmail(options, 'failed', undefined, error.message);

      logger.error('Failed to send email', {
        error,
        to: options.to,
        subject: options.subject,
      });

      throw error;
    }
  }

  /**
   * Send welcome email
   */
  async sendWelcomeEmail(
    email: string,
    data: {
      firstName: string;
      dashboardUrl?: string;
    },
    userId?: string
  ): Promise<void> {
    await this.sendEmail({
      to: email,
      subject: `Welcome to LuxAI Designer, ${data.firstName}!`,
      template: 'welcome',
      data: {
        ...data,
        dashboardUrl: data.dashboardUrl || `${config.web.url}/dashboard`,
      },
      userId,
    });
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(
    email: string,
    data: {
      firstName: string;
      resetUrl: string;
    },
    userId?: string
  ): Promise<void> {
    await this.sendEmail({
      to: email,
      subject: 'Reset Your Password - LuxAI Designer',
      template: 'password-reset',
      data,
      userId,
    });
  }

  /**
   * Send itinerary confirmation email
   */
  async sendItineraryConfirmation(
    email: string,
    data: {
      clientName: string;
      itineraryTitle: string;
      startDate: string;
      endDate: string;
      destinations: string;
      duration: number;
      totalBudget: string;
      currency: string;
      itineraryUrl: string;
      designerName: string;
      approvalRequired?: boolean;
      sustainabilityScore?: number;
    },
    userId?: string
  ): Promise<void> {
    await this.sendEmail({
      to: email,
      subject: `Your Itinerary is Ready: ${data.itineraryTitle}`,
      template: 'itinerary-confirmation',
      data,
      userId,
    });
  }

  /**
   * Send approval request email
   */
  async sendApprovalRequest(
    email: string,
    data: {
      approverName: string;
      requesterName: string;
      requestType: string;
      amount: string;
      currency: string;
      submittedAt: string;
      description?: string;
      urgency?: string;
      requiresPrincipalApproval?: boolean;
      approveUrl: string;
      reviewUrl: string;
      dashboardUrl?: string;
    },
    userId?: string
  ): Promise<void> {
    await this.sendEmail({
      to: email,
      subject: `Approval Required: ${data.requestType}`,
      template: 'approval-request',
      data: {
        ...data,
        dashboardUrl: data.dashboardUrl || `${config.web.url}/approvals`,
      },
      userId,
    });
  }

  /**
   * Send booking confirmation email
   */
  async sendBookingConfirmation(
    email: string,
    data: {
      clientName: string;
      bookingTitle: string;
      confirmationNumber: string;
      bookingType: string;
      bookingDateTime: string;
      location?: string;
      totalAmount: string;
      currency: string;
      nextSteps?: string[];
      importantInfo?: string;
      bookingDetailsUrl: string;
      addToCalendarUrl?: string;
      designerEmail?: string;
    },
    userId?: string
  ): Promise<void> {
    await this.sendEmail({
      to: email,
      subject: `Booking Confirmed - ${data.confirmationNumber}`,
      template: 'booking-confirmation',
      data,
      userId,
    });
  }

  /**
   * Get email logs for a user
   */
  async getEmailLogs(userId: string, limit: number = 50): Promise<EmailLog[]> {
    const result = await query(
      `SELECT * FROM email_logs
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit]
    );

    return result.rows;
  }

  /**
   * Get email statistics
   */
  async getEmailStats(startDate?: Date, endDate?: Date): Promise<{
    total: number;
    sent: number;
    failed: number;
    pending: number;
  }> {
    let whereClause = '';
    const params: any[] = [];

    if (startDate && endDate) {
      whereClause = 'WHERE created_at BETWEEN $1 AND $2';
      params.push(startDate, endDate);
    }

    const result = await query(
      `SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'sent') as sent,
        COUNT(*) FILTER (WHERE status = 'failed') as failed,
        COUNT(*) FILTER (WHERE status = 'pending') as pending
       FROM email_logs ${whereClause}`,
      params
    );

    return {
      total: parseInt(result.rows[0].total),
      sent: parseInt(result.rows[0].sent),
      failed: parseInt(result.rows[0].failed),
      pending: parseInt(result.rows[0].pending),
    };
  }
}

export const emailService = new EmailService();
