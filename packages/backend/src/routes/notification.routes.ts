import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { notificationService } from '../services/notification.service';
import { z } from 'zod';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /notifications
 * Get user notifications with pagination and filtering
 */
router.get('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = parseInt(req.query.offset as string) || 0;
  const unreadOnly = req.query.unreadOnly === 'true';
  const type = req.query.type as string;

  const result = await notificationService.getUserNotifications(req.user!.id, {
    limit,
    offset,
    unreadOnly,
    type,
  });

  res.json({
    success: true,
    data: result,
  });
}));

/**
 * GET /notifications/unread-count
 * Get count of unread notifications
 */
router.get('/unread-count', asyncHandler(async (req: AuthRequest, res: Response) => {
  const count = await notificationService.getUnreadCount(req.user!.id);

  res.json({
    success: true,
    data: { count },
  });
}));

/**
 * PUT /notifications/:id/read
 * Mark notification as read
 */
router.put('/:id/read', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  await notificationService.markAsRead(id, req.user!.id);

  res.json({
    success: true,
    data: {
      message: 'Notification marked as read',
    },
  });
}));

/**
 * PUT /notifications/read-all
 * Mark all notifications as read
 */
router.put('/read-all', asyncHandler(async (req: AuthRequest, res: Response) => {
  await notificationService.markAllAsRead(req.user!.id);

  res.json({
    success: true,
    data: {
      message: 'All notifications marked as read',
    },
  });
}));

/**
 * POST /notifications/:id/archive
 * Archive a notification
 */
router.post('/:id/archive', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  await notificationService.archive(id, req.user!.id);

  res.json({
    success: true,
    data: {
      message: 'Notification archived',
    },
  });
}));

/**
 * DELETE /notifications/:id
 * Delete a notification
 */
router.delete('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  await notificationService.delete(id, req.user!.id);

  res.json({
    success: true,
    data: {
      message: 'Notification deleted',
    },
  });
}));

/**
 * GET /notifications/preferences
 * Get user notification preferences
 */
router.get('/preferences', asyncHandler(async (req: AuthRequest, res: Response) => {
  const preferences = await notificationService.getPreferences(req.user!.id);

  res.json({
    success: true,
    data: preferences,
  });
}));

/**
 * PUT /notifications/preferences
 * Update user notification preferences
 */
const updatePreferencesSchema = z.object({
  email_enabled: z.boolean().optional(),
  push_enabled: z.boolean().optional(),
  in_app_enabled: z.boolean().optional(),
  email_bookings: z.boolean().optional(),
  email_approvals: z.boolean().optional(),
  email_payments: z.boolean().optional(),
  email_messages: z.boolean().optional(),
  email_marketing: z.boolean().optional(),
  email_system: z.boolean().optional(),
  push_bookings: z.boolean().optional(),
  push_approvals: z.boolean().optional(),
  push_payments: z.boolean().optional(),
  push_messages: z.boolean().optional(),
  push_system: z.boolean().optional(),
  email_digest: z.boolean().optional(),
  email_digest_frequency: z.enum(['realtime', 'daily', 'weekly']).optional(),
  quiet_hours_enabled: z.boolean().optional(),
  quiet_hours_start: z.string().optional(),
  quiet_hours_end: z.string().optional(),
  timezone: z.string().optional(),
});

router.put('/preferences', asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = updatePreferencesSchema.parse(req.body);

  await notificationService.updatePreferences(req.user!.id, data);

  res.json({
    success: true,
    data: {
      message: 'Notification preferences updated',
    },
  });
}));

/**
 * POST /notifications/push/subscribe
 * Subscribe to push notifications
 */
const subscribePushSchema = z.object({
  subscription: z.object({
    endpoint: z.string(),
    keys: z.object({
      p256dh: z.string(),
      auth: z.string(),
    }),
  }),
  deviceName: z.string().optional(),
});

router.post('/push/subscribe', asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = subscribePushSchema.parse(req.body);

  await notificationService.subscribePush(
    req.user!.id,
    data.subscription,
    data.deviceName
  );

  res.json({
    success: true,
    data: {
      message: 'Subscribed to push notifications',
    },
  });
}));

/**
 * DELETE /notifications/push/unsubscribe/:subscriptionId
 * Unsubscribe from push notifications
 */
router.delete('/push/unsubscribe/:subscriptionId', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { subscriptionId } = req.params;

  await notificationService.unsubscribePush(req.user!.id, subscriptionId);

  res.json({
    success: true,
    data: {
      message: 'Unsubscribed from push notifications',
    },
  });
}));

/**
 * POST /notifications/send (Admin only)
 * Send a notification to a user
 */
const sendNotificationSchema = z.object({
  user_id: z.string(),
  type: z.string(),
  title: z.string(),
  message: z.string(),
  action_url: z.string().optional(),
  action_text: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
});

router.post('/send', asyncHandler(async (req: AuthRequest, res: Response) => {
  if (req.user!.role !== 'admin') {
    throw new AppError(403, 'FORBIDDEN', 'Admin access required');
  }

  const data = sendNotificationSchema.parse(req.body);

  const notification = await notificationService.send(data);

  res.json({
    success: true,
    data: notification,
  });
}));

export default router;
