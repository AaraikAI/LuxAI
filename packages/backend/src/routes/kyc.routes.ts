import { Router } from 'express';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { kycService, KYCProvider } from '../services/kyc.service';

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

const initiateVerificationSchema = z.object({
  provider: z.nativeEnum(KYCProvider).optional(),
  metadata: z.record(z.any()).optional(),
});

const checkStatusSchema = z.object({
  verificationId: z.string(),
  provider: z.nativeEnum(KYCProvider),
});

const uploadDocumentSchema = z.object({
  type: z.enum(['passport', 'id', 'proof_of_address', 'net_worth_affidavit']),
  frontImageUrl: z.string().url().optional(),
  backImageUrl: z.string().url().optional(),
  metadata: z.record(z.any()).optional(),
});

/**
 * Initiate KYC verification
 * POST /api/kyc/initiate
 */
router.post(
  '/initiate',
  asyncHandler(async (req: AuthRequest, res) => {
    const data = initiateVerificationSchema.parse(req.body);

    const result = await kycService.initiateVerification({
      userId: req.user!.id,
      provider: data.provider,
      metadata: data.metadata,
    });

    res.status(201).json({
      success: true,
      data: result,
    });
  })
);

/**
 * Check KYC verification status
 * POST /api/kyc/status
 */
router.post(
  '/status',
  asyncHandler(async (req: AuthRequest, res) => {
    const data = checkStatusSchema.parse(req.body);

    const result = await kycService.checkVerificationStatus(
      req.user!.id,
      data.verificationId,
      data.provider
    );

    res.json({
      success: true,
      data: result,
    });
  })
);

/**
 * Upload KYC document
 * POST /api/kyc/document
 */
router.post(
  '/document',
  asyncHandler(async (req: AuthRequest, res) => {
    const data = uploadDocumentSchema.parse(req.body);

    const result = await kycService.uploadDocument(req.user!.id, data);

    res.status(201).json({
      success: true,
      data: result,
    });
  })
);

/**
 * Get current user's KYC status
 * GET /api/kyc/me
 */
router.get(
  '/me',
  asyncHandler(async (req: AuthRequest, res) => {
    const { query: dbQuery } = await import('../db');

    const result = await dbQuery(
      'SELECT kyc_status, kyc_verified_at FROM users WHERE id = $1',
      [req.user!.id]
    );

    if (result.rows.length === 0) {
      throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
    }

    res.json({
      success: true,
      data: {
        kycStatus: result.rows[0].kyc_status,
        kycVerifiedAt: result.rows[0].kyc_verified_at,
      },
    });
  })
);

/**
 * Webhook handler for KYC provider callbacks
 * POST /api/kyc/webhook/:provider
 */
router.post(
  '/webhook/:provider',
  asyncHandler(async (req, res) => {
    const provider = req.params.provider as KYCProvider;
    const payload = req.body;

    // Verify webhook signature (implement based on provider)
    // For Persona, use Persona-Signature header
    // For Onfido, use X-Onfido-Signature header

    // Process webhook payload
    // Update user KYC status based on verification result

    res.json({ success: true });
  })
);

export default router;
