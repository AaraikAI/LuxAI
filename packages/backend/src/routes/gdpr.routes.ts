import { Router } from 'express';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { gdprService } from '../services/gdpr.service';

const router = Router();

/**
 * POST /gdpr/data-export
 * Request export of all user data (Right to Data Portability)
 */
router.post(
  '/data-export',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const result = await gdprService.requestDataExport(
      req.user!.id,
      req.ip,
      req.get('user-agent')
    );

    res.json({
      success: true,
      data: {
        message: 'Data export request submitted successfully',
        requestId: result.requestId,
        expiresAt: result.expiresAt,
        note: 'You will receive an email when your data is ready to download',
      },
    });
  })
);

/**
 * GET /gdpr/data-export/:requestId
 * Get status of data export request
 */
router.get(
  '/data-export/:requestId',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const { requestId } = req.params;

    const status = await gdprService.getDataRequestStatus(requestId);

    // Verify the request belongs to the authenticated user
    const requestOwner = await gdprService.getDataRequestStatus(requestId);
    // TODO: Add user_id check when we modify the service to return it

    res.json({
      success: true,
      data: status,
    });
  })
);

/**
 * POST /gdpr/data-deletion
 * Request deletion of all user data (Right to be Forgotten)
 */
const deletionSchema = z.object({
  notes: z.string().optional(),
  confirmation: z.literal('DELETE_MY_ACCOUNT'),
});

router.post(
  '/data-deletion',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const { notes, confirmation } = deletionSchema.parse(req.body);

    const result = await gdprService.requestDataDeletion(
      req.user!.id,
      notes
    );

    res.json({
      success: true,
      data: {
        message: 'Deletion request submitted successfully',
        requestId: result.requestId,
        note: 'Your request will be reviewed and processed within 30 days as required by GDPR',
      },
    });
  })
);

/**
 * POST /gdpr/consent
 * Update user consent preferences for cookies/tracking
 */
const consentSchema = z.object({
  necessary: z.boolean().default(true),
  analytics: z.boolean().default(false),
  marketing: z.boolean().default(false),
  functional: z.boolean().default(false),
});

router.post(
  '/consent',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const preferences = consentSchema.parse(req.body);

    await gdprService.logConsent(
      req.user!.id,
      preferences,
      req.ip,
      req.get('user-agent')
    );

    res.json({
      success: true,
      data: {
        message: 'Consent preferences updated successfully',
        preferences,
      },
    });
  })
);

/**
 * GET /gdpr/consent
 * Get current user consent preferences
 */
router.get(
  '/consent',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const preferences = await gdprService.getConsent(req.user!.id);

    res.json({
      success: true,
      data: preferences,
    });
  })
);

/**
 * GET /gdpr/privacy-policy
 * Get active privacy policy
 */
router.get(
  '/privacy-policy',
  asyncHandler(async (_req, res) => {
    const policy = await gdprService.getActivePrivacyPolicy();

    if (!policy) {
      res.status(404).json({
        success: false,
        error: {
          code: 'POLICY_NOT_FOUND',
          message: 'No active privacy policy found',
        },
      });
      return;
    }

    res.json({
      success: true,
      data: policy,
    });
  })
);

/**
 * POST /gdpr/privacy-policy/accept
 * Accept current privacy policy
 */
const acceptPolicySchema = z.object({
  policyId: z.string().uuid(),
});

router.post(
  '/privacy-policy/accept',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const { policyId } = acceptPolicySchema.parse(req.body);

    await gdprService.acceptPrivacyPolicy(
      req.user!.id,
      policyId,
      req.ip,
      req.get('user-agent')
    );

    res.json({
      success: true,
      data: {
        message: 'Privacy policy accepted successfully',
      },
    });
  })
);

/**
 * GET /gdpr/privacy-policy/status
 * Check if user has accepted current privacy policy
 */
router.get(
  '/privacy-policy/status',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const hasAccepted = await gdprService.hasAcceptedCurrentPolicy(req.user!.id);

    res.json({
      success: true,
      data: {
        hasAccepted,
      },
    });
  })
);

export default router;
