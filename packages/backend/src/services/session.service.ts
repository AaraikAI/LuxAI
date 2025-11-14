import { query } from '../db';
import { logger } from '../utils/logger';
import { cacheService } from './cache.service';
import crypto from 'crypto';

interface SessionData {
  userId: string;
  deviceInfo?: {
    browser?: string;
    os?: string;
    device?: string;
  };
  ipAddress?: string;
  userAgent?: string;
  isTrusted?: boolean;
}

interface DeviceFingerprint {
  hash: string;
  name: string;
  info: any;
}

export class SessionService {
  private readonly SESSION_PREFIX = 'session:';
  private readonly USER_SESSIONS_PREFIX = 'user:sessions:';
  private readonly SESSION_EXPIRY = 24 * 60 * 60; // 24 hours in seconds
  private readonly MAX_SESSIONS_PER_USER = 10;

  /**
   * Create a new session
   */
  async createSession(tokenHash: string, data: SessionData): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // Store in database
    await query(
      `INSERT INTO user_sessions (user_id, token_hash, device_info, ip_address, user_agent, is_trusted, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        data.userId,
        tokenHash,
        JSON.stringify(data.deviceInfo || {}),
        data.ipAddress,
        data.userAgent,
        data.isTrusted || false,
        expiresAt,
      ]
    );

    // Store in Redis for fast lookup
    await cacheService.set(
      this.SESSION_PREFIX + tokenHash,
      {
        userId: data.userId,
        ipAddress: data.ipAddress,
        deviceInfo: data.deviceInfo,
        expiresAt: expiresAt.toISOString(),
      },
      { ttl: this.SESSION_EXPIRY }
    );

    // Add to user's active sessions list
    await cacheService.set(
      this.USER_SESSIONS_PREFIX + data.userId,
      tokenHash,
      { ttl: this.SESSION_EXPIRY }
    );

    // Enforce maximum sessions per user
    await this.enforceSessionLimit(data.userId);

    logger.info('Session created', { userId: data.userId, ipAddress: data.ipAddress });
  }

  /**
   * Get session data
   */
  async getSession(tokenHash: string): Promise<SessionData | null> {
    // Try Redis first
    const cached = await cacheService.get<SessionData>(this.SESSION_PREFIX + tokenHash);
    if (cached) {
      return cached;
    }

    // Fall back to database
    const result = await query(
      `SELECT user_id, device_info, ip_address, user_agent, is_trusted, expires_at
       FROM user_sessions
       WHERE token_hash = $1 AND expires_at > NOW()`,
      [tokenHash]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const session = result.rows[0];
    const sessionData: SessionData = {
      userId: session.user_id,
      deviceInfo: session.device_info,
      ipAddress: session.ip_address,
      userAgent: session.user_agent,
      isTrusted: session.is_trusted,
    };

    // Cache for future requests
    await cacheService.set(this.SESSION_PREFIX + tokenHash, sessionData, {
      ttl: this.SESSION_EXPIRY,
    });

    return sessionData;
  }

  /**
   * Update session activity
   */
  async updateSessionActivity(tokenHash: string): Promise<void> {
    await query(
      `UPDATE user_sessions
       SET last_activity = CURRENT_TIMESTAMP
       WHERE token_hash = $1`,
      [tokenHash]
    );
  }

  /**
   * Revoke a session
   */
  async revokeSession(tokenHash: string): Promise<void> {
    // Delete from database
    await query('DELETE FROM user_sessions WHERE token_hash = $1', [tokenHash]);

    // Delete from Redis
    await cacheService.del(this.SESSION_PREFIX + tokenHash);

    logger.info('Session revoked', { tokenHash: tokenHash.substring(0, 8) + '...' });
  }

  /**
   * Revoke all sessions for a user
   */
  async revokeAllUserSessions(userId: string): Promise<void> {
    // Get all session token hashes from database
    const result = await query(
      'SELECT token_hash FROM user_sessions WHERE user_id = $1',
      [userId]
    );

    // Delete from database
    await query('DELETE FROM user_sessions WHERE user_id = $1', [userId]);

    // Delete from Redis
    for (const row of result.rows) {
      await cacheService.del(this.SESSION_PREFIX + row.token_hash);
    }

    // Clear user sessions list
    await cacheService.del(this.USER_SESSIONS_PREFIX + userId);

    logger.info('All user sessions revoked', { userId });
  }

  /**
   * Get all active sessions for a user
   */
  async getUserSessions(userId: string): Promise<any[]> {
    const result = await query(
      `SELECT id, device_info, ip_address, is_trusted, last_activity, created_at, expires_at
       FROM user_sessions
       WHERE user_id = $1 AND expires_at > NOW()
       ORDER BY last_activity DESC`,
      [userId]
    );

    return result.rows.map((row) => ({
      id: row.id,
      deviceInfo: row.device_info,
      ipAddress: row.ip_address,
      isTrusted: row.is_trusted,
      lastActivity: row.last_activity,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
    }));
  }

  /**
   * Enforce maximum sessions per user
   */
  private async enforceSessionLimit(userId: string): Promise<void> {
    const result = await query(
      `SELECT COUNT(*) as count
       FROM user_sessions
       WHERE user_id = $1 AND expires_at > NOW()`,
      [userId]
    );

    const sessionCount = parseInt(result.rows[0].count);

    if (sessionCount > this.MAX_SESSIONS_PER_USER) {
      // Delete oldest sessions
      await query(
        `DELETE FROM user_sessions
         WHERE id IN (
           SELECT id FROM user_sessions
           WHERE user_id = $1 AND expires_at > NOW()
           ORDER BY last_activity ASC
           LIMIT $2
         )`,
        [userId, sessionCount - this.MAX_SESSIONS_PER_USER]
      );

      logger.info('Enforced session limit', { userId, removed: sessionCount - this.MAX_SESSIONS_PER_USER });
    }
  }

  /**
   * Generate device fingerprint
   */
  generateDeviceFingerprint(userAgent: string, ipAddress: string): DeviceFingerprint {
    const hash = crypto
      .createHash('sha256')
      .update(userAgent + ipAddress)
      .digest('hex');

    // Parse user agent for device info
    const info = this.parseUserAgent(userAgent);

    return {
      hash,
      name: `${info.browser} on ${info.os}`,
      info,
    };
  }

  /**
   * Check if device is trusted
   */
  async isDeviceTrusted(userId: string, fingerprint: string): Promise<boolean> {
    const result = await query(
      `SELECT COUNT(*) as count
       FROM trusted_devices
       WHERE user_id = $1 AND device_fingerprint = $2`,
      [userId, fingerprint]
    );

    return parseInt(result.rows[0].count) > 0;
  }

  /**
   * Trust a device
   */
  async trustDevice(
    userId: string,
    fingerprint: string,
    deviceName: string,
    deviceInfo: any
  ): Promise<void> {
    await query(
      `INSERT INTO trusted_devices (user_id, device_fingerprint, device_name, device_info)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, device_fingerprint) DO UPDATE
       SET last_used = CURRENT_TIMESTAMP`,
      [userId, fingerprint, deviceName, JSON.stringify(deviceInfo)]
    );

    logger.info('Device trusted', { userId, deviceName });
  }

  /**
   * Get trusted devices
   */
  async getTrustedDevices(userId: string): Promise<any[]> {
    const result = await query(
      `SELECT id, device_name, device_info, last_used, created_at
       FROM trusted_devices
       WHERE user_id = $1
       ORDER BY last_used DESC`,
      [userId]
    );

    return result.rows;
  }

  /**
   * Remove trusted device
   */
  async removeTrustedDevice(userId: string, deviceId: string): Promise<void> {
    await query(
      'DELETE FROM trusted_devices WHERE id = $1 AND user_id = $2',
      [deviceId, userId]
    );

    logger.info('Trusted device removed', { userId, deviceId });
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    const result = await query(
      'DELETE FROM user_sessions WHERE expires_at <= NOW()'
    );

    const deletedCount = result.rowCount || 0;
    if (deletedCount > 0) {
      logger.info('Cleaned up expired sessions', { count: deletedCount });
    }

    return deletedCount;
  }

  /**
   * Parse user agent string
   */
  private parseUserAgent(userAgent: string): {
    browser: string;
    os: string;
    device: string;
  } {
    // Simple user agent parsing (in production, use a library like ua-parser-js)
    let browser = 'Unknown';
    let os = 'Unknown';
    let device = 'Desktop';

    if (userAgent.includes('Chrome')) browser = 'Chrome';
    else if (userAgent.includes('Firefox')) browser = 'Firefox';
    else if (userAgent.includes('Safari')) browser = 'Safari';
    else if (userAgent.includes('Edge')) browser = 'Edge';

    if (userAgent.includes('Windows')) os = 'Windows';
    else if (userAgent.includes('Mac')) os = 'macOS';
    else if (userAgent.includes('Linux')) os = 'Linux';
    else if (userAgent.includes('Android')) os = 'Android';
    else if (userAgent.includes('iOS')) os = 'iOS';

    if (userAgent.includes('Mobile')) device = 'Mobile';
    else if (userAgent.includes('Tablet')) device = 'Tablet';

    return { browser, os, device };
  }
}

export const sessionService = new SessionService();
