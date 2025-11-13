import { query } from '../db';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';
import axios from 'axios';
import { config } from '../config';

export enum LiveUpdateType {
  FLIGHT_STATUS = 'flight_status',
  DELAY_ALERT = 'delay_alert',
  REBOOK_SUGGESTION = 'rebook_suggestion',
  ARRIVAL_COUNTDOWN = 'arrival_countdown',
  SERVICE_REMINDER = 'service_reminder',
  DISRUPTION = 'disruption',
  MILESTONE = 'milestone',
  SUSTAINABILITY = 'sustainability'
}

export enum LiveUpdatePriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface CreateLiveUpdateRequest {
  itineraryId: string;
  clientId: string;
  type: LiveUpdateType;
  title: string;
  message: string;
  priority: LiveUpdatePriority;
  startTime: Date;
  endTime?: Date;
  metadata?: Record<string, any>;
}

export interface PushNotificationPayload {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  priority: 'low' | 'normal' | 'high';
}

/**
 * Live Updates Service
 * Manages real-time updates for iOS ActivityKit and Android Live Updates
 */
export class LiveUpdatesService {
  /**
   * Create a live update
   */
  async createLiveUpdate(
    request: CreateLiveUpdateRequest
  ): Promise<{ liveUpdateId: string }> {
    try {
      const result = await query(
        `INSERT INTO live_update_activities (
          itinerary_id, client_id, type, title, message, priority,
          start_time, end_time, metadata, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id`,
        [
          request.itineraryId,
          request.clientId,
          request.type,
          request.title,
          request.message,
          request.priority,
          request.startTime,
          request.endTime || null,
          JSON.stringify(request.metadata || {}),
          'active',
        ]
      );

      const liveUpdateId = result.rows[0].id;

      // Send push notification
      await this.sendPushNotification({
        userId: request.clientId,
        title: request.title,
        body: request.message,
        data: {
          liveUpdateId,
          itineraryId: request.itineraryId,
          type: request.type,
        },
        priority: this.mapPriorityToPush(request.priority),
      });

      // For iOS, start ActivityKit Live Activity
      await this.startIOSLiveActivity(liveUpdateId, request);

      // For Android, create persistent notification
      await this.startAndroidLiveUpdate(liveUpdateId, request);

      logger.info('Live update created', { liveUpdateId, type: request.type });

      return { liveUpdateId };
    } catch (error: any) {
      logger.error('Failed to create live update', { error, request });
      throw new AppError(500, 'LIVE_UPDATE_FAILED', 'Failed to create live update');
    }
  }

  /**
   * Update existing live activity
   */
  async updateLiveActivity(
    liveUpdateId: string,
    updates: {
      message?: string;
      metadata?: Record<string, any>;
      priority?: LiveUpdatePriority;
    }
  ): Promise<void> {
    try {
      const updateFields: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      if (updates.message) {
        updateFields.push(`message = $${paramCount++}`);
        values.push(updates.message);
      }

      if (updates.metadata) {
        updateFields.push(`metadata = $${paramCount++}`);
        values.push(JSON.stringify(updates.metadata));
      }

      if (updates.priority) {
        updateFields.push(`priority = $${paramCount++}`);
        values.push(updates.priority);
      }

      if (updateFields.length === 0) {
        return;
      }

      updateFields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(liveUpdateId);

      await query(
        `UPDATE live_update_activities
         SET ${updateFields.join(', ')}
         WHERE id = $${paramCount}`,
        values
      );

      // Get updated activity
      const result = await query(
        'SELECT * FROM live_update_activities WHERE id = $1',
        [liveUpdateId]
      );

      if (result.rows.length > 0) {
        const activity = result.rows[0];

        // Update iOS Live Activity
        await this.updateIOSLiveActivity(liveUpdateId, updates);

        // Update Android notification
        await this.updateAndroidLiveUpdate(liveUpdateId, updates);

        // Send push notification for critical updates
        if (updates.priority === LiveUpdatePriority.CRITICAL) {
          await this.sendPushNotification({
            userId: activity.client_id,
            title: activity.title,
            body: updates.message || activity.message,
            data: { liveUpdateId },
            priority: 'high',
          });
        }
      }

      logger.info('Live activity updated', { liveUpdateId });
    } catch (error: any) {
      logger.error('Failed to update live activity', { error, liveUpdateId });
      throw new AppError(500, 'LIVE_UPDATE_FAILED', 'Failed to update live activity');
    }
  }

