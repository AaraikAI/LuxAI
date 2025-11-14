import { query } from '../db';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import crypto from 'crypto';
import axios from 'axios';

interface SecurityAlert {
  userId: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  metadata?: any;
}

export class SecurityService {
  /**
   * Check if password has been breached using HaveIBeenPwned API
   */
  async checkPasswordBreach(password: string): Promise<{
    breached: boolean;
    count: number;
  }> {
    try {
      // Hash password with SHA-1
      const hash = crypto.createHash('sha1').update(password).digest('hex').toUpperCase();
      const prefix = hash.substring(0, 5);
      const suffix = hash.substring(5);

      // Query HaveIBeenPwned API (k-anonymity model)
      const response = await axios.get(
        `https://api.pwnedpasswords.com/range/${prefix}`,
        {
          timeout: 5000,
        }
      );

      // Parse response
      const hashes = response.data.split('\r\n');
      for (const line of hashes) {
        const [hashSuffix, count] = line.split(':');
        if (hashSuffix === suffix) {
          return {
            breached: true,
            count: parseInt(count),
          };
        }
      }

      return { breached: false, count: 0 };
    } catch (error) {
      // Don't block login if API is down
      logger.error('Failed to check password breach', { error });
      return { breached: false, count: 0 };
    }
  }

  /**
   * Check if IP is whitelisted for user
   */
  async checkIPWhitelist(userId: string, ipAddress: string): Promise<boolean> {
    // Get user's whitelisted IPs
    const result = await query(
      `SELECT ip_whitelist FROM users WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return true; // No whitelist means all IPs allowed
    }

    const whitelist = result.rows[0].ip_whitelist;
    if (!whitelist || whitelist.length === 0) {
      return true; // Empty whitelist means all IPs allowed
    }

    return whitelist.includes(ipAddress);
  }

  /**
   * Add IP to whitelist
   */
  async addIPToWhitelist(userId: string, ipAddress: string): Promise<void> {
    await query(
      `UPDATE users
       SET ip_whitelist = ARRAY_APPEND(COALESCE(ip_whitelist, ARRAY[]::VARCHAR[]), $1)
       WHERE id = $2`,
      [ipAddress, userId]
    );

    logger.info('IP added to whitelist', { userId, ipAddress });
  }

  /**
   * Remove IP from whitelist
   */
  async removeIPFromWhitelist(userId: string, ipAddress: string): Promise<void> {
    await query(
      `UPDATE users
       SET ip_whitelist = ARRAY_REMOVE(ip_whitelist, $1)
       WHERE id = $2`,
      [ipAddress, userId]
    );

    logger.info('IP removed from whitelist', { userId, ipAddress });
  }

  /**
   * Get whitelisted IPs for user
   */
  async getWhitelistedIPs(userId: string): Promise<string[]> {
    const result = await query(
      `SELECT ip_whitelist FROM users WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return [];
    }

    return result.rows[0].ip_whitelist || [];
  }

  /**
   * Detect suspicious login activity
   */
  async detectSuspiciousActivity(
    userId: string,
    ipAddress: string,
    userAgent: string
  ): Promise<{
    suspicious: boolean;
    reasons: string[];
  }> {
    const reasons: string[] = [];

    // Check for rapid login attempts
    const recentLogins = await query(
      `SELECT COUNT(*) as count
       FROM audit_logs
       WHERE user_id = $1
         AND action = 'login'
         AND timestamp > NOW() - INTERVAL '5 minutes'`,
      [userId]
    );

    if (parseInt(recentLogins.rows[0].count) > 5) {
      reasons.push('Multiple login attempts in short time period');
    }

    // Check for login from new location
    const knownIPs = await query(
      `SELECT DISTINCT ip_address
       FROM audit_logs
       WHERE user_id = $1
         AND action = 'login'
         AND timestamp > NOW() - INTERVAL '30 days'
       LIMIT 10`,
      [userId]
    );

    const isKnownIP = knownIPs.rows.some((row) => row.ip_address === ipAddress);
    if (!isKnownIP && knownIPs.rows.length > 0) {
      reasons.push('Login from new IP address');
    }

    // Check for unusual user agent
    const knownAgents = await query(
      `SELECT DISTINCT user_agent
       FROM audit_logs
       WHERE user_id = $1
         AND action = 'login'
         AND timestamp > NOW() - INTERVAL '30 days'
       LIMIT 5`,
      [userId]
    );

    const isKnownAgent = knownAgents.rows.some((row) => row.user_agent === userAgent);
    if (!isKnownAgent && knownAgents.rows.length > 0) {
      reasons.push('Login from new device or browser');
    }

    return {
      suspicious: reasons.length > 0,
      reasons,
    };
  }

  /**
   * Log security alert
   */
  async logSecurityAlert(alert: SecurityAlert): Promise<void> {
    await query(
      `INSERT INTO audit_logs (user_id, entity_type, entity_id, action, changes)
       VALUES ($1, 'security', $2, $3, $4)`,
      [
        alert.userId,
        alert.userId,
        `security_alert_${alert.type}`,
        JSON.stringify({
          severity: alert.severity,
          message: alert.message,
          metadata: alert.metadata,
        }),
      ]
    );

    logger.warn('Security alert logged', alert);
  }

  /**
   * Get security alerts for user
   */
  async getSecurityAlerts(userId: string, limit: number = 50): Promise<any[]> {
    const result = await query(
      `SELECT id, action, changes, timestamp
       FROM audit_logs
       WHERE user_id = $1
         AND entity_type = 'security'
       ORDER BY timestamp DESC
       LIMIT $2`,
      [userId, limit]
    );

    return result.rows.map((row) => ({
      id: row.id,
      type: row.action.replace('security_alert_', ''),
      ...row.changes,
      timestamp: row.timestamp,
    }));
  }

  /**
   * Check password strength
   */
  checkPasswordStrength(password: string): {
    score: number;
    feedback: string[];
  } {
    const feedback: string[] = [];
    let score = 0;

    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (password.length >= 16) score++;

    if (/[a-z]/.test(password)) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^a-zA-Z0-9]/.test(password)) score++;

    if (password.length < 8) feedback.push('Password should be at least 8 characters');
    if (!/[a-z]/.test(password)) feedback.push('Add lowercase letters');
    if (!/[A-Z]/.test(password)) feedback.push('Add uppercase letters');
    if (!/[0-9]/.test(password)) feedback.push('Add numbers');
    if (!/[^a-zA-Z0-9]/.test(password)) feedback.push('Add special characters');

    // Check for common patterns
    if (/(.)\1{2,}/.test(password)) {
      feedback.push('Avoid repeated characters');
      score--;
    }

    if (/^[0-9]+$/.test(password)) {
      feedback.push('Avoid using only numbers');
      score--;
    }

    return {
      score: Math.max(0, Math.min(5, score)),
      feedback,
    };
  }

  /**
   * Enforce password policy
   */
  async enforcePasswordPolicy(userId: string, password: string): Promise<void> {
    // Check strength
    const strength = this.checkPasswordStrength(password);
    if (strength.score < 3) {
      throw new AppError(
        400,
        'WEAK_PASSWORD',
        `Password is too weak. ${strength.feedback.join(', ')}`
      );
    }

    // Check breach
    const breach = await this.checkPasswordBreach(password);
    if (breach.breached) {
      throw new AppError(
        400,
        'BREACHED_PASSWORD',
        `This password has been found in ${breach.count} data breaches. Please choose a different password.`
      );
    }
  }
}

export const securityService = new SecurityService();
