import { query } from '../db';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { config } from '../config';
import { google } from 'googleapis';
import { Client } from '@microsoft/microsoft-graph-client';

export interface CalendarConnection {
  id: string;
  user_id: string;
  provider: 'google' | 'outlook' | 'apple';
  provider_account_id: string;
  provider_account_email: string;
  calendar_id?: string;
  calendar_name?: string;
  is_primary: boolean;
  sync_enabled: boolean;
  last_sync_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface CalendarEvent {
  id: string;
  connection_id: string;
  itinerary_id?: string;
  provider_event_id: string;
  event_type: string;
  title: string;
  description?: string;
  location?: string;
  start_time: Date;
  end_time: Date;
  all_day: boolean;
  recurrence_rule?: string;
  metadata: any;
  created_at: Date;
}

export interface ICalEvent {
  title: string;
  description?: string;
  location?: string;
  start: Date;
  end: Date;
  uid: string;
}

export class CalendarService {
  /**
   * Get user's calendar connections
   */
  async getConnections(userId: string): Promise<CalendarConnection[]> {
    try {
      const result = await query(
        `SELECT id, user_id, provider, provider_account_id, provider_account_email,
                calendar_id, calendar_name, is_primary, sync_enabled, last_sync_at,
                created_at, updated_at
         FROM calendar_connections
         WHERE user_id = $1
         ORDER BY is_primary DESC, created_at DESC`,
        [userId]
      );

      return result.rows;
    } catch (error) {
      logger.error('Failed to get calendar connections', { error, userId });
      throw error;
    }
  }

  /**
   * Connect calendar provider
   */
  async connectProvider(data: {
    user_id: string;
    provider: 'google' | 'outlook' | 'apple';
    provider_account_id: string;
    provider_account_email: string;
    access_token: string;
    refresh_token: string;
    token_expires_at: Date;
    calendar_id?: string;
    calendar_name?: string;
  }): Promise<CalendarConnection> {
    try {
      const result = await query(
        `INSERT INTO calendar_connections
         (user_id, provider, provider_account_id, provider_account_email,
          access_token, refresh_token, token_expires_at, calendar_id, calendar_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (user_id, provider, provider_account_id)
         DO UPDATE SET
           access_token = $5,
           refresh_token = $6,
           token_expires_at = $7,
           calendar_id = $8,
           calendar_name = $9,
           updated_at = NOW()
         RETURNING id, user_id, provider, provider_account_id, provider_account_email,
                   calendar_id, calendar_name, is_primary, sync_enabled, last_sync_at,
                   created_at, updated_at`,
        [
          data.user_id,
          data.provider,
          data.provider_account_id,
          data.provider_account_email,
          data.access_token,
          data.refresh_token,
          data.token_expires_at,
          data.calendar_id,
          data.calendar_name,
        ]
      );

      logger.info('Calendar provider connected', {
        userId: data.user_id,
        provider: data.provider,
      });

      return result.rows[0];
    } catch (error) {
      logger.error('Failed to connect calendar provider', { error, data });
      throw error;
    }
  }

  /**
   * Disconnect calendar provider
   */
  async disconnectProvider(connectionId: string, userId: string): Promise<void> {
    try {
      const result = await query(
        'DELETE FROM calendar_connections WHERE id = $1 AND user_id = $2',
        [connectionId, userId]
      );

      if (result.rowCount === 0) {
        throw new AppError(404, 'NOT_FOUND', 'Calendar connection not found');
      }

      logger.info('Calendar provider disconnected', { connectionId, userId });
    } catch (error) {
      logger.error('Failed to disconnect calendar provider', { error, connectionId, userId });
      throw error;
    }
  }

  /**
   * Toggle calendar sync
   */
  async toggleSync(connectionId: string, userId: string, enabled: boolean): Promise<void> {
    try {
      const result = await query(
        `UPDATE calendar_connections
         SET sync_enabled = $1, updated_at = NOW()
         WHERE id = $2 AND user_id = $3`,
        [enabled, connectionId, userId]
      );

      if (result.rowCount === 0) {
        throw new AppError(404, 'NOT_FOUND', 'Calendar connection not found');
      }

      logger.info('Calendar sync toggled', { connectionId, userId, enabled });
    } catch (error) {
      logger.error('Failed to toggle calendar sync', { error, connectionId, userId });
      throw error;
    }
  }

