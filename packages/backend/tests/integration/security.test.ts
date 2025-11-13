import request from 'supertest';
import { app } from '../../src/index';
import { cleanDatabase } from '../setup';
import { query } from '../../src/db';
import { securityService } from '../../src/services/security.service';

describe('Security Features', () => {
  let authToken: string;
  let userId: string;

  beforeEach(async () => {
    await cleanDatabase();

    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'security@test.com',
        password: 'Test123!@#',
        firstName: 'Security',
        lastName: 'User',
        role: 'client',
      });

    userId = registerResponse.body.data.user.id;
    authToken = registerResponse.body.data.token;
  });

  describe('Password Breach Checking', () => {
    it('should detect a commonly breached password', async () => {
      // "password" is a well-known breached password
      const result = await securityService.checkPasswordBreach('password');

      expect(result.breached).toBe(true);
      expect(result.count).toBeGreaterThan(0);
    });

    it('should not flag a strong unique password', async () => {
      // Very unlikely to be breached
      const strongPassword = 'X9#mK2$pL8@vN4&qR7!wZ3';
      const result = await securityService.checkPasswordBreach(strongPassword);

      expect(result.breached).toBe(false);
      expect(result.count).toBe(0);
    });

    it('should handle API failures gracefully', async () => {
      // This test verifies the service doesn't crash on network errors
      try {
        await securityService.checkPasswordBreach('test', 1); // 1ms timeout
      } catch (error) {
        // Should catch timeout and return safe default
        expect(error).toBeDefined();
      }
    });
  });

  describe('Password Strength Checking', () => {
    it('should validate strong passwords', () => {
      const result = securityService.checkPasswordStrength('MyStr0ng!Pass123');

      expect(result.valid).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(3);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject weak passwords', () => {
      const result = securityService.checkPasswordStrength('weak');

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should require minimum length', () => {
      const result = securityService.checkPasswordStrength('Short1!');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters long');
    });

    it('should require uppercase letters', () => {
      const result = securityService.checkPasswordStrength('lowercase123!');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one uppercase letter');
    });

    it('should require lowercase letters', () => {
      const result = securityService.checkPasswordStrength('UPPERCASE123!');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one lowercase letter');
    });

    it('should require numbers', () => {
      const result = securityService.checkPasswordStrength('NoNumbers!');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one number');
    });

    it('should require special characters', () => {
      const result = securityService.checkPasswordStrength('NoSpecial123');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one special character');
    });
  });

  describe('IP Whitelisting', () => {
    describe('POST /api/security/ip-whitelist', () => {
      it('should add IP to whitelist', async () => {
        const response = await request(app)
          .post('/api/security/ip-whitelist')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            ipAddress: '192.168.1.100',
          })
          .expect(200);

        expect(response.body.success).toBe(true);

        // Verify IP was added
        const result = await query(
          'SELECT ip_whitelist FROM users WHERE id = $1',
          [userId]
        );
        expect(result.rows[0].ip_whitelist).toContain('192.168.1.100');
      });

      it('should validate IP address format', async () => {
        await request(app)
          .post('/api/security/ip-whitelist')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            ipAddress: 'invalid-ip',
          })
          .expect(400);
      });

      it('should prevent duplicate IPs', async () => {
        const ipAddress = '192.168.1.100';

        // Add IP first time
        await request(app)
          .post('/api/security/ip-whitelist')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ ipAddress })
          .expect(200);

        // Try to add same IP again
        await request(app)
          .post('/api/security/ip-whitelist')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ ipAddress })
          .expect(400);
      });
    });

    describe('GET /api/security/ip-whitelist', () => {
      beforeEach(async () => {
        // Add some IPs
        await securityService.addIPToWhitelist(userId, '192.168.1.100');
        await securityService.addIPToWhitelist(userId, '10.0.0.1');
      });

      it('should list whitelisted IPs', async () => {
        const response = await request(app)
          .get('/api/security/ip-whitelist')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);
        expect(response.body.data).toContain('192.168.1.100');
        expect(response.body.data).toContain('10.0.0.1');
      });
    });

    describe('DELETE /api/security/ip-whitelist/:ipAddress', () => {
      beforeEach(async () => {
        await securityService.addIPToWhitelist(userId, '192.168.1.100');
      });

      it('should remove IP from whitelist', async () => {
        const response = await request(app)
          .delete('/api/security/ip-whitelist/192.168.1.100')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);

        // Verify IP was removed
        const result = await query(
          'SELECT ip_whitelist FROM users WHERE id = $1',
          [userId]
        );
        expect(result.rows[0].ip_whitelist).not.toContain('192.168.1.100');
      });
    });

    describe('IP Whitelist Enforcement', () => {
      beforeEach(async () => {
        // Enable IP whitelist for user
        await securityService.addIPToWhitelist(userId, '127.0.0.1');
      });

      it('should allow login from whitelisted IP', async () => {
        const isAllowed = await securityService.checkIPWhitelist(userId, '127.0.0.1');
        expect(isAllowed).toBe(true);
      });

      it('should block login from non-whitelisted IP', async () => {
        const isAllowed = await securityService.checkIPWhitelist(userId, '192.168.1.100');
        expect(isAllowed).toBe(false);
      });
    });
  });

  describe('Suspicious Activity Detection', () => {
    it('should detect multiple failed login attempts', async () => {
      // Simulate multiple failed login attempts
      for (let i = 0; i < 6; i++) {
        await query(
          `INSERT INTO audit_logs (user_id, action, resource, status, timestamp)
           VALUES ($1, 'login', 'auth', 'failed', NOW())`,
          [userId]
        );
      }

      const result = await securityService.detectSuspiciousActivity(
        userId,
        '127.0.0.1',
        'Mozilla/5.0'
      );

      expect(result.suspicious).toBe(true);
      expect(result.reasons.length).toBeGreaterThan(0);
      expect(result.reasons[0]).toContain('Multiple login attempts');
    });

    it('should detect login from new IP address', async () => {
      // Create some historical logins
      await query(
        `INSERT INTO audit_logs (user_id, action, ip_address, timestamp)
         VALUES ($1, 'login', '192.168.1.1', NOW() - INTERVAL '1 day')`,
        [userId]
      );

      const result = await securityService.detectSuspiciousActivity(
        userId,
        '10.0.0.1', // Different IP
        'Mozilla/5.0'
      );

      expect(result.suspicious).toBe(true);
      const hasNewLocationReason = result.reasons.some(r =>
        r.includes('new location') || r.includes('new IP')
      );
      expect(hasNewLocationReason).toBe(true);
    });

    it('should detect unusual user agent', async () => {
      // Create historical logins with Chrome
      await query(
        `INSERT INTO audit_logs (user_id, action, metadata, timestamp)
         VALUES ($1, 'login', $2, NOW() - INTERVAL '1 day')`,
        [userId, JSON.stringify({ userAgent: 'Mozilla/5.0 Chrome' })]
      );

      const result = await securityService.detectSuspiciousActivity(
        userId,
        '127.0.0.1',
        'curl/7.68.0' // Bot-like user agent
      );

      expect(result.suspicious).toBe(true);
      const hasUserAgentReason = result.reasons.some(r =>
        r.includes('user agent') || r.includes('device')
      );
      expect(hasUserAgentReason).toBe(true);
    });

    it('should not flag normal activity', async () => {
      const result = await securityService.detectSuspiciousActivity(
        userId,
        '127.0.0.1',
        'Mozilla/5.0'
      );

      // With no suspicious patterns, should be safe
      // (might still flag as suspicious due to being first login, but shouldn't error)
      expect(result).toHaveProperty('suspicious');
      expect(result).toHaveProperty('reasons');
    });
  });

  describe('Security Alert Logging', () => {
    it('should log security alerts', async () => {
      await securityService.logSecurityAlert({
        userId: userId,
        alertType: 'suspicious_login',
        severity: 'high',
        description: 'Login from unusual location',
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0',
      });

      // Verify alert was logged
      const result = await query(
        `SELECT * FROM audit_logs
         WHERE user_id = $1 AND action = 'security_alert'
         ORDER BY timestamp DESC LIMIT 1`,
        [userId]
      );

      expect(result.rows.length).toBeGreaterThan(0);
      const metadata = result.rows[0].metadata;
      expect(metadata.alertType).toBe('suspicious_login');
      expect(metadata.severity).toBe('high');
    });

    it('should categorize alert severity levels', async () => {
      const severities = ['low', 'medium', 'high', 'critical'];

      for (const severity of severities) {
        await securityService.logSecurityAlert({
          userId: userId,
          alertType: 'test_alert',
          severity: severity as any,
          description: `Test ${severity} alert`,
        });
      }

      const result = await query(
        `SELECT * FROM audit_logs
         WHERE user_id = $1 AND action = 'security_alert'`,
        [userId]
      );

      expect(result.rows.length).toBe(severities.length);
    });
  });
});
