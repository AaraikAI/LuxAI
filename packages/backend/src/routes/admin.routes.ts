import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { adminService } from '../services/admin.service';
import { z } from 'zod';

const router = Router();

// All routes require admin authentication
router.use(authenticate);
router.use((req: AuthRequest, _res, next) => {
  if (req.user!.role !== 'admin') {
    throw new AppError(403, 'FORBIDDEN', 'Admin access required');
  }
  next();
});

/**
 * GET /admin/users
 * Get all users with filters
 */
router.get('/users', asyncHandler(async (req: AuthRequest, res: Response) => {
  const filters = {
    role: req.query.role as string,
    is_verified: req.query.is_verified === 'true' ? true : req.query.is_verified === 'false' ? false : undefined,
    is_active: req.query.is_active === 'true' ? true : req.query.is_active === 'false' ? false : undefined,
    search: req.query.search as string,
    limit: parseInt(req.query.limit as string) || 50,
    offset: parseInt(req.query.offset as string) || 0,
  };

  const result = await adminService.getUsers(filters);

  res.json({
    success: true,
    data: result,
  });
}));

/**
 * GET /admin/users/:id
 * Get user by ID
 */
router.get('/users/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const user = await adminService.getUserById(id);

  res.json({
    success: true,
    data: user,
  });
}));

/**
 * PUT /admin/users/:id
 * Update user
 */
const updateUserSchema = z.object({
  full_name: z.string().optional(),
  role: z.enum(['client', 'designer', 'vendor', 'admin']).optional(),
  is_verified: z.boolean().optional(),
  is_active: z.boolean().optional(),
});

router.put('/users/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const updates = updateUserSchema.parse(req.body);

  const user = await adminService.updateUser(id, updates);

  res.json({
    success: true,
    data: user,
  });
}));

/**
 * DELETE /admin/users/:id
 * Delete user
 */
router.delete('/users/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  await adminService.deleteUser(id);

  res.json({
    success: true,
    data: {
      message: 'User deleted successfully',
    },
  });
}));

/**
 * POST /admin/users/:id/reset-password
 * Reset user password
 */
const resetPasswordSchema = z.object({
  newPassword: z.string().min(8),
});

router.post('/users/:id/reset-password', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { newPassword } = resetPasswordSchema.parse(req.body);

  await adminService.resetUserPassword(id, newPassword);

  res.json({
    success: true,
    data: {
      message: 'Password reset successfully',
    },
  });
}));

/**
 * POST /admin/users/:id/unlock
 * Unlock user account
 */
router.post('/users/:id/unlock', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  await adminService.unlockAccount(id);

  res.json({
    success: true,
    data: {
      message: 'Account unlocked successfully',
    },
  });
}));

/**
 * GET /admin/stats
 * Get system statistics
 */
router.get('/stats', asyncHandler(async (req: AuthRequest, res: Response) => {
  const stats = await adminService.getSystemStats();

  res.json({
    success: true,
    data: stats,
  });
}));

/**
 * GET /admin/config
 * Get system configuration
 */
router.get('/config', asyncHandler(async (req: AuthRequest, res: Response) => {
  const config = await adminService.getSystemConfig();

  res.json({
    success: true,
    data: config,
  });
}));

/**
 * PUT /admin/config/:key
 * Update system configuration
 */
const updateConfigSchema = z.object({
  value: z.any(),
  description: z.string().optional(),
});

router.put('/config/:key', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { key } = req.params;
  const { value, description } = updateConfigSchema.parse(req.body);

  await adminService.updateSystemConfig(key, value, req.user!.id, description);

  res.json({
    success: true,
    data: {
      message: 'Configuration updated successfully',
    },
  });
}));

/**
 * GET /admin/feature-flags
 * Get all feature flags
 */
router.get('/feature-flags', asyncHandler(async (req: AuthRequest, res: Response) => {
  const flags = await adminService.getFeatureFlags();

  res.json({
    success: true,
    data: flags,
  });
}));

/**
 * POST /admin/feature-flags
 * Create feature flag
 */
const createFeatureFlagSchema = z.object({
  name: z.string(),
  key: z.string(),
  description: z.string().optional(),
  is_enabled: z.boolean().optional(),
  rollout_percentage: z.number().min(0).max(100).optional(),
  target_users: z.array(z.string()).optional(),
  target_roles: z.array(z.string()).optional(),
});

router.post('/feature-flags', asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = createFeatureFlagSchema.parse(req.body);

  const flag = await adminService.createFeatureFlag(data);

  res.json({
    success: true,
    data: flag,
  });
}));

/**
 * PUT /admin/feature-flags/:id
 * Update feature flag
 */
const updateFeatureFlagSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  is_enabled: z.boolean().optional(),
  rollout_percentage: z.number().min(0).max(100).optional(),
  target_users: z.array(z.string()).optional(),
  target_roles: z.array(z.string()).optional(),
});

router.put('/feature-flags/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const updates = updateFeatureFlagSchema.parse(req.body);

  const flag = await adminService.updateFeatureFlag(id, updates);

  res.json({
    success: true,
    data: flag,
  });
}));

/**
 * DELETE /admin/feature-flags/:id
 * Delete feature flag
 */
router.delete('/feature-flags/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  await adminService.deleteFeatureFlag(id);

  res.json({
    success: true,
    data: {
      message: 'Feature flag deleted successfully',
    },
  });
}));

/**
 * GET /admin/feature-flags/check/:key
 * Check if feature is enabled for user (public endpoint for checking flags)
 */
router.get('/feature-flags/check/:key', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { key } = req.params;
  const userId = req.query.userId as string;
  const userRole = req.query.userRole as string;

  const isEnabled = await adminService.isFeatureEnabled(key, userId, userRole);

  res.json({
    success: true,
    data: {
      enabled: isEnabled,
    },
  });
}));

export default router;
