import { query } from '../db';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import bcrypt from 'bcrypt';

export interface AdminUser {
  id: string;
  email: string;
  full_name?: string;
  role: string;
  is_verified: boolean;
  is_active: boolean;
  created_at: Date;
  last_login_at?: Date;
  failed_login_attempts: number;
  account_locked_until?: Date;
}

export interface UserFilters {
  role?: string;
  is_verified?: boolean;
  is_active?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface SystemConfig {
  key: string;
  value: any;
  description?: string;
  updated_at: Date;
  updated_by?: string;
}

export interface FeatureFlag {
  id: string;
  name: string;
  key: string;
  description?: string;
  is_enabled: boolean;
  rollout_percentage: number;
  target_users?: string[];
  target_roles?: string[];
  created_at: Date;
  updated_at: Date;
}

export class AdminService {
  /**
   * Get all users with filters
   */
  async getUsers(filters: UserFilters = {}): Promise<{ users: AdminUser[]; total: number }> {
    try {
      const {
        role,
        is_verified,
        is_active,
        search,
        limit = 50,
        offset = 0,
      } = filters;

      let whereClause = 'WHERE 1=1';
      const params: any[] = [];
      let paramIndex = 1;

      if (role) {
        whereClause += ` AND role = $${paramIndex++}`;
        params.push(role);
      }

      if (is_verified !== undefined) {
        whereClause += ` AND is_verified = $${paramIndex++}`;
        params.push(is_verified);
      }

      if (is_active !== undefined) {
        whereClause += ` AND is_active = $${paramIndex++}`;
        params.push(is_active);
      }

      if (search) {
        whereClause += ` AND (email ILIKE $${paramIndex} OR full_name ILIKE $${paramIndex})`;
        params.push(`%${search}%`);
        paramIndex++;
      }

      // Get users
      const result = await query(
        `SELECT id, email, full_name, role, is_verified, is_active,
                created_at, last_login_at, failed_login_attempts, account_locked_until
         FROM users
         ${whereClause}
         ORDER BY created_at DESC
         LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
        [...params, limit, offset]
      );

      // Get total count
      const countResult = await query(
        `SELECT COUNT(*) as total FROM users ${whereClause}`,
        params
      );

      return {
        users: result.rows,
        total: parseInt(countResult.rows[0].total),
      };
    } catch (error) {
      logger.error('Failed to get users', { error });
      throw error;
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<AdminUser> {
    try {
      const result = await query(
        `SELECT id, email, full_name, role, is_verified, is_active,
                created_at, last_login_at, failed_login_attempts, account_locked_until
         FROM users
         WHERE id = $1`,
        [userId]
      );

      if (result.rows.length === 0) {
        throw new AppError(404, 'NOT_FOUND', 'User not found');
      }

      return result.rows[0];
    } catch (error) {
      logger.error('Failed to get user', { error, userId });
      throw error;
    }
  }

  /**
   * Update user
   */
  async updateUser(
    userId: string,
    updates: {
      full_name?: string;
      role?: string;
      is_verified?: boolean;
      is_active?: boolean;
    }
  ): Promise<AdminUser> {
    try {
      const updateFields: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (updates.full_name !== undefined) {
        updateFields.push(`full_name = $${paramIndex++}`);
        params.push(updates.full_name);
      }

      if (updates.role !== undefined) {
        updateFields.push(`role = $${paramIndex++}`);
        params.push(updates.role);
      }

      if (updates.is_verified !== undefined) {
        updateFields.push(`is_verified = $${paramIndex++}`);
        params.push(updates.is_verified);
      }

      if (updates.is_active !== undefined) {
        updateFields.push(`is_active = $${paramIndex++}`);
        params.push(updates.is_active);
      }

      if (updateFields.length === 0) {
        throw new AppError(400, 'INVALID_INPUT', 'No valid update fields provided');
      }

      params.push(userId);

      const result = await query(
        `UPDATE users
         SET ${updateFields.join(', ')}, updated_at = NOW()
         WHERE id = $${paramIndex}
         RETURNING id, email, full_name, role, is_verified, is_active,
                   created_at, last_login_at, failed_login_attempts, account_locked_until`,
        params
      );

      if (result.rows.length === 0) {
        throw new AppError(404, 'NOT_FOUND', 'User not found');
      }

      logger.info('User updated', { userId, updates });

      return result.rows[0];
    } catch (error) {
      logger.error('Failed to update user', { error, userId });
      throw error;
    }
  }

  /**
   * Delete user
   */
  async deleteUser(userId: string): Promise<void> {
    try {
      const result = await query('DELETE FROM users WHERE id = $1', [userId]);

      if (result.rowCount === 0) {
        throw new AppError(404, 'NOT_FOUND', 'User not found');
      }

      logger.info('User deleted', { userId });
    } catch (error) {
      logger.error('Failed to delete user', { error, userId });
      throw error;
    }
  }

  /**
   * Reset user password
   */
  async resetUserPassword(userId: string, newPassword: string): Promise<void> {
    try {
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      const result = await query(
        'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
        [hashedPassword, userId]
      );

      if (result.rowCount === 0) {
        throw new AppError(404, 'NOT_FOUND', 'User not found');
      }

      logger.info('User password reset', { userId });
    } catch (error) {
      logger.error('Failed to reset user password', { error, userId });
      throw error;
    }
  }

  /**
   * Unlock user account
   */
  async unlockAccount(userId: string): Promise<void> {
    try {
      await query(
        `UPDATE users
         SET failed_login_attempts = 0, account_locked_until = NULL
         WHERE id = $1`,
        [userId]
      );

      logger.info('User account unlocked', { userId });
    } catch (error) {
      logger.error('Failed to unlock account', { error, userId });
      throw error;
    }
  }

  /**
   * Get system statistics
   */
  async getSystemStats(): Promise<any> {
    try {
      const stats = await Promise.all([
        // Total users
        query('SELECT COUNT(*) as total FROM users'),
        // Active users (last 30 days)
        query(`SELECT COUNT(*) as total FROM users
               WHERE last_login_at > NOW() - INTERVAL '30 days'`),
        // Users by role
        query(`SELECT role, COUNT(*) as count FROM users
               GROUP BY role ORDER BY count DESC`),
        // Unverified users
        query('SELECT COUNT(*) as total FROM users WHERE is_verified = false'),
        // Locked accounts
        query(`SELECT COUNT(*) as total FROM users
               WHERE account_locked_until IS NOT NULL AND account_locked_until > NOW()`),
        // Total itineraries
        query('SELECT COUNT(*) as total FROM itineraries'),
        // Pending approvals
        query(`SELECT COUNT(*) as total FROM approvals WHERE status = 'pending'`),
        // Active sessions (estimate from session table if exists)
        query(`SELECT COUNT(DISTINCT user_id) as total FROM sessions
               WHERE expires_at > NOW()`).catch(() => ({ rows: [{ total: 0 }] })),
      ]);

      return {
        totalUsers: parseInt(stats[0].rows[0].total),
        activeUsers: parseInt(stats[1].rows[0].total),
        usersByRole: stats[2].rows,
        unverifiedUsers: parseInt(stats[3].rows[0].total),
        lockedAccounts: parseInt(stats[4].rows[0].total),
        totalItineraries: parseInt(stats[5].rows[0].total),
        pendingApprovals: parseInt(stats[6].rows[0].total),
        activeSessions: parseInt(stats[7].rows[0].total),
      };
    } catch (error) {
      logger.error('Failed to get system stats', { error });
      throw error;
    }
  }

  /**
   * Get system configuration
   */
  async getSystemConfig(): Promise<SystemConfig[]> {
    try {
      const result = await query(
        `SELECT key, value, description, updated_at, updated_by
         FROM system_config
         ORDER BY key`
      );

      return result.rows.map((row) => ({
        ...row,
        value: JSON.parse(row.value),
      }));
    } catch (error) {
      logger.error('Failed to get system config', { error });
      throw error;
    }
  }

  /**
   * Update system configuration
   */
  async updateSystemConfig(
    key: string,
    value: any,
    updatedBy: string,
    description?: string
  ): Promise<void> {
    try {
      await query(
        `INSERT INTO system_config (key, value, description, updated_by)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (key)
         DO UPDATE SET value = $2, description = $3, updated_by = $4, updated_at = NOW()`,
        [key, JSON.stringify(value), description, updatedBy]
      );

      logger.info('System config updated', { key, updatedBy });
    } catch (error) {
      logger.error('Failed to update system config', { error, key });
      throw error;
    }
  }

  /**
   * Get all feature flags
   */
  async getFeatureFlags(): Promise<FeatureFlag[]> {
    try {
      const result = await query(
        `SELECT id, name, key, description, is_enabled, rollout_percentage,
                target_users, target_roles, created_at, updated_at
         FROM feature_flags
         ORDER BY name`
      );

      return result.rows.map((row) => ({
        ...row,
        target_users: row.target_users || [],
        target_roles: row.target_roles || [],
      }));
    } catch (error) {
      logger.error('Failed to get feature flags', { error });
      throw error;
    }
  }

  /**
   * Create feature flag
   */
  async createFeatureFlag(data: {
    name: string;
    key: string;
    description?: string;
    is_enabled?: boolean;
    rollout_percentage?: number;
    target_users?: string[];
    target_roles?: string[];
  }): Promise<FeatureFlag> {
    try {
      const result = await query(
        `INSERT INTO feature_flags
         (name, key, description, is_enabled, rollout_percentage, target_users, target_roles)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          data.name,
          data.key,
          data.description,
          data.is_enabled ?? false,
          data.rollout_percentage ?? 0,
          data.target_users || [],
          data.target_roles || [],
        ]
      );

      logger.info('Feature flag created', { key: data.key });

      return result.rows[0];
    } catch (error) {
      logger.error('Failed to create feature flag', { error, data });
      throw error;
    }
  }

