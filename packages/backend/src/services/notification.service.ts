import { query } from '../db';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { emailService } from './email.service';
import webpush from 'web-push';
import { config } from '../config';

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  action_url?: string;
  action_text?: string;
  metadata?: any;
  is_read: boolean;
  is_archived: boolean;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  created_at: Date;
  read_at?: Date;
  archived_at?: Date;
}

export interface NotificationPreferences {
  email_enabled: boolean;
  push_enabled: boolean;
  in_app_enabled: boolean;
  email_bookings: boolean;
  email_approvals: boolean;
  email_payments: boolean;
  email_messages: boolean;
  email_marketing: boolean;
  email_system: boolean;
  push_bookings: boolean;
  push_approvals: boolean;
  push_payments: boolean;
  push_messages: boolean;
  push_system: boolean;
  email_digest: boolean;
  email_digest_frequency: 'realtime' | 'daily' | 'weekly';
  quiet_hours_enabled: boolean;
  quiet_hours_start?: string;
  quiet_hours_end?: string;
  timezone: string;
}

export interface CreateNotificationData {
  user_id: string;
  type: string;
  title: string;
  message: string;
  action_url?: string;
  action_text?: string;
  metadata?: any;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
}

export class NotificationService {
  constructor() {
    // Configure web push (if VAPID keys are available)
    if (config.webPush?.publicKey && config.webPush?.privateKey) {
      webpush.setVapidDetails(
        'mailto:support@luxai.com',
        config.webPush.publicKey,
        config.webPush.privateKey
      );
    }
  }

  /**
   * Create and send a notification through all enabled channels
   */
  async send(data: CreateNotificationData): Promise<Notification> {
    try {
      // Create in-app notification
      const notification = await this.createInAppNotification(data);

      // Get user preferences
      const preferences = await this.getPreferences(data.user_id);

      // Send through enabled channels
      const sendPromises: Promise<any>[] = [];

      if (preferences.in_app_enabled) {
        // Already created above
      }

      if (preferences.email_enabled && this.shouldSendEmailForType(data.type, preferences)) {
        sendPromises.push(this.sendEmailNotification(notification, preferences));
      }

      if (preferences.push_enabled && this.shouldSendPushForType(data.type, preferences)) {
        sendPromises.push(this.sendPushNotification(notification));
      }

      // Send all in parallel
      await Promise.allSettled(sendPromises);

      logger.info('Notification sent', {
        notificationId: notification.id,
        userId: data.user_id,
        type: data.type,
      });

      return notification;
    } catch (error) {
      logger.error('Failed to send notification', { error, data });
      throw error;
    }
  }

