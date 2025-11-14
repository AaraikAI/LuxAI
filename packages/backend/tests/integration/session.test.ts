import request from 'supertest';
import { app } from '../../src/index';
import { cleanDatabase } from '../setup';
import { query } from '../../src/db';

describe('Session Management', () => {
  let authToken: string;
  let userId: string;
  let sessionId: string;

  beforeEach(async () => {
    await cleanDatabase();

    // Register and login a test user
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'session@test.com',
        password: 'Test123!@#',
        firstName: 'Session',
        lastName: 'User',
        role: 'client',
      });

    userId = registerResponse.body.data.user.id;
    authToken = registerResponse.body.data.token;
  });

  describe('GET /api/sessions', () => {
    it('should list all active sessions', async () => {
      const response = await request(app)
        .get('/api/sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);

      const session = response.body.data[0];
      expect(session).toHaveProperty('id');
      expect(session).toHaveProperty('device_info');
      expect(session).toHaveProperty('ip_address');
      expect(session).toHaveProperty('created_at');
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/sessions')
        .expect(401);
    });
  });

  describe('DELETE /api/sessions/:sessionId', () => {
    beforeEach(async () => {
      // Create an additional session by logging in again
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'session@test.com',
          password: 'Test123!@#',
        });

      // Get sessions to find the session ID
      const sessionsResponse = await request(app)
        .get('/api/sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      if (sessionsResponse.body.data.length > 0) {
        sessionId = sessionsResponse.body.data[0].id;
      }
    });

    it('should revoke a specific session', async () => {
      if (!sessionId) {
        console.log('Warning: No session ID available for test');
        return;
      }

      const response = await request(app)
        .delete(`/api/sessions/${sessionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify session was revoked in database
      const result = await query(
        'SELECT revoked_at FROM user_sessions WHERE id = $1',
        [sessionId]
      );
      expect(result.rows[0].revoked_at).toBeTruthy();
    });

    it('should not allow revoking another user\'s session', async () => {
      // Create another user
      const otherUserResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'other@test.com',
          password: 'Test123!@#',
          firstName: 'Other',
          lastName: 'User',
          role: 'client',
        });

      const otherAuthToken = otherUserResponse.body.data.token;

      // Try to revoke first user's session
      if (sessionId) {
        await request(app)
          .delete(`/api/sessions/${sessionId}`)
          .set('Authorization', `Bearer ${otherAuthToken}`)
          .expect(403);
      }
    });
  });

  describe('POST /api/sessions/revoke-all', () => {
    it('should revoke all sessions except current', async () => {
      // Create multiple sessions by logging in
      await request(app)
        .post('/api/auth/login')
        .send({
          email: 'session@test.com',
          password: 'Test123!@#',
        });

      await request(app)
        .post('/api/auth/login')
        .send({
          email: 'session@test.com',
          password: 'Test123!@#',
        });

      // Revoke all sessions
      const response = await request(app)
        .post('/api/sessions/revoke-all')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('revokedCount');

      // Verify sessions were revoked
      const result = await query(
        'SELECT COUNT(*) as count FROM user_sessions WHERE user_id = $1 AND revoked_at IS NOT NULL',
        [userId]
      );
      expect(parseInt(result.rows[0].count)).toBeGreaterThan(0);
    });
  });

  describe('Trusted Devices', () => {
    describe('GET /api/sessions/trusted-devices', () => {
      it('should list trusted devices', async () => {
        const response = await request(app)
          .get('/api/sessions/trusted-devices')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);
      });
    });

    describe('POST /api/sessions/trust-device', () => {
      it('should trust current device', async () => {
        const response = await request(app)
          .post('/api/sessions/trust-device')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: 'My Laptop',
          })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('id');

        // Verify device was added to database
        const result = await query(
          'SELECT * FROM trusted_devices WHERE user_id = $1',
          [userId]
        );
        expect(result.rows.length).toBeGreaterThan(0);
        expect(result.rows[0].name).toBe('My Laptop');
      });
    });

    describe('DELETE /api/sessions/trusted-devices/:deviceId', () => {
      let deviceId: string;

      beforeEach(async () => {
        // Trust a device first
        const trustResponse = await request(app)
          .post('/api/sessions/trust-device')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: 'Test Device',
          })
          .expect(200);

        deviceId = trustResponse.body.data.id;
      });

      it('should remove a trusted device', async () => {
        const response = await request(app)
          .delete(`/api/sessions/trusted-devices/${deviceId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);

        // Verify device was removed
        const result = await query(
          'SELECT * FROM trusted_devices WHERE id = $1',
          [deviceId]
        );
        expect(result.rows.length).toBe(0);
      });
    });
  });

  describe('Session Limiting', () => {
    it('should enforce maximum session limit', async () => {
      // Create 12 sessions (max is 10, should auto-revoke oldest)
      for (let i = 0; i < 12; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({
            email: 'session@test.com',
            password: 'Test123!@#',
          });
      }

      // Check active sessions
      const result = await query(
        'SELECT COUNT(*) as count FROM user_sessions WHERE user_id = $1 AND revoked_at IS NULL',
        [userId]
      );

      // Should not exceed 10 active sessions
      expect(parseInt(result.rows[0].count)).toBeLessThanOrEqual(10);
    });
  });
});
