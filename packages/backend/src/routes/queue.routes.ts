import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import {
  getEmailQueueStats,
  getFailedEmailJobs,
  retryFailedEmail,
  cleanEmailQueue,
  pauseEmailQueue,
  resumeEmailQueue,
  queueEmail,
} from '../queues/email.queue';

const router = Router();

// All routes require admin authentication
router.use(authenticate);

/**
 * GET /queue/email/stats
 * Get email queue statistics (admin only)
 */
router.get('/email/stats', asyncHandler(async (req: AuthRequest, res: Response) => {
  if (req.user!.role !== 'admin') {
    throw new AppError(403, 'FORBIDDEN', 'Admin access required');
  }

  const stats = await getEmailQueueStats();

  res.json({
    success: true,
    data: stats,
  });
}));

/**
 * GET /queue/email/failed
 * Get failed email jobs (admin only)
 */
router.get('/email/failed', asyncHandler(async (req: AuthRequest, res: Response) => {
  if (req.user!.role !== 'admin') {
    throw new AppError(403, 'FORBIDDEN', 'Admin access required');
  }

  const start = parseInt(req.query.start as string) || 0;
  const end = parseInt(req.query.end as string) || 50;

  const jobs = await getFailedEmailJobs(start, end);

  res.json({
    success: true,
    data: jobs,
  });
}));

/**
 * POST /queue/email/retry/:jobId
 * Retry a failed email job (admin only)
 */
router.post('/email/retry/:jobId', asyncHandler(async (req: AuthRequest, res: Response) => {
  if (req.user!.role !== 'admin') {
    throw new AppError(403, 'FORBIDDEN', 'Admin access required');
  }

  const { jobId } = req.params;

  await retryFailedEmail(jobId);

  res.json({
    success: true,
    data: {
      message: 'Email job retried successfully',
    },
  });
}));

/**
 * POST /queue/email/clean
 * Clean old completed/failed jobs (admin only)
 */
router.post('/email/clean', asyncHandler(async (req: AuthRequest, res: Response) => {
  if (req.user!.role !== 'admin') {
    throw new AppError(403, 'FORBIDDEN', 'Admin access required');
  }

  const grace = parseInt(req.body.grace) || 24 * 3600 * 1000; // 24 hours default

  await cleanEmailQueue(grace);

  res.json({
    success: true,
    data: {
      message: 'Email queue cleaned successfully',
    },
  });
}));

/**
 * POST /queue/email/pause
 * Pause email queue processing (admin only)
 */
router.post('/email/pause', asyncHandler(async (req: AuthRequest, res: Response) => {
  if (req.user!.role !== 'admin') {
    throw new AppError(403, 'FORBIDDEN', 'Admin access required');
  }

  await pauseEmailQueue();

  res.json({
    success: true,
    data: {
      message: 'Email queue paused',
    },
  });
}));

/**
 * POST /queue/email/resume
 * Resume email queue processing (admin only)
 */
router.post('/email/resume', asyncHandler(async (req: AuthRequest, res: Response) => {
  if (req.user!.role !== 'admin') {
    throw new AppError(403, 'FORBIDDEN', 'Admin access required');
  }

  await resumeEmailQueue();

  res.json({
    success: true,
    data: {
      message: 'Email queue resumed',
    },
  });
}));

/**
 * POST /queue/email/test
 * Send a test email via queue (admin only)
 */
router.post('/email/test', asyncHandler(async (req: AuthRequest, res: Response) => {
  if (req.user!.role !== 'admin') {
    throw new AppError(403, 'FORBIDDEN', 'Admin access required');
  }

  const { to, subject, message } = req.body;

  if (!to || !subject || !message) {
    throw new AppError(400, 'INVALID_INPUT', 'Missing required fields: to, subject, message');
  }

  const job = await queueEmail({
    to,
    subject,
    html: `<p>${message}</p>`,
    text: message,
    priority: 'normal',
    metadata: {
      test: true,
      sentBy: req.user!.id,
    },
  });

  res.json({
    success: true,
    data: {
      message: 'Test email queued successfully',
      jobId: job.id,
    },
  });
}));

export default router;