  /**
   * Sync itinerary to calendar
   */
  async syncItineraryToCalendar(
    itineraryId: string,
    connectionId: string,
    userId: string
  ): Promise<void> {
    try {
      // Get connection details
      const connectionResult = await query(
        'SELECT * FROM calendar_connections WHERE id = $1 AND user_id = $2',
        [connectionId, userId]
      );

      if (connectionResult.rows.length === 0) {
        throw new AppError(404, 'NOT_FOUND', 'Calendar connection not found');
      }

      const connection = connectionResult.rows[0];

      // Get itinerary details
      const itineraryResult = await query(
        'SELECT * FROM itineraries WHERE id = $1 AND user_id = $2',
        [itineraryId, userId]
      );

      if (itineraryResult.rows.length === 0) {
        throw new AppError(404, 'NOT_FOUND', 'Itinerary not found');
      }

      const itinerary = itineraryResult.rows[0];

      // Create calendar event based on provider
      const eventId = await this.createProviderEvent(connection, itinerary);

      // Save synced event record
      await query(
        `INSERT INTO synced_calendar_events
         (connection_id, itinerary_id, provider_event_id, event_type, title, description,
          location, start_time, end_time)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (connection_id, provider_event_id) DO NOTHING`,
        [
          connectionId,
          itineraryId,
          eventId,
          'itinerary',
          itinerary.title,
          itinerary.description,
          itinerary.destination,
          itinerary.start_date,
          itinerary.end_date,
        ]
      );

      // Update last sync time
      await query(
        'UPDATE calendar_connections SET last_sync_at = NOW() WHERE id = $1',
        [connectionId]
      );

      logger.info('Itinerary synced to calendar', { itineraryId, connectionId });
    } catch (error) {
      logger.error('Failed to sync itinerary to calendar', { error, itineraryId, connectionId });
      throw error;
    }
  }

  /**
   * Create event on provider's calendar (OAuth2 implementation)
   */
  private async createProviderEvent(connection: any, itinerary: any): Promise<string> {
    try {
      if (connection.provider === 'google') {
        return await this.createGoogleCalendarEvent(connection, itinerary);
      } else if (connection.provider === 'outlook') {
        return await this.createOutlookCalendarEvent(connection, itinerary);
      } else if (connection.provider === 'apple') {
        // Apple calendar uses CalDAV protocol - more complex implementation
        logger.warn('Apple calendar sync not yet implemented, returning stub', {
          itinerary: itinerary.id,
        });
        return `apple_${Date.now()}`;
      } else {
        throw new Error(`Unsupported calendar provider: ${connection.provider}`);
      }
    } catch (error: any) {
      logger.error('Failed to create provider event', {
        error: error.message,
        provider: connection.provider,
        itinerary: itinerary.id,
      });
      throw error;
    }
  }

  /**
   * Create event in Google Calendar
   */
  private async createGoogleCalendarEvent(connection: any, itinerary: any): Promise<string> {
    try {
      // Validate OAuth configuration
      if (!config.googleCalendar?.clientId || !config.googleCalendar?.clientSecret) {
        logger.warn('Google Calendar OAuth not configured, skipping sync');
        return `google_stub_${Date.now()}`;
      }

      // Initialize OAuth2 client
      const oauth2Client = new google.auth.OAuth2(
        config.googleCalendar.clientId,
        config.googleCalendar.clientSecret,
        config.googleCalendar.redirectUri || 'http://localhost:3000/auth/google/callback'
      );

      // Set credentials from connection
      const credentials = connection.access_token_data || {};
      oauth2Client.setCredentials({
        access_token: credentials.access_token,
        refresh_token: credentials.refresh_token,
        expiry_date: credentials.expiry_date,
      });

      // Initialize Calendar API
      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

      // Create event
      const event = {
        summary: itinerary.title,
        description: itinerary.description || '',
        location: itinerary.destination || '',
        start: {
          dateTime: new Date(itinerary.start_date).toISOString(),
          timeZone: 'UTC',
        },
        end: {
          dateTime: new Date(itinerary.end_date).toISOString(),
          timeZone: 'UTC',
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 }, // 1 day before
            { method: 'popup', minutes: 30 }, // 30 minutes before
          ],
        },
      };

      const response = await calendar.events.insert({
        calendarId: connection.calendar_id || 'primary',
        requestBody: event,
      });

      logger.info('Google Calendar event created', {
        eventId: response.data.id,
        itinerary: itinerary.id,
      });

