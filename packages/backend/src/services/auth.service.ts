import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { query } from '../db';
import { UserRole } from '@luxai/shared';
import { AppError } from '../middleware/errorHandler';
import { twoFactorService } from './twoFactor.service';

const SALT_ROUNDS = 10;

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  phone?: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export class AuthService {
  async register(data: RegisterData) {
    // Check if user already exists
    const existingUser = await query(
      'SELECT id FROM users WHERE email = $1',
      [data.email]
    );

    if (existingUser.rows.length > 0) {
      throw new AppError(409, 'USER_EXISTS', 'User with this email already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);

    // Create user
    const result = await query(
      `INSERT INTO users (email, password_hash, role, first_name, last_name, phone)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, email, role, first_name, last_name, phone, kyc_status, created_at`,
      [
        data.email,
        passwordHash,
        data.role,
        data.firstName,
        data.lastName,
        data.phone || null,
      ]
    );

    const user = result.rows[0];

    // Create role-specific record
    if (data.role === UserRole.CLIENT) {
      await query(
        'INSERT INTO clients (id, preferences, live_updates_enabled) VALUES ($1, $2, $3)',
        [user.id, JSON.stringify({}), true]
      );
    } else if (data.role === UserRole.DESIGNER) {
      await query(
        'INSERT INTO designers (id, specializations, certifications, experience_years) VALUES ($1, $2, $3, $4)',
        [user.id, '{}', '{}', 0]
      );
    }

    // Generate JWT
    const token = this.generateToken(user);

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone,
        kycStatus: user.kyc_status,
        createdAt: user.created_at,
      },
      token,
    };
  }

  async login(data: LoginData) {
    // Find user
    const result = await query(
      `SELECT id, email, password_hash, role, first_name, last_name, phone, kyc_status, two_factor_enabled, created_at
       FROM users
       WHERE email = $1`,
      [data.email]
    );

    if (result.rows.length === 0) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    const user = result.rows[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(data.password, user.password_hash);

    if (!isValidPassword) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    // Check if 2FA is enabled
    if (user.two_factor_enabled) {
      // Generate temporary token that requires 2FA verification
      const tempToken = this.generateTempToken(user);

      return {
        requiresTwoFactor: true,
        tempToken,
        message: 'Two-factor authentication required',
      };
    }

    // Generate full JWT token
    const token = this.generateToken(user);

    return {
      requiresTwoFactor: false,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone,
        kycStatus: user.kyc_status,
        twoFactorEnabled: user.two_factor_enabled,
        createdAt: user.created_at,
      },
      token,
    };
  }

  async verify2FA(tempToken: string, code: string, isBackupCode: boolean = false) {
    try {
      // Verify temp token
      const decoded = jwt.verify(tempToken, config.jwt.secret) as {
        id: string;
        email: string;
        role: UserRole;
        requiresTwoFactor?: boolean;
      };

      // Ensure this is a temp token
      if (!decoded.requiresTwoFactor) {
        throw new AppError(400, 'INVALID_TOKEN', 'This is not a 2FA verification token');
      }

      // Get user from database
      const result = await query(
        `SELECT id, email, role, first_name, last_name, phone, kyc_status, two_factor_enabled, two_factor_secret, created_at
         FROM users
         WHERE id = $1`,
        [decoded.id]
      );

      if (result.rows.length === 0) {
        throw new AppError(401, 'USER_NOT_FOUND', 'User not found');
      }

      const user = result.rows[0];

      // Verify 2FA is enabled
      if (!user.two_factor_enabled || !user.two_factor_secret) {
        throw new AppError(400, '2FA_NOT_ENABLED', 'Two-factor authentication is not enabled for this user');
      }

      // Verify the code
      let isValid = false;
      if (isBackupCode) {
        isValid = await twoFactorService.verifyBackupCode(user.id, code);
      } else {
        isValid = twoFactorService.verifyToken(user.two_factor_secret, code);
      }

      if (!isValid) {
        throw new AppError(401, 'INVALID_2FA_CODE', 'Invalid two-factor authentication code');
      }

      // Generate full JWT token
      const token = this.generateToken(user);

      return {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          firstName: user.first_name,
          lastName: user.last_name,
          phone: user.phone,
          kycStatus: user.kyc_status,
          twoFactorEnabled: user.two_factor_enabled,
          createdAt: user.created_at,
        },
        token,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(401, 'INVALID_TOKEN', 'Invalid or expired token');
    }
  }

  async verifyToken(token: string) {
    try {
      const decoded = jwt.verify(token, config.jwt.secret) as {
        id: string;
        email: string;
        role: UserRole;
      };

      // Verify user still exists
      const result = await query(
        'SELECT id, email, role, first_name, last_name FROM users WHERE id = $1',
        [decoded.id]
      );

      if (result.rows.length === 0) {
        throw new AppError(401, 'USER_NOT_FOUND', 'User not found');
      }

      return result.rows[0];
    } catch (error) {
      throw new AppError(401, 'INVALID_TOKEN', 'Invalid or expired token');
    }
  }

  private generateToken(user: any): string {
    const payload = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

    const options: any = {
      expiresIn: config.jwt.expiresIn,
    };

    return jwt.sign(payload, config.jwt.secret, options);
  }

  private generateTempToken(user: any): string {
    const payload = {
      id: user.id,
      email: user.email,
      role: user.role,
      requiresTwoFactor: true,
    };

    const options: any = {
      expiresIn: '5m', // Temp token expires in 5 minutes
    };

    return jwt.sign(payload, config.jwt.secret, options);
  }
}

export const authService = new AuthService();
