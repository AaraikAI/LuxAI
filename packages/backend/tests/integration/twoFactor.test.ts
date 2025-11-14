import request from 'supertest';
import { app } from '../../src/index';
import { cleanDatabase } from '../setup';
import speakeasy from 'speakeasy';
import { query } from '../../src/db';

describe('Two-Factor Authentication', () => {
  let authToken: string;
  let userId: string;
  let secret: string;
  let backupCodes: string[];

  beforeEach(async () => {
    await cleanDatabase();

    // Register and login a test user
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send({
        email: '2fa@test.com',
        password: 'Test123!@#',
        firstName: 'Test',
        lastName: 'User',
        role: 'client',
      });

    userId = registerResponse.body.data.user.id;
    authToken = registerResponse.body.data.token;
  });

  describe('POST /api/two-factor/setup', () => {
    it('should generate 2FA setup data', async () => {
      const response = await request(app)
        .post('/api/two-factor/setup')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('secret');
      expect(response.body.data).toHaveProperty('qrCode');
      expect(response.body.data).toHaveProperty('backupCodes');
      expect(response.body.data.backupCodes).toHaveLength(8);

      // Verify QR code is a data URL
      expect(response.body.data.qrCode).toMatch(/^data:image\/png;base64,/);

      // Verify backup codes format (XXXX-XXXX)
      response.body.data.backupCodes.forEach((code: string) => {
        expect(code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
      });

      secret = response.body.data.secret;
      backupCodes = response.body.data.backupCodes;
    });

    it('should require authentication', async () => {
      await request(app)
        .post('/api/two-factor/setup')
        .expect(401);
    });
  });

  describe('POST /api/two-factor/enable', () => {
    it('should enable 2FA with valid TOTP code', async () => {
      // Setup 2FA
      const setupResponse = await request(app)
        .post('/api/two-factor/setup')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      secret = setupResponse.body.data.secret;
      backupCodes = setupResponse.body.data.backupCodes;

      // Generate valid TOTP code
      const token = speakeasy.totp({
        secret: secret,
        encoding: 'base32',
      });

      // Enable 2FA
      const response = await request(app)
        .post('/api/two-factor/enable')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          secret: secret,
          verificationCode: token,
          backupCodes: backupCodes,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('message');

      // Verify database was updated
      const result = await query(
        'SELECT two_factor_enabled, two_factor_secret FROM users WHERE id = $1',
        [userId]
      );
      expect(result.rows[0].two_factor_enabled).toBe(true);
      expect(result.rows[0].two_factor_secret).toBeTruthy();
    });

    it('should reject invalid TOTP code', async () => {
      const setupResponse = await request(app)
        .post('/api/two-factor/setup')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      secret = setupResponse.body.data.secret;
      backupCodes = setupResponse.body.data.backupCodes;

      await request(app)
        .post('/api/two-factor/enable')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          secret: secret,
          verificationCode: '000000',
          backupCodes: backupCodes,
        })
        .expect(400);
    });
  });

  describe('2FA Login Flow', () => {
    beforeEach(async () => {
      // Enable 2FA for user
      const setupResponse = await request(app)
        .post('/api/two-factor/setup')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      secret = setupResponse.body.data.secret;
      backupCodes = setupResponse.body.data.backupCodes;

      const token = speakeasy.totp({
        secret: secret,
        encoding: 'base32',
      });

      await request(app)
        .post('/api/two-factor/enable')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          secret: secret,
          verificationCode: token,
          backupCodes: backupCodes,
        })
        .expect(200);
    });

    it('should require 2FA verification after login', async () => {
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: '2fa@test.com',
          password: 'Test123!@#',
        })
        .expect(200);

      expect(loginResponse.body.data.requiresTwoFactor).toBe(true);
      expect(loginResponse.body.data).toHaveProperty('tempToken');
      expect(loginResponse.body.data).not.toHaveProperty('token');
    });

    it('should complete login with valid TOTP code', async () => {
      // Login
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: '2fa@test.com',
          password: 'Test123!@#',
        })
        .expect(200);

      const tempToken = loginResponse.body.data.tempToken;

      // Generate valid TOTP code
      const token = speakeasy.totp({
        secret: secret,
        encoding: 'base32',
      });

      // Verify 2FA
      const verify2FAResponse = await request(app)
        .post('/api/auth/verify-2fa')
        .send({
          tempToken: tempToken,
          code: token,
          isBackupCode: false,
        })
        .expect(200);

      expect(verify2FAResponse.body.success).toBe(true);
      expect(verify2FAResponse.body.data).toHaveProperty('user');
      expect(verify2FAResponse.body.data).toHaveProperty('token');
      expect(verify2FAResponse.body.data.user.email).toBe('2fa@test.com');
    });

    it('should accept backup code for login', async () => {
      // Login
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: '2fa@test.com',
          password: 'Test123!@#',
        })
        .expect(200);

      const tempToken = loginResponse.body.data.tempToken;
      const backupCode = backupCodes[0];

      // Verify with backup code
      const verify2FAResponse = await request(app)
        .post('/api/auth/verify-2fa')
        .send({
          tempToken: tempToken,
          code: backupCode,
          isBackupCode: true,
        })
        .expect(200);

      expect(verify2FAResponse.body.success).toBe(true);
      expect(verify2FAResponse.body.data).toHaveProperty('token');

      // Try to use same backup code again (should fail)
      const loginResponse2 = await request(app)
        .post('/api/auth/login')
        .send({
          email: '2fa@test.com',
          password: 'Test123!@#',
        })
        .expect(200);

      await request(app)
        .post('/api/auth/verify-2fa')
        .send({
          tempToken: loginResponse2.body.data.tempToken,
          code: backupCode,
          isBackupCode: true,
        })
        .expect(401);
    });

    it('should reject invalid TOTP code', async () => {
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: '2fa@test.com',
          password: 'Test123!@#',
        })
        .expect(200);

      await request(app)
        .post('/api/auth/verify-2fa')
        .send({
          tempToken: loginResponse.body.data.tempToken,
          code: '000000',
          isBackupCode: false,
        })
        .expect(401);
    });
  });

  describe('POST /api/two-factor/disable', () => {
    beforeEach(async () => {
      // Enable 2FA
      const setupResponse = await request(app)
        .post('/api/two-factor/setup')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      secret = setupResponse.body.data.secret;
      backupCodes = setupResponse.body.data.backupCodes;

      const token = speakeasy.totp({
        secret: secret,
        encoding: 'base32',
      });

      await request(app)
        .post('/api/two-factor/enable')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          secret: secret,
          verificationCode: token,
          backupCodes: backupCodes,
        })
        .expect(200);
    });

    it('should disable 2FA with valid TOTP code', async () => {
      const token = speakeasy.totp({
        secret: secret,
        encoding: 'base32',
      });

      const response = await request(app)
        .post('/api/two-factor/disable')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          verificationCode: token,
        })
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify database was updated
      const result = await query(
        'SELECT two_factor_enabled FROM users WHERE id = $1',
        [userId]
      );
      expect(result.rows[0].two_factor_enabled).toBe(false);
    });

    it('should reject invalid TOTP code when disabling', async () => {
      await request(app)
        .post('/api/two-factor/disable')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          verificationCode: '000000',
        })
        .expect(401);
    });
  });

  describe('GET /api/two-factor/status', () => {
    it('should return 2FA status', async () => {
      const response = await request(app)
        .get('/api/two-factor/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('enabled');
      expect(response.body.data.enabled).toBe(false);
    });
  });
});