  /**
   * Update feature flag
   */
  async updateFeatureFlag(
    id: string,
    updates: {
      name?: string;
      description?: string;
      is_enabled?: boolean;
      rollout_percentage?: number;
      target_users?: string[];
      target_roles?: string[];
    }
  ): Promise<FeatureFlag> {
    try {
      const updateFields: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (updates.name !== undefined) {
        updateFields.push(`name = $${paramIndex++}`);
        params.push(updates.name);
      }

      if (updates.description !== undefined) {
        updateFields.push(`description = $${paramIndex++}`);
        params.push(updates.description);
      }

      if (updates.is_enabled !== undefined) {
        updateFields.push(`is_enabled = $${paramIndex++}`);
        params.push(updates.is_enabled);
      }

      if (updates.rollout_percentage !== undefined) {
        updateFields.push(`rollout_percentage = $${paramIndex++}`);
        params.push(updates.rollout_percentage);
      }

      if (updates.target_users !== undefined) {
        updateFields.push(`target_users = $${paramIndex++}`);
        params.push(updates.target_users);
      }

      if (updates.target_roles !== undefined) {
        updateFields.push(`target_roles = $${paramIndex++}`);
        params.push(updates.target_roles);
      }

      if (updateFields.length === 0) {
        throw new AppError(400, 'INVALID_INPUT', 'No valid update fields provided');
      }

      params.push(id);

      const result = await query(
        `UPDATE feature_flags
         SET ${updateFields.join(', ')}, updated_at = NOW()
         WHERE id = $${paramIndex}
         RETURNING *`,
        params
      );

      if (result.rows.length === 0) {
        throw new AppError(404, 'NOT_FOUND', 'Feature flag not found');
      }

      logger.info('Feature flag updated', { id, updates });

      return result.rows[0];
    } catch (error) {
      logger.error('Failed to update feature flag', { error, id });
      throw error;
    }
  }

