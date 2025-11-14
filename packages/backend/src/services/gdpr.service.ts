import { query } from '../db';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

interface DataExportResult {
  requestId: string;
  downloadUrl?: string;
  expiresAt: Date;
}

interface ConsentPreferences {
  necessary: boolean;
  analytics: boolean;
  marketing: boolean;
  functional: boolean;
}

interface UserData {
  profile: any;
  itineraries: any[];
  bookings: any[];
  payments: any[];
  documents: any[];
  forum_posts: any[];
  ratings: any[];
  consent_logs: any[];
}

export class GDPRService {
  /**
   * Request data export for a user (Right to Data Portability)
   */
  async requestDataExport(
    userId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<DataExportResult> {
    try {
      // Check for existing pending requests
      const existing = await query(
        `SELECT id, status FROM data_requests
         WHERE user_id = $1 AND type = 'export' AND status IN ('pending', 'processing')
         ORDER BY created_at DESC LIMIT 1`,
        [userId]
      );

      if (existing.rows.length > 0) {
        throw new AppError(
          400,
          'EXPORT_IN_PROGRESS',
          'A data export request is already in progress'
        );
      }

      // Create new export request
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days to download

      const result = await query(
        `INSERT INTO data_requests (user_id, type, status, expires_at)
         VALUES ($1, 'export', 'pending', $2)
         RETURNING id, expires_at`,
        [userId, expiresAt]
      );

      const requestId = result.rows[0].id;

      // Process export asynchronously
      this.processDataExport(requestId, userId).catch((error) => {
        logger.error('Data export processing failed', { error, requestId, userId });
      });

      return {
        requestId,
        expiresAt: result.rows[0].expires_at,
      };
    } catch (error) {
      logger.error('Failed to request data export', { error, userId });
      throw error;
    }
  }

  /**
   * Process data export asynchronously
   */
  private async processDataExport(requestId: string, userId: string): Promise<void> {
    try {
      // Update status to processing
      await query(
        `UPDATE data_requests SET status = 'processing' WHERE id = $1`,
        [requestId]
      );

      // Gather all user data
      const userData = await this.gatherUserData(userId);

      // In production, upload to S3 or cloud storage
      // For now, we'll store the JSON and provide a mock URL
      const dataJson = JSON.stringify(userData, null, 2);

      // Mock download URL - in production, upload to S3 and generate signed URL
      const downloadUrl = `/api/gdpr/download/${requestId}`;

      // Update request with completion
      await query(
        `UPDATE data_requests
         SET status = 'completed', completed_at = CURRENT_TIMESTAMP, download_url = $1
         WHERE id = $2`,
        [downloadUrl, requestId]
      );

      logger.info('Data export completed', { requestId, userId, dataSize: dataJson.length });
    } catch (error) {
      logger.error('Data export processing failed', { error, requestId, userId });

      await query(
        `UPDATE data_requests
         SET status = 'failed', notes = $1
         WHERE id = $2`,
        [error instanceof Error ? error.message : 'Unknown error', requestId]
      );
    }
  }

  /**
   * Gather all user data for export
   */
  private async gatherUserData(userId: string): Promise<UserData> {
    // Get user profile
    const userResult = await query(
      `SELECT id, email, role, first_name, last_name, phone, kyc_status,
              two_factor_enabled, created_at, updated_at
       FROM users WHERE id = $1`,
      [userId]
    );

    const profile = userResult.rows[0];

    // Get client data if applicable
    if (profile.role === 'client') {
      const clientResult = await query(
        `SELECT net_worth, preferences, live_updates_enabled, created_at
         FROM clients WHERE id = $1`,
        [userId]
      );
      if (clientResult.rows.length > 0) {
        profile.client_data = clientResult.rows[0];
      }
    }

    // Get designer data if applicable
    if (profile.role === 'designer') {
      const designerResult = await query(
        `SELECT agency_id, specializations, certifications, experience_years, created_at
         FROM designers WHERE id = $1`,
        [userId]
      );
      if (designerResult.rows.length > 0) {
        profile.designer_data = designerResult.rows[0];
      }
    }

    // Get itineraries
    const itineraries = await query(
      `SELECT * FROM itineraries WHERE client_id = $1 OR designer_id = $1`,
      [userId]
    );

    // Get documents
    const documents = await query(
      `SELECT id, type, name, mime_type, size, status, created_at
       FROM documents WHERE user_id = $1`,
      [userId]
    );

    // Get payment history
    const payments = await query(
      `SELECT pi.id, pi.amount, pi.currency, pi.status, pi.payment_method, pi.created_at
       FROM payment_intents pi
       JOIN quotes q ON pi.quote_id = q.id
       WHERE q.client_id = $1`,
      [userId]
    );

    // Get forum activity
    const forumPosts = await query(
      `SELECT id, title, content, category, tags, created_at
       FROM forum_posts WHERE author_id = $1`,
      [userId]
    );

    const forumReplies = await query(
      `SELECT id, post_id, content, created_at
       FROM forum_replies WHERE author_id = $1`,
      [userId]
    );

    // Get ratings and reviews
    const ratings = await query(
      `SELECT id, vendor_id, rating, review, created_at
       FROM ratings WHERE client_id = $1`,
      [userId]
    );

    // Get consent logs
    const consentLogs = await query(
      `SELECT consent_type, granted, created_at
       FROM consent_logs WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );

    return {
      profile,
      itineraries: itineraries.rows,
      bookings: [], // TODO: add bookings when implemented
      payments: payments.rows,
      documents: documents.rows,
      forum_posts: forumPosts.rows.concat(forumReplies.rows),
      ratings: ratings.rows,
      consent_logs: consentLogs.rows,
    };
  }

  /**
   * Request data deletion (Right to be Forgotten)
   */
  async requestDataDeletion(
    userId: string,
    notes?: string
  ): Promise<{ requestId: string }> {
    try {
      // Check for existing pending deletion requests
      const existing = await query(
        `SELECT id FROM data_requests
         WHERE user_id = $1 AND type = 'deletion' AND status = 'pending'`,
        [userId]
      );

      if (existing.rows.length > 0) {
        throw new AppError(
          400,
          'DELETION_REQUEST_EXISTS',
          'A deletion request is already pending'
        );
      }

      // Create deletion request - requires manual review before processing
      const result = await query(
        `INSERT INTO data_requests (user_id, type, status, notes)
         VALUES ($1, 'deletion', 'pending', $2)
         RETURNING id`,
        [userId, notes || 'User requested account deletion']
      );

      logger.info('Data deletion requested', { userId, requestId: result.rows[0].id });

      return { requestId: result.rows[0].id };
    } catch (error) {
      logger.error('Failed to request data deletion', { error, userId });
      throw error;
    }
  }

  /**
   * Process data deletion (admin-approved)
   */
  async processDataDeletion(
    requestId: string,
    processedBy: string
  ): Promise<void> {
    try {
      // Get request details
      const requestResult = await query(
        `SELECT user_id FROM data_requests WHERE id = $1 AND type = 'deletion'`,
        [requestId]
      );

      if (requestResult.rows.length === 0) {
        throw new AppError(404, 'REQUEST_NOT_FOUND', 'Deletion request not found');
      }

      const userId = requestResult.rows[0].user_id;

      // Start transaction for data deletion
      await query('BEGIN');

      try {
        // Option 1: Hard delete (complete removal)
        // This would cascade delete most data due to foreign keys
        // await query('DELETE FROM users WHERE id = $1', [userId]);

        // Option 2: Soft delete with anonymization (recommended for audit trails)
        await query(
          `UPDATE users
           SET email = $1,
               first_name = 'Deleted',
               last_name = 'User',
               phone = NULL,
               password_hash = 'DELETED',
               two_factor_secret = NULL,
               backup_codes = NULL
           WHERE id = $2`,
          [`deleted_${userId}@deleted.local`, userId]
        );

        // Anonymize forum posts
        await query(
          `UPDATE forum_posts
           SET is_anonymous = true, pseudonym = 'Deleted User'
           WHERE author_id = $1`,
          [userId]
        );

        await query(
          `UPDATE forum_replies
           SET is_anonymous = true, pseudonym = 'Deleted User'
           WHERE author_id = $1`,
          [userId]
        );

        // Mark request as completed
        await query(
          `UPDATE data_requests
           SET status = 'completed', completed_at = CURRENT_TIMESTAMP, processed_by = $1
           WHERE id = $2`,
          [processedBy, requestId]
        );

        await query('COMMIT');

        logger.info('Data deletion completed', { requestId, userId, processedBy });
      } catch (error) {
        await query('ROLLBACK');
        throw error;
      }
    } catch (error) {
      logger.error('Failed to process data deletion', { error, requestId });
      throw error;
    }
  }

  /**
   * Log user consent preferences
   */
  async logConsent(
    userId: string,
    preferences: ConsentPreferences,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    try {
      const consentTypes = Object.entries(preferences);

      for (const [consentType, granted] of consentTypes) {
        await query(
          `INSERT INTO consent_logs (user_id, consent_type, granted, ip_address, user_agent)
           VALUES ($1, $2, $3, $4, $5)`,
          [userId, consentType, granted, ipAddress, userAgent]
        );
      }

      logger.info('Consent logged', { userId, preferences });
    } catch (error) {
      logger.error('Failed to log consent', { error, userId });
      throw error;
    }
  }

  /**
   * Get current user consent preferences
   */
  async getConsent(userId: string): Promise<ConsentPreferences> {
    try {
      const result = await query(
        `SELECT DISTINCT ON (consent_type) consent_type, granted
         FROM consent_logs
         WHERE user_id = $1
         ORDER BY consent_type, created_at DESC`,
        [userId]
      );

      const preferences: ConsentPreferences = {
        necessary: true, // Always true
        analytics: false,
        marketing: false,
        functional: false,
      };

      for (const row of result.rows) {
        preferences[row.consent_type as keyof ConsentPreferences] = row.granted;
      }

      return preferences;
    } catch (error) {
      logger.error('Failed to get consent', { error, userId });
      throw error;
    }
  }

  /**
   * Get active privacy policy
   */
  async getActivePrivacyPolicy(): Promise<any> {
    try {
      const result = await query(
        `SELECT id, version, content, effective_date
         FROM privacy_policies
         WHERE is_active = true
         ORDER BY effective_date DESC
         LIMIT 1`
      );

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0];
    } catch (error) {
      logger.error('Failed to get active privacy policy', { error });
      throw error;
    }
  }

  /**
   * Record privacy policy acceptance
   */
  async acceptPrivacyPolicy(
    userId: string,
    policyId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    try {
      await query(
        `INSERT INTO user_privacy_acceptances (user_id, policy_id, ip_address, user_agent)
         VALUES ($1, $2, $3, $4)`,
        [userId, policyId, ipAddress, userAgent]
      );

      logger.info('Privacy policy accepted', { userId, policyId });
    } catch (error) {
      logger.error('Failed to record privacy policy acceptance', { error, userId });
      throw error;
    }
  }

  /**
   * Check if user has accepted current privacy policy
   */
  async hasAcceptedCurrentPolicy(userId: string): Promise<boolean> {
    try {
      const result = await query(
        `SELECT COUNT(*) as count
         FROM user_privacy_acceptances upa
         JOIN privacy_policies pp ON upa.policy_id = pp.id
         WHERE upa.user_id = $1 AND pp.is_active = true`,
        [userId]
      );

      return parseInt(result.rows[0].count) > 0;
    } catch (error) {
      logger.error('Failed to check privacy policy acceptance', { error, userId });
      return false;
    }
  }

  /**
   * Get data request status
   */
  async getDataRequestStatus(requestId: string): Promise<any> {
    try {
      const result = await query(
        `SELECT id, type, status, requested_at, completed_at, expires_at, download_url, notes
         FROM data_requests
         WHERE id = $1`,
        [requestId]
      );

      if (result.rows.length === 0) {
        throw new AppError(404, 'REQUEST_NOT_FOUND', 'Data request not found');
      }

      return result.rows[0];
    } catch (error) {
      logger.error('Failed to get data request status', { error, requestId });
      throw error;
    }
  }

  // ============================================
  // ADMIN METHODS
  // ============================================

  /**
   * Get all privacy policy versions (admin)
   */
  async getAllPrivacyPolicies(): Promise<any[]> {
    try {
      const result = await query(
        `SELECT id, version, content, effective_date, created_at, created_by, is_active
         FROM privacy_policies
         ORDER BY created_at DESC`
      );

      return result.rows;
    } catch (error) {
      logger.error('Failed to get all privacy policies', { error });
      throw error;
    }
  }

  /**
   * Create new privacy policy version (admin)
   */
  async createPrivacyPolicy(data: {
    version: string;
    content: string;
    effective_date: Date;
    created_by: string;
  }): Promise<any> {
    try {
      const result = await query(
        `INSERT INTO privacy_policies (version, content, effective_date, created_by, is_active)
         VALUES ($1, $2, $3, $4, false)
         RETURNING id, version, content, effective_date, created_at, created_by, is_active`,
        [data.version, data.content, data.effective_date, data.created_by]
      );

      logger.info('Privacy policy created', {
        policyId: result.rows[0].id,
        version: data.version,
        createdBy: data.created_by,
      });

      return result.rows[0];
    } catch (error) {
      logger.error('Failed to create privacy policy', { error, data });
      throw error;
    }
  }

  /**
   * Activate a privacy policy version (admin)
   */
  async activatePrivacyPolicy(policyId: string): Promise<void> {
    try {
      // Deactivate all existing policies
      await query('UPDATE privacy_policies SET is_active = false');

      // Activate the specified policy
      const result = await query(
        `UPDATE privacy_policies
         SET is_active = true
         WHERE id = $1
         RETURNING id, version`,
        [policyId]
      );

      if (result.rows.length === 0) {
        throw new AppError(404, 'POLICY_NOT_FOUND', 'Privacy policy not found');
      }

      logger.info('Privacy policy activated', {
        policyId,
        version: result.rows[0].version,
      });
    } catch (error) {
      logger.error('Failed to activate privacy policy', { error, policyId });
      throw error;
    }
  }

  /**
   * Get all data requests with filters (admin)
   */
  async getAllDataRequests(filters?: {
    status?: string;
    type?: string;
  }): Promise<any[]> {
    try {
      let sql = `
        SELECT dr.*, u.email as user_email, u.first_name || ' ' || u.last_name as user_name
        FROM data_requests dr
        LEFT JOIN users u ON dr.user_id = u.id
        WHERE 1=1
      `;
      const params: any[] = [];
      let paramIndex = 1;

      if (filters?.status) {
        sql += ` AND dr.status = $${paramIndex++}`;
        params.push(filters.status);
      }

      if (filters?.type) {
        sql += ` AND dr.request_type = $${paramIndex++}`;
        params.push(filters.type);
      }

      sql += ' ORDER BY dr.created_at DESC';

      const result = await query(sql, params);

      return result.rows;
    } catch (error) {
      logger.error('Failed to get all data requests', { error, filters });
      throw error;
    }
  }

  /**
   * Approve a data request (admin)
   */
  async approveDataRequest(
    requestId: string,
    adminId: string,
    notes?: string
  ): Promise<void> {
    try {
      const result = await query(
        `UPDATE data_requests
         SET status = 'processing',
             metadata = jsonb_set(
               COALESCE(metadata, '{}'::jsonb),
               '{approved_by}',
               $2::jsonb
             ),
             metadata = jsonb_set(
               metadata,
               '{approved_at}',
               $3::jsonb
             ),
             metadata = jsonb_set(
               metadata,
               '{notes}',
               $4::jsonb
             )
         WHERE id = $1 AND status = 'pending'
         RETURNING id, request_type, user_id`,
        [requestId, JSON.stringify(adminId), JSON.stringify(new Date().toISOString()), JSON.stringify(notes || '')]
      );

      if (result.rows.length === 0) {
        throw new AppError(404, 'REQUEST_NOT_FOUND', 'Data request not found or already processed');
      }

      const request = result.rows[0];

      logger.info('Data request approved', {
        requestId,
        type: request.request_type,
        userId: request.user_id,
        approvedBy: adminId,
      });

      // TODO: Trigger background job to process the request
      // For export: generate data export file
      // For deletion: anonymize user data
    } catch (error) {
      logger.error('Failed to approve data request', { error, requestId, adminId });
      throw error;
    }
  }

  /**
   * Reject a data request (admin)
   */
  async rejectDataRequest(
    requestId: string,
    adminId: string,
    notes: string
  ): Promise<void> {
    try {
      const result = await query(
        `UPDATE data_requests
         SET status = 'rejected',
             metadata = jsonb_set(
               COALESCE(metadata, '{}'::jsonb),
               '{rejected_by}',
               $2::jsonb
             ),
             metadata = jsonb_set(
               metadata,
               '{rejected_at}',
               $3::jsonb
             ),
             metadata = jsonb_set(
               metadata,
               '{rejection_reason}',
               $4::jsonb
             )
         WHERE id = $1 AND status = 'pending'
         RETURNING id, request_type, user_id`,
        [requestId, JSON.stringify(adminId), JSON.stringify(new Date().toISOString()), JSON.stringify(notes)]
      );

      if (result.rows.length === 0) {
        throw new AppError(404, 'REQUEST_NOT_FOUND', 'Data request not found or already processed');
      }

      const request = result.rows[0];

      logger.info('Data request rejected', {
        requestId,
        type: request.request_type,
        userId: request.user_id,
        rejectedBy: adminId,
        reason: notes,
      });

      // TODO: Send notification to user about rejection
    } catch (error) {
      logger.error('Failed to reject data request', { error, requestId, adminId });
      throw error;
    }
  }
}

export const gdprService = new GDPRService();
