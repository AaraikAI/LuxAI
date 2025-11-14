import { Router } from 'express';
import passport from 'passport';
import { z } from 'zod';
import { samlService } from '../services/saml.service';
import { authService } from '../services/auth.service';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /saml/providers
 * Get list of active SAML providers for login
 */
router.get('/providers', asyncHandler(async (req, res) => {
  const providers = await samlService.getActiveProviders();

  res.json({
    success: true,
    data: providers.map(p => ({
      id: p.id,
      name: p.name,
      entity_id: p.entity_id,
    })),
  });
}));

/**
 * GET /saml/login/:providerId
 * Initiate SAML SSO login
 */
router.get('/login/:providerId', asyncHandler(async (req, res, next) => {
  const { providerId } = req.params;

  const provider = await samlService.getProvider(providerId);
  if (!provider) {
    throw new AppError(404, 'PROVIDER_NOT_FOUND', 'SAML provider not found');
  }

  // Store provider ID in session for callback
  (req.session as any).samlProviderId = providerId;

  const callbackUrl = `${process.env.API_URL || 'http://localhost:3000'}/api/saml/callback/${providerId}`;
  const strategy = samlService.createStrategy(provider, callbackUrl);

  passport.use(`saml-${providerId}`, strategy);

  passport.authenticate(`saml-${providerId}`, {
    failureRedirect: '/login?error=saml_failed',
  })(req, res, next);
}));

/**
 * POST /saml/callback/:providerId
 * SAML SSO callback
 */
router.post('/callback/:providerId', asyncHandler(async (req, res, next) => {
  const { providerId } = req.params;

  const provider = await samlService.getProvider(providerId);
  if (!provider) {
    throw new AppError(404, 'PROVIDER_NOT_FOUND', 'SAML provider not found');
  }

  const callbackUrl = `${process.env.API_URL || 'http://localhost:3000'}/api/saml/callback/${providerId}`;
  const strategy = samlService.createStrategy(provider, callbackUrl);

  passport.use(`saml-${providerId}`, strategy);

  passport.authenticate(`saml-${providerId}`, async (err: any, samlUser: any) => {
    if (err) {
      logger.error('SAML authentication error', { error: err, providerId });
      return res.redirect('/login?error=saml_auth_failed');
    }

    if (!samlUser) {
      logger.error('No SAML user returned', { providerId });
      return res.redirect('/login?error=saml_no_user');
    }

    try {
      // Find or create user
      const { user, isNew } = await samlService.findOrCreateUser(samlUser, provider);

      // Generate JWT token
      const token = authService.generateToken(user);

      // Log successful SSO login
      logger.info('SAML SSO login successful', {
        userId: user.id,
        email: user.email,
        providerId,
        isNewUser: isNew,
      });

      // Redirect to frontend with token
      const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/auth/saml/callback?token=${token}${isNew ? '&new=true' : ''}`;
      res.redirect(redirectUrl);
    } catch (error) {
      logger.error('Failed to process SAML user', { error, providerId });
      res.redirect('/login?error=saml_processing_failed');
    }
  })(req, res, next);
}));

/**
 * GET /saml/metadata
 * Get SAML service provider metadata
 */
router.get('/metadata', asyncHandler(async (req, res) => {
  const entityId = process.env.SAML_ENTITY_ID || 'luxai-designer';
  const callbackUrl = `${process.env.API_URL || 'http://localhost:3000'}/api/saml/callback`;

  const metadata = samlService.generateMetadata({
    entityId,
    callbackUrl,
  });

  res.header('Content-Type', 'application/xml');
  res.send(metadata);
}));

// ============================================
// ADMIN ENDPOINTS
// ============================================

/**
 * GET /saml/admin/providers
 * Get all SAML providers (admin)
 */
router.get('/admin/providers', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  if (req.user!.role !== 'admin') {
    throw new AppError(403, 'FORBIDDEN', 'Admin access required');
  }

  const providers = await samlService.getAllProviders();

  res.json({
    success: true,
    data: providers,
  });
}));

/**
 * POST /saml/admin/providers
 * Create SAML provider (admin)
 */
const createProviderSchema = z.object({
  name: z.string().min(1),
  entity_id: z.string().min(1),
  sso_url: z.string().url(),
  sso_logout_url: z.string().url().optional(),
  certificate: z.string().min(1),
  auto_provision: z.boolean().default(false),
  default_role: z.enum(['client', 'vendor', 'admin']).default('client'),
  attribute_mapping: z.object({
    email: z.string(),
    firstName: z.string(),
    lastName: z.string(),
    displayName: z.string().optional(),
  }),
});

router.post('/admin/providers', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  if (req.user!.role !== 'admin') {
    throw new AppError(403, 'FORBIDDEN', 'Admin access required');
  }

  const data = createProviderSchema.parse(req.body);

  const provider = await samlService.createProvider(data);

  res.json({
    success: true,
    data: provider,
  });
}));

/**
 * PUT /saml/admin/providers/:providerId
 * Update SAML provider (admin)
 */
const updateProviderSchema = z.object({
  name: z.string().min(1).optional(),
  sso_url: z.string().url().optional(),
  sso_logout_url: z.string().url().optional(),
  certificate: z.string().min(1).optional(),
  is_active: z.boolean().optional(),
  auto_provision: z.boolean().optional(),
  default_role: z.enum(['client', 'vendor', 'admin']).optional(),
  attribute_mapping: z.object({
    email: z.string(),
    firstName: z.string(),
    lastName: z.string(),
    displayName: z.string().optional(),
  }).optional(),
});

router.put('/admin/providers/:providerId', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  if (req.user!.role !== 'admin') {
    throw new AppError(403, 'FORBIDDEN', 'Admin access required');
  }

  const { providerId } = req.params;
  const data = updateProviderSchema.parse(req.body);

  await samlService.updateProvider(providerId, data);

  res.json({
    success: true,
    data: {
      message: 'SAML provider updated successfully',
    },
  });
}));

/**
 * DELETE /saml/admin/providers/:providerId
 * Delete SAML provider (admin)
 */
router.delete('/admin/providers/:providerId', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  if (req.user!.role !== 'admin') {
    throw new AppError(403, 'FORBIDDEN', 'Admin access required');
  }

  const { providerId } = req.params;

  await samlService.deleteProvider(providerId);

  res.json({
    success: true,
    data: {
      message: 'SAML provider deleted successfully',
    },
  });
}));

export default router;
