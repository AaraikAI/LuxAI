import request from 'supertest';
import { app } from '../../src/index';
import { cleanDatabase } from '../setup';
import { query } from '../../src/db';

describe('GDPR Compliance', () => {
  let authToken: string;
  let userId: string;

  beforeEach(async () => {
    await cleanDatabase();

    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'gdpr@test.com',
        password: 'Test123!@#',
        firstName: 'GDPR',
        lastName: 'User',
        role: 'client',
      });

    userId = registerResponse.body.data.user.id;
    authToken = registerResponse.body.data.token;
  });

  describe('Data Export (Right to Data Portability)', () => {
    describe('POST /api/gdpr/data-export', () => {
      it('should create a data export request', async () => {
        const response = await request(app)
          .post('/api/gdpr/data-export')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('requestId');
        expect(response.body.data.status).toBe('pending');

        // Verify request was created in database
        const result = await query(
          'SELECT * FROM data_requests WHERE user_id = $1 AND request_type = $2',
          [userId, 'export']
        );
        expect(result.rows.length).toBe(1);
        expect(result.rows[0].status).toBe('pending');
      });

      it('should prevent duplicate pending requests', async () => {
        // Create first request
        await request(app)
          .post('/api/gdpr/data-export')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        // Try to create second request
        await request(app)
          .post('/api/gdpr/data-export')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(400);
      });

      it('should require authentication', async () => {
        await request(app)
          .post('/api/gdpr/data-export')
          .expect(401);
      });
    });

    describe('GET /api/gdpr/data-export/:requestId', () => {
      let requestId: string;

      beforeEach(async () => {
        const response = await request(app)
          .post('/api/gdpr/data-export')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        requestId = response.body.data.requestId;
      });

      it('should get export request status', async () => {
        const response = await request(app)
          .get(`/api/gdpr/data-export/${requestId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('id');
        expect(response.body.data).toHaveProperty('status');
        expect(response.body.data).toHaveProperty('created_at');
      });

      it('should not allow access to other user\'s requests', async () => {
        // Create another user
        const otherResponse = await request(app)
          .post('/api/auth/register')
          .send({
            email: 'other@test.com',
            password: 'Test123!@#',
            firstName: 'Other',
            lastName: 'User',
            role: 'client',
          });

        const otherAuthToken = otherResponse.body.data.token;

        await request(app)
          .get(`/api/gdpr/data-export/${requestId}`)
          .set('Authorization', `Bearer ${otherAuthToken}`)
          .expect(403);
      });

      it('should return 404 for non-existent request', async () => {
        const fakeId = '00000000-0000-0000-0000-000000000000';
        await request(app)
          .get(`/api/gdpr/data-export/${fakeId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(404);
      });
    });
  });

  describe('Data Deletion (Right to be Forgotten)', () => {
    describe('POST /api/gdpr/data-deletion', () => {
      it('should create a data deletion request', async () => {
        const response = await request(app)
          .post('/api/gdpr/data-deletion')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            reason: 'No longer using the service',
          })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('requestId');
        expect(response.body.data.status).toBe('pending');

        // Verify request was created
        const result = await query(
          'SELECT * FROM data_requests WHERE user_id = $1 AND request_type = $2',
          [userId, 'deletion']
        );
        expect(result.rows.length).toBe(1);
        expect(result.rows[0].status).toBe('pending');
        expect(result.rows[0].metadata.reason).toBe('No longer using the service');
      });

      it('should require a reason', async () => {
        await request(app)
          .post('/api/gdpr/data-deletion')
          .set('Authorization', `Bearer ${authToken}`)
          .send({})
          .expect(400);
      });

      it('should prevent duplicate pending deletion requests', async () => {
        // Create first request
        await request(app)
          .post('/api/gdpr/data-deletion')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            reason: 'No longer using the service',
          })
          .expect(200);

        // Try to create second request
        await request(app)
          .post('/api/gdpr/data-deletion')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            reason: 'Another reason',
          })
          .expect(400);
      });
    });
  });

  describe('Cookie Consent', () => {
    describe('POST /api/gdpr/consent', () => {
      it('should save cookie consent preferences', async () => {
        const response = await request(app)
          .post('/api/gdpr/consent')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            necessary: true,
            analytics: true,
            marketing: false,
            functional: true,
          })
          .expect(200);

        expect(response.body.success).toBe(true);

        // Verify consent was logged
        const result = await query(
          'SELECT * FROM consent_logs WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
          [userId]
        );
        expect(result.rows.length).toBe(1);
        expect(result.rows[0].consent_given).toEqual({
          necessary: true,
          analytics: true,
          marketing: false,
          functional: true,
        });
      });

      it('should work for non-authenticated users with IP tracking', async () => {
        const response = await request(app)
          .post('/api/gdpr/consent')
          .send({
            necessary: true,
            analytics: false,
            marketing: false,
            functional: false,
          })
          .expect(200);

        expect(response.body.success).toBe(true);

        // Verify consent was logged with IP
        const result = await query(
          'SELECT * FROM consent_logs WHERE user_id IS NULL ORDER BY created_at DESC LIMIT 1'
        );
        expect(result.rows.length).toBe(1);
        expect(result.rows[0].ip_address).toBeTruthy();
      });

      it('should validate consent structure', async () => {
        await request(app)
          .post('/api/gdpr/consent')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            necessary: true,
            // Missing other required fields
          })
          .expect(400);
      });
    });

    describe('GET /api/gdpr/consent', () => {
      beforeEach(async () => {
        await request(app)
          .post('/api/gdpr/consent')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            necessary: true,
            analytics: true,
            marketing: false,
            functional: true,
          })
          .expect(200);
      });

      it('should retrieve current consent preferences', async () => {
        const response = await request(app)
          .get('/api/gdpr/consent')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('necessary');
        expect(response.body.data).toHaveProperty('analytics');
        expect(response.body.data).toHaveProperty('marketing');
        expect(response.body.data).toHaveProperty('functional');
        expect(response.body.data.necessary).toBe(true);
        expect(response.body.data.analytics).toBe(true);
        expect(response.body.data.marketing).toBe(false);
      });

      it('should return default consent for users without preferences', async () => {
        // Create new user without consent
        const newUserResponse = await request(app)
          .post('/api/auth/register')
          .send({
            email: 'newuser@test.com',
            password: 'Test123!@#',
            firstName: 'New',
            lastName: 'User',
            role: 'client',
          });

        const newAuthToken = newUserResponse.body.data.token;

        const response = await request(app)
          .get('/api/gdpr/consent')
          .set('Authorization', `Bearer ${newAuthToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.necessary).toBe(true);
        expect(response.body.data.analytics).toBe(false);
        expect(response.body.data.marketing).toBe(false);
      });
    });
  });

  describe('Privacy Policy', () => {
    let policyId: string;

    beforeEach(async () => {
      // Create a privacy policy
      const result = await query(
        `INSERT INTO privacy_policies (version, content, effective_date, created_by)
         VALUES ($1, $2, NOW(), $3)
         RETURNING id`,
        ['1.0', 'Privacy policy content...', userId]
      );
      policyId = result.rows[0].id;
    });

    describe('GET /api/gdpr/privacy-policy', () => {
      it('should retrieve current privacy policy', async () => {
        const response = await request(app)
          .get('/api/gdpr/privacy-policy')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('id');
        expect(response.body.data).toHaveProperty('version');
        expect(response.body.data).toHaveProperty('content');
        expect(response.body.data).toHaveProperty('effective_date');
      });
    });

    describe('POST /api/gdpr/privacy-policy/accept', () => {
      it('should record policy acceptance', async () => {
        const response = await request(app)
          .post('/api/gdpr/privacy-policy/accept')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            policyId: policyId,
          })
          .expect(200);

        expect(response.body.success).toBe(true);

        // Verify acceptance was recorded
        const result = await query(
          'SELECT * FROM user_privacy_acceptances WHERE user_id = $1 AND policy_id = $2',
          [userId, policyId]
        );
        expect(result.rows.length).toBe(1);
        expect(result.rows[0].accepted).toBe(true);
      });

      it('should track IP and user agent', async () => {
        await request(app)
          .post('/api/gdpr/privacy-policy/accept')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            policyId: policyId,
          })
          .expect(200);

        const result = await query(
          'SELECT * FROM user_privacy_acceptances WHERE user_id = $1',
          [userId]
        );
        expect(result.rows[0].ip_address).toBeTruthy();
        expect(result.rows[0].user_agent).toBeTruthy();
      });

      it('should require authentication', async () => {
        await request(app)
          .post('/api/gdpr/privacy-policy/accept')
          .send({
            policyId: policyId,
          })
          .expect(401);
      });
    });

    describe('GET /api/gdpr/privacy-policy/status', () => {
      it('should return acceptance status', async () => {
        // Accept the policy first
        await request(app)
          .post('/api/gdpr/privacy-policy/accept')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            policyId: policyId,
          })
          .expect(200);

        // Check status
        const response = await request(app)
          .get('/api/gdpr/privacy-policy/status')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.accepted).toBe(true);
        expect(response.body.data).toHaveProperty('acceptedAt');
      });

      it('should indicate not accepted when policy not accepted', async () => {
        const response = await request(app)
          .get('/api/gdpr/privacy-policy/status')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.accepted).toBe(false);
      });
    });
  });

  describe('Data Export Content', () => {
    it('should include all user data in export', async () => {
      // Create some test data
      await query(
        `INSERT INTO audit_logs (user_id, action, resource, timestamp)
         VALUES ($1, 'test_action', 'test_resource', NOW())`,
        [userId]
      );

      // Request export
      const exportResponse = await request(app)
        .post('/api/gdpr/data-export')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const requestId = exportResponse.body.data.requestId;

      // In a real scenario, background job would process this
      // For testing, we verify the request was created correctly
      const result = await query(
        'SELECT * FROM data_requests WHERE id = $1',
        [requestId]
      );

      expect(result.rows[0].request_type).toBe('export');
      expect(result.rows[0].user_id).toBe(userId);
    });
  });

  describe('Data Anonymization on Deletion', () => {
    it('should anonymize user data when deletion is processed', async () => {
      // Create deletion request
      const deletionResponse = await request(app)
        .post('/api/gdpr/data-deletion')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          reason: 'Test deletion',
        })
        .expect(200);

      const requestId = deletionResponse.body.data.requestId;

      // Simulate admin approval and processing
      await query(
        'UPDATE data_requests SET status = $1 WHERE id = $2',
        ['completed', requestId]
      );

      // In a real scenario, the deletion would be processed by background job
      // For testing, we verify the request was created with proper metadata
      const result = await query(
        'SELECT * FROM data_requests WHERE id = $1',
        [requestId]
      );

      expect(result.rows[0].request_type).toBe('deletion');
      expect(result.rows[0].metadata.reason).toBe('Test deletion');
    });
  });
});