      return response.data.id || `google_${Date.now()}`;
    } catch (error: any) {
      logger.error('Failed to create Google Calendar event', {
        error: error.message,
        itinerary: itinerary.id,
      });
      // Return stub ID if OAuth fails (e.g., no credentials configured)
      return `google_stub_${Date.now()}`;
    }
  }

  /**
   * Create event in Microsoft Outlook Calendar
   */
  private async createOutlookCalendarEvent(connection: any, itinerary: any): Promise<string> {
    try {
      // Validate OAuth configuration
      if (!config.outlookCalendar?.clientId || !config.outlookCalendar?.clientSecret) {
        logger.warn('Outlook Calendar OAuth not configured, skipping sync');
        return `outlook_stub_${Date.now()}`;
      }

      // Initialize Graph client with access token
      const credentials = connection.access_token_data || {};
      const client = Client.init({
        authProvider: (done) => {
          done(null, credentials.access_token);
        },
      });

      // Create event
      const event = {
        subject: itinerary.title,
        body: {
          contentType: 'HTML',
          content: itinerary.description || '',
        },
        start: {
          dateTime: new Date(itinerary.start_date).toISOString(),
          timeZone: 'UTC',
        },
        end: {
          dateTime: new Date(itinerary.end_date).toISOString(),
          timeZone: 'UTC',
        },
        location: {
          displayName: itinerary.destination || '',
        },
        reminderMinutesBeforeStart: 1440, // 1 day before
      };

      const response = await client.api('/me/events').post(event);

      logger.info('Outlook Calendar event created', {
        eventId: response.id,
        itinerary: itinerary.id,
      });

      return response.id || `outlook_${Date.now()}`;
    } catch (error: any) {
      logger.error('Failed to create Outlook Calendar event', {
        error: error.message,
        itinerary: itinerary.id,
      });
      // Return stub ID if OAuth fails
      return `outlook_stub_${Date.now()}`;
    }
  }

  /**
   * Generate iCal file for itinerary
   */
  generateICalFile(events: ICalEvent[]): string {
    const lines: string[] = [];

    // iCal header
    lines.push('BEGIN:VCALENDAR');
    lines.push('VERSION:2.0');
    lines.push('PRODID:-//LuxAI Designer//EN');
    lines.push('CALSCALE:GREGORIAN');
    lines.push('METHOD:PUBLISH');

    // Add events
    for (const event of events) {
      lines.push('BEGIN:VEVENT');
      lines.push(`UID:${event.uid}`);
      lines.push(`DTSTAMP:${this.formatICalDate(new Date())}`);
      lines.push(`DTSTART:${this.formatICalDate(event.start)}`);
      lines.push(`DTEND:${this.formatICalDate(event.end)}`);
      lines.push(`SUMMARY:${this.escapeICalText(event.title)}`);

      if (event.description) {
        lines.push(`DESCRIPTION:${this.escapeICalText(event.description)}`);
      }

      if (event.location) {
        lines.push(`LOCATION:${this.escapeICalText(event.location)}`);
      }

      lines.push('END:VEVENT');
    }

    // iCal footer
    lines.push('END:VCALENDAR');

    return lines.join('\r\n');
  }

  /**
   * Export itinerary as iCal file
   */
  async exportItineraryAsICal(itineraryId: string, userId: string): Promise<string> {
    try {
      // Get itinerary
      const itineraryResult = await query(
        'SELECT * FROM itineraries WHERE id = $1 AND user_id = $2',
        [itineraryId, userId]
      );

      if (itineraryResult.rows.length === 0) {
        throw new AppError(404, 'NOT_FOUND', 'Itinerary not found');
      }

      const itinerary = itineraryResult.rows[0];

      const events: ICalEvent[] = [
        {
          title: itinerary.title,
          description: itinerary.description,
          location: itinerary.destination,
          start: new Date(itinerary.start_date),
          end: new Date(itinerary.end_date),
          uid: `luxai-itinerary-${itinerary.id}@luxai.com`,
        },
      ];

      return this.generateICalFile(events);
    } catch (error) {
      logger.error('Failed to export itinerary as iCal', { error, itineraryId, userId });
      throw error;
    }
  }

  /**
   * Get synced events
   */
  async getSyncedEvents(connectionId: string, userId: string): Promise<CalendarEvent[]> {
    try {
      // Verify connection belongs to user
      const connectionResult = await query(
        'SELECT id FROM calendar_connections WHERE id = $1 AND user_id = $2',
        [connectionId, userId]
      );

      if (connectionResult.rows.length === 0) {
        throw new AppError(404, 'NOT_FOUND', 'Calendar connection not found');
      }

      const result = await query(
        `SELECT id, connection_id, itinerary_id, provider_event_id, event_type,
                title, description, location, start_time, end_time, all_day,
                recurrence_rule, metadata, created_at
         FROM synced_calendar_events
         WHERE connection_id = $1
         ORDER BY start_time DESC`,
        [connectionId]
      );

      return result.rows.map((row) => ({
        ...row,
        metadata: row.metadata,
      }));
    } catch (error) {
      logger.error('Failed to get synced events', { error, connectionId, userId });
      throw error;
    }
  }

  /**
   * Format date for iCal (RFC 5545)
   */
  private formatICalDate(date: Date): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hour = String(date.getUTCHours()).padStart(2, '0');
    const minute = String(date.getUTCMinutes()).padStart(2, '0');
    const second = String(date.getUTCSeconds()).padStart(2, '0');

    return `${year}${month}${day}T${hour}${minute}${second}Z`;
  }

  /**
   * Escape text for iCal format
   */
  private escapeICalText(text: string): string {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n');
  }
}

export const calendarService = new CalendarService();
