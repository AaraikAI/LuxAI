import { query } from '../db';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { config } from '../config';

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
   * Create event on provider's calendar (stubbed - would integrate with actual APIs)
   */
  private async createProviderEvent(connection: any, itinerary: any): Promise<string> {
    // This is a stub - in production, this would call the actual provider API
    // (Google Calendar API, Microsoft Graph API, etc.)

    const eventId = `${connection.provider}_${Date.now()}`;

    logger.info('Creating provider event (stub)', {
      provider: connection.provider,
      itinerary: itinerary.id,
    });

    // TODO: Implement actual API calls for each provider:
    // - Google: Use googleapis npm package with OAuth2
    // - Outlook: Use @microsoft/microsoft-graph-client
    // - Apple: Use CalDAV protocol

    return eventId;
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