  /**
   * End live activity
   */
  async endLiveActivity(liveUpdateId: string): Promise<void> {
    try {
      await query(
        `UPDATE live_update_activities
         SET status = $1, end_time = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        ['completed', liveUpdateId]
      );

      // End iOS Live Activity
      await this.endIOSLiveActivity(liveUpdateId);

      // Dismiss Android notification
      await this.endAndroidLiveUpdate(liveUpdateId);

      logger.info('Live activity ended', { liveUpdateId });
    } catch (error: any) {
      logger.error('Failed to end live activity', { error, liveUpdateId });
      throw new AppError(500, 'LIVE_ACTIVITY_END_FAILED', 'Failed to end live activity');
    }
  }

  /**
   * Get active live updates for itinerary
   */
  async getActiveLiveUpdates(itineraryId: string): Promise<any[]> {
    try {
      const result = await query(
        `SELECT * FROM live_update_activities
         WHERE itinerary_id = $1 AND status = 'active'
         ORDER BY priority DESC, created_at DESC`,
        [itineraryId]
      );

      return result.rows;
    } catch (error: any) {
      logger.error('Failed to get active live updates', { error, itineraryId });
      throw new AppError(
        500,
        'LIVE_UPDATES_FETCH_FAILED',
        'Failed to fetch active live updates'
      );
    }
  }

  /**
   * Monitor flight status and create updates
   */
  async monitorFlightStatus(
    transportationId: string,
    flightNumber: string
  ): Promise<void> {
    try {
      // In production, integrate with real-time flight tracking API
      // (e.g., FlightAware, FlightStats, Aviation Edge)

      logger.info('Monitoring flight status', { transportationId, flightNumber });

      // Mock flight status check
      const flightStatus = await this.checkFlightStatus(flightNumber);

      if (flightStatus.delayed) {
        // Create delay alert
        const transportation = await query(
          `SELECT t.*, i.client_id, i.id as itinerary_id
           FROM transportation t
           JOIN itineraries i ON i.id = t.itinerary_id
           WHERE t.id = $1`,
          [transportationId]
        );

        if (transportation.rows.length > 0) {
          const data = transportation.rows[0];

          await this.createLiveUpdate({
            itineraryId: data.itinerary_id,
            clientId: data.client_id,
            type: LiveUpdateType.DELAY_ALERT,
            title: `Flight ${flightNumber} Delayed`,
            message: `Your flight has been delayed by ${flightStatus.delayMinutes} minutes. New departure time: ${flightStatus.newDepartureTime}`,
            priority: flightStatus.delayMinutes > 60
              ? LiveUpdatePriority.HIGH
              : LiveUpdatePriority.MEDIUM,
            startTime: new Date(),
            metadata: {
              flightNumber,
              delayMinutes: flightStatus.delayMinutes,
              originalDepartureTime: flightStatus.originalDepartureTime,
              newDepartureTime: flightStatus.newDepartureTime,
            },
          });
        }
      }
    } catch (error: any) {
      logger.error('Failed to monitor flight status', { error, transportationId });
    }
  }

  /**
   * Send push notification
   */
  private async sendPushNotification(payload: PushNotificationPayload): Promise<void> {
    try {
      if (!config.push.oneSignalApiKey) {
        logger.warn('Push notifications not configured', payload);
        return;
      }

      // OneSignal integration
      await axios.post(
        'https://onesignal.com/api/v1/notifications',
        {
          app_id: config.push.oneSignalApiKey,
          include_external_user_ids: [payload.userId],
          headings: { en: payload.title },
          contents: { en: payload.body },
          data: payload.data,
          priority: payload.priority === 'high' ? 10 : 5,
          ios_badgeType: 'Increase',
          ios_badgeCount: 1,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      logger.info('Push notification sent', { userId: payload.userId });
    } catch (error: any) {
      logger.error('Failed to send push notification', { error, payload });
    }
  }

  /**
   * Start iOS Live Activity
   */
  private async startIOSLiveActivity(
    liveUpdateId: string,
    request: CreateLiveUpdateRequest
  ): Promise<void> {
    // iOS ActivityKit integration
    // In production, use APNs with activity push type
    logger.info('Starting iOS Live Activity', { liveUpdateId, type: request.type });

    // Send to APNs with activity notification
    // Payload format for ActivityKit:
    // {
    //   "aps": {
    //     "timestamp": <unix-timestamp>,
    //     "event": "start",
    //     "content-state": {
    //       "title": request.title,
    //       "message": request.message,
    //       "priority": request.priority
    //     }
    //   }
    // }
  }

  /**
   * Update iOS Live Activity
   */
  private async updateIOSLiveActivity(
    liveUpdateId: string,
    updates: any
  ): Promise<void> {
    logger.info('Updating iOS Live Activity', { liveUpdateId });

    // Send update to APNs with "update" event
  }

  /**
   * End iOS Live Activity
   */
  private async endIOSLiveActivity(liveUpdateId: string): Promise<void> {
    logger.info('Ending iOS Live Activity', { liveUpdateId });

    // Send to APNs with "end" event
  }

  /**
   * Start Android Live Update
   */
  private async startAndroidLiveUpdate(
    liveUpdateId: string,
    request: CreateLiveUpdateRequest
  ): Promise<void> {
    // Android persistent notification
    logger.info('Starting Android Live Update', { liveUpdateId, type: request.type });

    // Use Firebase Cloud Messaging with custom notification
  }

  /**
   * Update Android Live Update
   */
  private async updateAndroidLiveUpdate(
    liveUpdateId: string,
    updates: any
  ): Promise<void> {
    logger.info('Updating Android Live Update', { liveUpdateId });

    // Update persistent notification via FCM
  }

  /**
   * End Android Live Update
   */
  private async endAndroidLiveUpdate(liveUpdateId: string): Promise<void> {
    logger.info('Ending Android Live Update', { liveUpdateId });

    // Dismiss notification via FCM
  }

  /**
   * Check flight status (mock implementation)
   */
  private async checkFlightStatus(flightNumber: string): Promise<any> {
    // In production, integrate with real-time flight API
    return {
      delayed: false,
      delayMinutes: 0,
      originalDepartureTime: new Date(),
      newDepartureTime: new Date(),
    };
  }

  /**
   * Map priority to push notification priority
   */
  private mapPriorityToPush(
    priority: LiveUpdatePriority
  ): 'low' | 'normal' | 'high' {
    switch (priority) {
      case LiveUpdatePriority.CRITICAL:
      case LiveUpdatePriority.HIGH:
        return 'high';
      case LiveUpdatePriority.MEDIUM:
        return 'normal';
      case LiveUpdatePriority.LOW:
        return 'low';
    }
  }
}

export const liveUpdatesService = new LiveUpdatesService();
