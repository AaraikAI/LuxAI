import Queue from 'bull';
import { logger } from '../utils/logger';
import { gdprService } from '../services/gdpr.service';
import { query } from '../db';

// Create GDPR processing queue
const gdprQueue = new Queue('gdpr-processing', {
  redis: process.env.REDIS_URL || 'redis://localhost:6379',
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

// Job data interfaces
interface DataExportJobData {
  requestId: string;
  userId: string;
}

interface DataDeletionJobData {
  requestId: string;
  userId: string;
}

/**
 * Process data export request
 */
gdprQueue.process('export-data', async (job) => {
  const { requestId, userId } = job.data as DataExportJobData;
  logger.info('Processing data export request', { requestId, userId });

  try {
    // Update request status to processing
    await query(
      'UPDATE data_requests SET status = $1, updated_at = NOW() WHERE id = $2',
      ['processing', requestId]
    );

    // Generate export data using existing service method
    const exportData = await (gdprService as any).generateDataExport(userId);

    // Convert to JSON string
    const exportJson = JSON.stringify(exportData, null, 2);
    const exportSize = Buffer.byteLength(exportJson, 'utf8');

    // Store export data and generate download URL
    // In production, upload to S3 or similar and get URL
    const downloadUrl = `/api/gdpr/download/${requestId}`;

    // Update request with completion data
    await query(
      `UPDATE data_requests
       SET status = $1,
           file_url = $2,
           file_size = $3,
           completed_at = NOW(),
           expires_at = NOW() + INTERVAL '7 days',
           result_data = $4,
           updated_at = NOW()
       WHERE id = $5`,
      ['completed', downloadUrl, exportSize, { message: 'Export completed successfully' }, requestId]
    );

    // Store the actual export data temporarily (in production, use S3)
    await query(
      `INSERT INTO gdpr_export_files (request_id, data, created_at, expires_at)
       VALUES ($1, $2, NOW(), NOW() + INTERVAL '7 days')
       ON CONFLICT (request_id) DO UPDATE SET data = $2, created_at = NOW()`,
      [requestId, exportJson]
    );

    logger.info('Data export completed', { requestId, userId, size: exportSize });

    // Send notification to user (if notification service available)
    // await notificationService.send(userId, 'Your data export is ready', downloadUrl);

    return { success: true, downloadUrl, size: exportSize };
  } catch (error: any) {
    logger.error('Data export failed', { error: error.message, requestId, userId });

    // Update request status to failed
    await query(
      `UPDATE data_requests
       SET status = $1, result_data = $2, updated_at = NOW()
       WHERE id = $3`,
      ['failed', { error: error.message }, requestId]
    );

    throw error;
  }
});

/**
 * Process data deletion request
 */
gdprQueue.process('delete-data', async (job) => {
  const { requestId, userId } = job.data as DataDeletionJobData;
  logger.info('Processing data deletion request', { requestId, userId });

  try {
    // Update request status to processing
    await query(
      'UPDATE data_requests SET status = $1, updated_at = NOW() WHERE id = $2',
      ['processing', requestId]
    );

    // Perform data anonymization/deletion
    await query('BEGIN');

    // Anonymize user record
    await query(
      `UPDATE users
       SET email = $1,
           full_name = 'Deleted User',
           phone = NULL,
           kyc_status = 'deleted',
           is_active = false,
           deleted_at = NOW()
       WHERE id = $2`,
      [`deleted_${userId}@anonymized.local`, userId]
    );

    // Anonymize or delete associated data
    // Forum posts - anonymize
    await query(
      `UPDATE forum_posts
       SET author_name = 'Deleted User',
           content = '[Content removed per user request]'
       WHERE user_id = $1`,
      [userId]
    );

    // Forum replies - anonymize
    await query(
      `UPDATE forum_replies
       SET content = '[Content removed per user request]'
       WHERE user_id = $1`,
      [userId]
    );

    // Delete personal documents
    await query('DELETE FROM documents WHERE user_id = $1', [userId]);

    // Delete push subscriptions
    await query('DELETE FROM push_subscriptions WHERE user_id = $1', [userId]);

    // Delete trusted devices
    await query('DELETE FROM trusted_devices WHERE user_id = $1', [userId]);

    // Delete user sessions
    await query('DELETE FROM user_sessions WHERE user_id = $1', [userId]);

    // Anonymize payment intents (keep for audit trail)
    await query(
      `UPDATE payment_intents
       SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{anonymized}', 'true')
       WHERE user_id = $1`,
      [userId]
    );

    // Delete notification preferences
    await query('DELETE FROM notification_preferences WHERE user_id = $1', [userId]);

    // Delete notifications
    await query('DELETE FROM notifications WHERE user_id = $1', [userId]);

    // Keep audit logs for compliance (anonymized)
    await query(
      `UPDATE audit_logs
       SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{anonymized}', 'true')
       WHERE user_id = $1`,
      [userId]
    );

    await query('COMMIT');

    // Update request status to completed
    await query(
      `UPDATE data_requests
       SET status = $1,
           completed_at = NOW(),
           result_data = $2,
           updated_at = NOW()
       WHERE id = $3`,
      ['completed', { message: 'User data successfully deleted and anonymized', deletedAt: new Date() }, requestId]
    );

    logger.info('Data deletion completed', { requestId, userId });

    return { success: true, message: 'User data deleted' };
  } catch (error: any) {
    await query('ROLLBACK');
    logger.error('Data deletion failed', { error: error.message, requestId, userId });

    // Update request status to failed
    await query(
      `UPDATE data_requests
       SET status = $1, result_data = $2, updated_at = NOW()
       WHERE id = $3`,
      ['failed', { error: error.message }, requestId]
    );

    throw error;
  }
});

/**
 * Queue event handlers
 */
gdprQueue.on('completed', (job, result) => {
  logger.info('GDPR job completed', {
    jobId: job.id,
    jobType: job.name,
    result,
  });
});

gdprQueue.on('failed', (job, err) => {
  logger.error('GDPR job failed', {
    jobId: job?.id,
    jobType: job?.name,
    error: err.message,
    attempts: job?.attemptsMade,
  });
});

gdprQueue.on('stalled', (job) => {
  logger.warn('GDPR job stalled', {
    jobId: job.id,
    jobType: job.name,
  });
});

/**
 * Add data export job to queue
 */
export const queueDataExport = async (requestId: string, userId: string) => {
  const job = await gdprQueue.add('export-data', { requestId, userId }, {
    priority: 1,
    delay: 0,
  });

  logger.info('Data export job queued', { jobId: job.id, requestId, userId });
  return job;
};

/**
 * Add data deletion job to queue
 */
export const queueDataDeletion = async (requestId: string, userId: string) => {
  const job = await gdprQueue.add('delete-data', { requestId, userId }, {
    priority: 2, // Higher priority for deletion
    delay: 0,
  });

  logger.info('Data deletion job queued', { jobId: job.id, requestId, userId });
  return job;
};

/**
 * Get queue statistics
 */
export const getGdprQueueStats = async () => {
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    gdprQueue.getWaitingCount(),
    gdprQueue.getActiveCount(),
    gdprQueue.getCompletedCount(),
    gdprQueue.getFailedCount(),
    gdprQueue.getDelayedCount(),
  ]);

  return {
    waiting,
    active,
    completed,
    failed,
    delayed,
    total: waiting + active + completed + failed + delayed,
  };
};

export default gdprQueue;