  /**
   * Create in-app notification
   */
  async createInAppNotification(data: CreateNotificationData): Promise<Notification> {
    try {
      const result = await query(
        `INSERT INTO notifications (user_id, type, title, message, action_url, action_text, metadata, priority)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          data.user_id,
          data.type,
          data.title,
          data.message,
          data.action_url,
          data.action_text,
          JSON.stringify(data.metadata || {}),
          data.priority || 'normal',
        ]
      );

      await this.logNotification(result.rows[0].id, data.user_id, 'in_app', 'sent');

      return result.rows[0];
    } catch (error) {
      logger.error('Failed to create in-app notification', { error, data });
      throw error;
    }
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(
    notification: Notification,
    preferences: NotificationPreferences
  ): Promise<void> {
    try {
      // Skip if in quiet hours
      if (this.isQuietHours(preferences)) {
        logger.info('Skipping email due to quiet hours', { notificationId: notification.id });
        return;
      }

      // Get user email
      const userResult = await query('SELECT email FROM users WHERE id = $1', [notification.user_id]);
      if (userResult.rows.length === 0) {
        throw new Error('User not found');
      }

      const userEmail = userResult.rows[0].email;

      // Send email
      await emailService.sendEmail({
        to: userEmail,
        subject: notification.title,
        html: `
          <h2>${notification.title}</h2>
          <p>${notification.message}</p>
          ${notification.action_url ? `<a href="${notification.action_url}" style="background: #D4AF37; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin-top: 16px;">${notification.action_text || 'View'}</a>` : ''}
        `,
        text: `${notification.title}\n\n${notification.message}\n\n${notification.action_url ? `${notification.action_text || 'View'}: ${notification.action_url}` : ''}`,
      });

      await this.logNotification(notification.id, notification.user_id, 'email', 'sent');
    } catch (error: any) {
      logger.error('Failed to send email notification', {
        error: error.message,
        notificationId: notification.id,
      });
      await this.logNotification(notification.id, notification.user_id, 'email', 'failed', error.message);
    }
  }

  /**
   * Send push notification
   */
  private async sendPushNotification(notification: Notification): Promise<void> {
    try {
      // Get active push subscriptions for user
      const result = await query(
        'SELECT * FROM push_subscriptions WHERE user_id = $1 AND is_active = true',
        [notification.user_id]
      );

      const subscriptions = result.rows;

      if (subscriptions.length === 0) {
        logger.info('No active push subscriptions', { userId: notification.user_id });
        return;
      }

      // Send to all subscriptions
      const pushPromises = subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            sub.subscription_data,
            JSON.stringify({
              title: notification.title,
              body: notification.message,
              icon: '/icon.png',
              badge: '/badge.png',
              data: {
                url: notification.action_url,
                notificationId: notification.id,
              },
            })
          );

          // Update last_used_at
          await query(
            'UPDATE push_subscriptions SET last_used_at = NOW() WHERE id = $1',
            [sub.id]
          );

          await this.logNotification(notification.id, notification.user_id, 'push', 'sent');
        } catch (error: any) {
          logger.error('Failed to send push to subscription', {
            error: error.message,
            subscriptionId: sub.id,
          });

          // Deactivate subscription if it's invalid
          if (error.statusCode === 410) {
            await query('UPDATE push_subscriptions SET is_active = false WHERE id = $1', [sub.id]);
          }

          await this.logNotification(notification.id, notification.user_id, 'push', 'failed', error.message);
        }
      });

      await Promise.allSettled(pushPromises);
    } catch (error: any) {
      logger.error('Failed to send push notifications', { error: error.message });
    }
  }

  /**
   * Get user notifications
   */
  async getUserNotifications(
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      unreadOnly?: boolean;
      type?: string;
    } = {}
  ): Promise<{ notifications: Notification[]; total: number }> {
    try {
      const { limit = 50, offset = 0, unreadOnly = false, type } = options;

      let whereClause = 'WHERE user_id = $1 AND is_archived = false';
      const params: any[] = [userId];
      let paramIndex = 2;

      if (unreadOnly) {
        whereClause += ' AND is_read = false';
      }

      if (type) {
        whereClause += ` AND type = $${paramIndex++}`;
        params.push(type);
      }

      // Get notifications
      const result = await query(
        `SELECT * FROM notifications
         ${whereClause}
         ORDER BY created_at DESC
         LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
        [...params, limit, offset]
      );

      // Get total count
      const countResult = await query(
        `SELECT COUNT(*) as total FROM notifications ${whereClause}`,
        params
      );

      return {
        notifications: result.rows,
        total: parseInt(countResult.rows[0].total),
      };
    } catch (error) {
      logger.error('Failed to get user notifications', { error, userId });
      throw error;
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string, userId: string): Promise<void> {
    try {
      await query(
        'UPDATE notifications SET is_read = true, read_at = NOW() WHERE id = $1 AND user_id = $2',
        [notificationId, userId]
      );
    } catch (error) {
      logger.error('Failed to mark notification as read', { error, notificationId, userId });
      throw error;
    }
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(userId: string): Promise<void> {
    try {
      await query(
        'UPDATE notifications SET is_read = true, read_at = NOW() WHERE user_id = $1 AND is_read = false',
        [userId]
      );
    } catch (error) {
      logger.error('Failed to mark all notifications as read', { error, userId });
      throw error;
    }
  }

  /**
   * Archive notification
   */
  async archive(notificationId: string, userId: string): Promise<void> {
    try {
      await query(
        'UPDATE notifications SET is_archived = true, archived_at = NOW() WHERE id = $1 AND user_id = $2',
        [notificationId, userId]
      );
    } catch (error) {
      logger.error('Failed to archive notification', { error, notificationId, userId });
      throw error;
    }
  }

  /**
   * Delete notification
   */
  async delete(notificationId: string, userId: string): Promise<void> {
    try {
      await query('DELETE FROM notifications WHERE id = $1 AND user_id = $2', [notificationId, userId]);
    } catch (error) {
      logger.error('Failed to delete notification', { error, notificationId, userId });
      throw error;
    }
  }

  /**
   * Get unread count
   */
  async getUnreadCount(userId: string): Promise<number> {
    try {
      const result = await query(
        'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = false AND is_archived = false',
        [userId]
      );
      return parseInt(result.rows[0].count);
    } catch (error) {
      logger.error('Failed to get unread count', { error, userId });
      throw error;
    }
  }

  /**
   * Get or create user preferences
   */
  async getPreferences(userId: string): Promise<NotificationPreferences> {
    try {
      let result = await query('SELECT * FROM notification_preferences WHERE user_id = $1', [userId]);

      if (result.rows.length === 0) {
        // Create default preferences
        result = await query(
          'INSERT INTO notification_preferences (user_id) VALUES ($1) RETURNING *',
          [userId]
        );
      }

      return result.rows[0];
    } catch (error) {
      logger.error('Failed to get notification preferences', { error, userId });
      throw error;
    }
  }

  /**
   * Update user preferences
   */
  async updatePreferences(userId: string, preferences: Partial<NotificationPreferences>): Promise<void> {
    try {
      const updates: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      Object.entries(preferences).forEach(([key, value]) => {
        if (value !== undefined) {
          updates.push(`${key} = $${paramIndex++}`);
          params.push(value);
        }
      });

      if (updates.length === 0) {
        return;
      }

      params.push(userId);

      await query(
        `UPDATE notification_preferences
         SET ${updates.join(', ')}, updated_at = NOW()
         WHERE user_id = $${paramIndex}`,
        params
      );
    } catch (error) {
      logger.error('Failed to update notification preferences', { error, userId });
      throw error;
    }
  }

  /**
   * Subscribe to push notifications
   */
  async subscribePush(userId: string, subscription: any, deviceName?: string): Promise<void> {
    try {
      await query(
        `INSERT INTO push_subscriptions (user_id, subscription_data, device_name, user_agent)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, subscription_data) DO UPDATE SET is_active = true, last_used_at = NOW()`,
        [userId, JSON.stringify(subscription), deviceName, subscription.userAgent]
      );
    } catch (error) {
      logger.error('Failed to subscribe to push notifications', { error, userId });
      throw error;
    }
  }

  /**
   * Unsubscribe from push notifications
   */
  async unsubscribePush(userId: string, subscriptionId: string): Promise<void> {
    try {
      await query(
        'UPDATE push_subscriptions SET is_active = false WHERE id = $1 AND user_id = $2',
        [subscriptionId, userId]
      );
    } catch (error) {
      logger.error('Failed to unsubscribe from push notifications', { error, userId });
      throw error;
    }
  }

  /**
   * Helper: Check if should send email for notification type
   */
  private shouldSendEmailForType(type: string, preferences: NotificationPreferences): boolean {
    const typeMap: Record<string, boolean> = {
      booking: preferences.email_bookings,
      approval: preferences.email_approvals,
      payment: preferences.email_payments,
      message: preferences.email_messages,
      system: preferences.email_system,
    };

    return typeMap[type] ?? true; // Default to true for unknown types
  }

  /**
   * Helper: Check if should send push for notification type
   */
  private shouldSendPushForType(type: string, preferences: NotificationPreferences): boolean {
    const typeMap: Record<string, boolean> = {
      booking: preferences.push_bookings,
      approval: preferences.push_approvals,
      payment: preferences.push_payments,
      message: preferences.push_messages,
      system: preferences.push_system,
    };

    return typeMap[type] ?? true;
  }

  /**
   * Helper: Check if currently in quiet hours
   */
  private isQuietHours(preferences: NotificationPreferences): boolean {
    if (!preferences.quiet_hours_enabled || !preferences.quiet_hours_start || !preferences.quiet_hours_end) {
      return false;
    }

    try {
      // Get current time in user's timezone
      const userTimezone = (preferences as any).timezone || 'UTC';
      const now = new Date();

      // Extract hour and minute from current time in user's timezone
      const currentHour = parseInt(now.toLocaleString('en-US', { hour: '2-digit', hour12: false, timeZone: userTimezone }));
      const currentMinute = parseInt(now.toLocaleString('en-US', { minute: '2-digit', timeZone: userTimezone }));
      const currentTimeInMinutes = currentHour * 60 + currentMinute;

      // Parse quiet hours start and end (format: "HH:MM:SS" or "HH:MM")
      const startParts = preferences.quiet_hours_start.split(':');
      const startHour = parseInt(startParts[0]);
      const startMinute = parseInt(startParts[1] || '0');
      const startTimeInMinutes = startHour * 60 + startMinute;

      const endParts = preferences.quiet_hours_end.split(':');
      const endHour = parseInt(endParts[0]);
      const endMinute = parseInt(endParts[1] || '0');
      const endTimeInMinutes = endHour * 60 + endMinute;

      // Check if current time is within quiet hours
      // Handle case where quiet hours span midnight (e.g., 22:00 to 06:00)
      if (startTimeInMinutes <= endTimeInMinutes) {
        // Normal case: quiet hours within same day (e.g., 14:00 to 18:00)
        return currentTimeInMinutes >= startTimeInMinutes && currentTimeInMinutes < endTimeInMinutes;
      } else {
        // Spanning midnight: quiet hours cross day boundary (e.g., 22:00 to 06:00)
        return currentTimeInMinutes >= startTimeInMinutes || currentTimeInMinutes < endTimeInMinutes;
      }
    } catch (error: any) {
      logger.error('Failed to check quiet hours', { error: error.message });
      // If there's an error, don't block notifications
      return false;
    }
  }

  /**
   * Helper: Log notification delivery
   */
  private async logNotification(
    notificationId: string,
    userId: string,
    channel: string,
    status: string,
    errorMessage?: string
  ): Promise<void> {
    try {
      await query(
        `INSERT INTO notification_logs (notification_id, user_id, channel, status, error_message)
         VALUES ($1, $2, $3, $4, $5)`,
        [notificationId, userId, channel, status, errorMessage || null]
      );
    } catch (error) {
      logger.error('Failed to log notification', { error });
    }
  }
}

export const notificationService = new NotificationService();