  /**
   * Delete feature flag
   */
  async deleteFeatureFlag(id: string): Promise<void> {
    try {
      const result = await query('DELETE FROM feature_flags WHERE id = $1', [id]);

      if (result.rowCount === 0) {
        throw new AppError(404, 'NOT_FOUND', 'Feature flag not found');
      }

      logger.info('Feature flag deleted', { id });
    } catch (error) {
      logger.error('Failed to delete feature flag', { error, id });
      throw error;
    }
  }

  /**
   * Check if feature is enabled for user
   */
  async isFeatureEnabled(key: string, userId?: string, userRole?: string): Promise<boolean> {
    try {
      const result = await query(
        'SELECT * FROM feature_flags WHERE key = $1',
        [key]
      );

      if (result.rows.length === 0) {
        return false;
      }

      const flag: FeatureFlag = result.rows[0];

      // If flag is disabled, return false
      if (!flag.is_enabled) {
        return false;
      }

      // If specific users are targeted
      if (flag.target_users && flag.target_users.length > 0) {
        if (userId && flag.target_users.includes(userId)) {
          return true;
        }
        return false;
      }

      // If specific roles are targeted
      if (flag.target_roles && flag.target_roles.length > 0) {
        if (userRole && flag.target_roles.includes(userRole)) {
          return true;
        }
        return false;
      }

      // Rollout percentage
      if (flag.rollout_percentage === 100) {
        return true;
      }

      if (flag.rollout_percentage === 0) {
        return false;
      }

      // Use user ID to deterministically check rollout
      if (userId) {
        const hash = userId.split('').reduce((acc, char) => {
          return char.charCodeAt(0) + ((acc << 5) - acc);
        }, 0);
        const percentage = Math.abs(hash) % 100;
        return percentage < flag.rollout_percentage;
      }

      return false;
    } catch (error) {
      logger.error('Failed to check feature flag', { error, key });
      return false;
    }
  }
}

export const adminService = new AdminService();
