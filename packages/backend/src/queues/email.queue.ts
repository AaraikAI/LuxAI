import Queue, { Job, JobOptions } from 'bull';
import { emailService } from '../services/email.service';
import { logger } from '../utils/logger';
import { config } from '../config';

export interface EmailJobData {
  to: string | string[];
  subject: string;
  template?: string;
  context?: Record<string, any>;
  html?: string;
  text?: string;
  attachments?: Array<{
    filename: string;
    content?: string | Buffer;
    path?: string;
  }>;
  priority?: 'high' | 'normal' | 'low';
  userId?: string;
  metadata?: Record<string, any>;
}

// Create Bull queue for email processing
export const emailQueue = new Queue<EmailJobData>('email', config.redis.url, {
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      age: 24 * 3600, // Keep completed jobs for 24 hours
      count: 1000, // Keep last 1000 completed jobs
    },
    removeOnFail: {
      age: 7 * 24 * 3600, // Keep failed jobs for 7 days
    },
  },
});

/**
 * Email queue processor
 */
emailQueue.process(5, async (job: Job<EmailJobData>) => {
  const { data } = job;

  logger.info('Processing email job', {
    jobId: job.id,
    to: data.to,
    subject: data.subject,
    template: data.template,
    attempt: job.attemptsMade + 1,
  });

  try {
    // Send email using the email service
    const result = await emailService.sendEmail({
      to: data.to,
      subject: data.subject,
      template: data.template,
      data: data.context,
      html: data.html,
      text: data.text,
      attachments: data.attachments,
    });

    logger.info('Email sent successfully', {
      jobId: job.id,
      to: data.to,
      messageId: result.messageId,
    });

    return {
      success: true,
      messageId: result.messageId,
      timestamp: new Date().toISOString(),
    };
  } catch (error: any) {
    logger.error('Failed to send email', {
      jobId: job.id,
      to: data.to,
      subject: data.subject,
      error: error.message,
      attempt: job.attemptsMade + 1,
    });

    // Determine if error is retryable
    if (
      error.code === 'ECONNREFUSED' ||
      error.code === 'ETIMEDOUT' ||
      error.code === 'ENOTFOUND' ||
      error.responseCode >= 500
    ) {
      // Retryable error - will be retried automatically
      throw error;
    } else {
      // Non-retryable error (e.g., invalid recipient)
      logger.error('Non-retryable email error', {
        jobId: job.id,
        error: error.message,
      });

      // Move to failed queue
      throw new Error(`Non-retryable: ${error.message}`);
    }
  }
});

/**
 * Event listeners for monitoring
 */
emailQueue.on('completed', (job: Job, result: any) => {
  logger.info('Email job completed', {
    jobId: job.id,
    to: job.data.to,
    messageId: result.messageId,
  });
});

emailQueue.on('failed', (job: Job, error: Error) => {
  logger.error('Email job failed', {
    jobId: job.id,
    to: job.data.to,
    subject: job.data.subject,
    attempts: job.attemptsMade,
    error: error.message,
  });

  // TODO: Send alert to admin if critical email failed
  if (job.data.priority === 'high') {
    logger.error('High priority email failed', {
      jobId: job.id,
      to: job.data.to,
      subject: job.data.subject,
    });
  }
});

emailQueue.on('stalled', (job: Job) => {
  logger.warn('Email job stalled', {
    jobId: job.id,
    to: job.data.to,
  });
});

emailQueue.on('error', (error: Error) => {
  logger.error('Email queue error', { error: error.message });
});

/**
 * Add email to queue
 */
export async function queueEmail(data: EmailJobData, options?: JobOptions): Promise<Job<EmailJobData>> {
  const jobOptions: JobOptions = {
    ...options,
  };

  // Set priority
  if (data.priority === 'high') {
    jobOptions.priority = 1;
  } else if (data.priority === 'low') {
    jobOptions.priority = 10;
  } else {
    jobOptions.priority = 5; // normal
  }

  // Add job ID for tracking
  if (data.userId) {
    jobOptions.jobId = `email-${data.userId}-${Date.now()}`;
  }

  const job = await emailQueue.add(data, jobOptions);

  logger.info('Email queued', {
    jobId: job.id,
    to: data.to,
    subject: data.subject,
    priority: data.priority || 'normal',
  });

  return job;
}

/**
 * Queue templated email
 */
export async function queueTemplatedEmail(
  to: string | string[],
  subject: string,
  template: string,
  context: Record<string, any>,
  options?: Partial<EmailJobData> & JobOptions
): Promise<Job<EmailJobData>> {
  return queueEmail(
    {
      to,
      subject,
      template,
      context,
      ...options,
    },
    options
  );
}

/**
 * Get queue stats
 */
export async function getEmailQueueStats() {
  const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
    emailQueue.getWaitingCount(),
    emailQueue.getActiveCount(),
    emailQueue.getCompletedCount(),
    emailQueue.getFailedCount(),
    emailQueue.getDelayedCount(),
    emailQueue.getPausedCount(),
  ]);

  return {
    waiting,
    active,
    completed,
    failed,
    delayed,
    paused,
    total: waiting + active + completed + failed + delayed + paused,
  };
}

/**
 * Get failed jobs
 */
export async function getFailedEmailJobs(start = 0, end = 10) {
  const jobs = await emailQueue.getFailed(start, end);
  return jobs.map(job => ({
    id: job.id,
    data: job.data,
    failedReason: job.failedReason,
    attemptsMade: job.attemptsMade,
    timestamp: job.timestamp,
  }));
}

/**
 * Retry failed job
 */
export async function retryFailedEmail(jobId: string): Promise<void> {
  const job = await emailQueue.getJob(jobId);
  if (!job) {
    throw new Error('Job not found');
  }

  await job.retry();
  logger.info('Email job retried', { jobId });
}

/**
 * Clean old jobs
 */
export async function cleanEmailQueue(grace: number = 24 * 3600 * 1000): Promise<void> {
  await emailQueue.clean(grace, 'completed');
  await emailQueue.clean(grace, 'failed');
  logger.info('Email queue cleaned', { grace });
}

/**
 * Pause email queue (for maintenance)
 */
export async function pauseEmailQueue(): Promise<void> {
  await emailQueue.pause();
  logger.info('Email queue paused');
}

/**
 * Resume email queue
 */
export async function resumeEmailQueue(): Promise<void> {
  await emailQueue.resume();
  logger.info('Email queue resumed');
}

/**
 * Graceful shutdown
 */
export async function closeEmailQueue(): Promise<void> {
  await emailQueue.close();
  logger.info('Email queue closed');
}
