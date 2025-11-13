import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { query } from '../db';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';

export interface TwoFactorSetup {
  secret: string;
  qrCode: string;
  backupCodes: string[];
}

/**
 * Two-Factor Authentication Service
 * Handles TOTP (Time-based One-Time Password) authentication
 */
export class TwoFactorService {
  /**
   * Generate 2FA secret and QR code for setup
   */
  async setup(userId: string, email: string): Promise<TwoFactorSetup> {
    try {
      // Generate secret
      const secret = speakeasy.generateSecret({
        name: `LuxAI Designer (${email})`,
        issuer: 'LuxAI Designer',
        length: 32,
      });

      // Generate QR code
      const qrCode = await QRCode.toDataURL(secret.otpauth_url!);

      // Generate backup codes
      const backupCodes = this.generateBackupCodes(8);

      logger.info('2FA setup initiated', { userId });

      return {
        secret: secret.base32,
        qrCode,
        backupCodes,
      };
    } catch (error) {
      logger.error('2FA setup failed', { userId, error });
      throw new AppError(500, 'TWO_FACTOR_SETUP_FAILED', 'Failed to setup 2FA');
    }
  }

  /**
   * Enable 2FA for user after verifying the first code
   */
  async enable(
    userId: string,
    secret: string,
    verificationCode: string,
    backupCodes: string[]
  ): Promise<void> {
    // Verify the code
    const isValid = this.verifyToken(secret, verificationCode);

    if (!isValid) {
      throw new AppError(400, 'INVALID_2FA_CODE', 'Invalid verification code');
    }

    try {
      // Hash backup codes before storing
      const hashedBackupCodes = backupCodes.map(code =>
        // In production, use proper hashing (bcrypt)
        Buffer.from(code).toString('base64')
      );

      // Enable 2FA in database
      await query(
        `UPDATE users
         SET two_factor_enabled = true,
             two_factor_secret = $1,
             backup_codes = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [secret, hashedBackupCodes, userId]
      );

      logger.info('2FA enabled', { userId });
    } catch (error) {
      logger.error('Failed to enable 2FA', { userId, error });
      throw new AppError(500, 'TWO_FACTOR_ENABLE_FAILED', 'Failed to enable 2FA');
    }
  }

  /**
   * Disable 2FA for user
   */
  async disable(userId: string, verificationCode: string): Promise<void> {
    // Get user's 2FA secret
    const result = await query(
      'SELECT two_factor_secret FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
    }

    const { two_factor_secret } = result.rows[0];

    if (!two_factor_secret) {
      throw new AppError(400, 'TWO_FACTOR_NOT_ENABLED', '2FA is not enabled');
    }

    // Verify the code
    const isValid = this.verifyToken(two_factor_secret, verificationCode);

    if (!isValid) {
      throw new AppError(400, 'INVALID_2FA_CODE', 'Invalid verification code');
    }

    try {
      // Disable 2FA
      await query(
        `UPDATE users
         SET two_factor_enabled = false,
             two_factor_secret = NULL,
             backup_codes = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [userId]
      );

      logger.info('2FA disabled', { userId });
    } catch (error) {
      logger.error('Failed to disable 2FA', { userId, error });
      throw new AppError(500, 'TWO_FACTOR_DISABLE_FAILED', 'Failed to disable 2FA');
    }
  }

  /**
   * Verify 2FA token
   */
  verifyToken(secret: string, token: string): boolean {
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 2, // Allow 2 time steps (60 seconds) before and after
    });
  }

  /**
   * Verify backup code
   */
  async verifyBackupCode(userId: string, code: string): Promise<boolean> {
    try {
      const result = await query(
        'SELECT backup_codes FROM users WHERE id = $1',
        [userId]
      );

      if (result.rows.length === 0 || !result.rows[0].backup_codes) {
        return false;
      }

      const backupCodes = result.rows[0].backup_codes as string[];
      const hashedCode = Buffer.from(code).toString('base64');

      // Check if code exists
      const codeIndex = backupCodes.indexOf(hashedCode);
      if (codeIndex === -1) {
        return false;
      }

      // Remove used backup code
      const updatedCodes = backupCodes.filter((_, index) => index !== codeIndex);

      await query(
        `UPDATE users
         SET backup_codes = $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [updatedCodes, userId]
      );

      logger.info('Backup code used', { userId, remainingCodes: updatedCodes.length });

      return true;
    } catch (error) {
      logger.error('Backup code verification failed', { userId, error });
      return false;
    }
  }

  /**
   * Generate new backup codes
   */
  async regenerateBackupCodes(
    userId: string,
    verificationCode: string
  ): Promise<string[]> {
    // Get user's 2FA secret
    const result = await query(
      'SELECT two_factor_secret FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
    }

    const { two_factor_secret } = result.rows[0];

    if (!two_factor_secret) {
      throw new AppError(400, 'TWO_FACTOR_NOT_ENABLED', '2FA is not enabled');
    }

    // Verify the code
    const isValid = this.verifyToken(two_factor_secret, verificationCode);

    if (!isValid) {
      throw new AppError(400, 'INVALID_2FA_CODE', 'Invalid verification code');
    }

    // Generate new backup codes
    const backupCodes = this.generateBackupCodes(8);
    const hashedBackupCodes = backupCodes.map(code =>
      Buffer.from(code).toString('base64')
    );

    try {
      await query(
        `UPDATE users
         SET backup_codes = $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [hashedBackupCodes, userId]
      );

      logger.info('Backup codes regenerated', { userId });

      return backupCodes;
    } catch (error) {
      logger.error('Failed to regenerate backup codes', { userId, error });
      throw new AppError(
        500,
        'BACKUP_CODES_REGENERATION_FAILED',
        'Failed to regenerate backup codes'
      );
    }
  }

  /**
   * Check if 2FA is enabled for user
   */
  async isEnabled(userId: string): Promise<boolean> {
    const result = await query(
      'SELECT two_factor_enabled FROM users WHERE id = $1',
      [userId]
    );

    return result.rows.length > 0 && result.rows[0].two_factor_enabled === true;
  }

  /**
   * Get 2FA status for user
   */
  async getStatus(userId: string): Promise<{
    enabled: boolean;
    backupCodesCount: number;
  }> {
    const result = await query(
      'SELECT two_factor_enabled, backup_codes FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
    }

    const { two_factor_enabled, backup_codes } = result.rows[0];

    return {
      enabled: two_factor_enabled || false,
      backupCodesCount: backup_codes ? backup_codes.length : 0,
    };
  }

  /**
   * Generate random backup codes
   */
  private generateBackupCodes(count: number): string[] {
    const codes: string[] = [];

    for (let i = 0; i < count; i++) {
      // Generate 8-character alphanumeric code
      const code = Array.from({ length: 8 }, () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude ambiguous characters
        return chars.charAt(Math.floor(Math.random() * chars.length));
      }).join('');

      // Format as XXXX-XXXX
      codes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
    }

    return codes;
  }
}

export const twoFactorService = new TwoFactorService();
