import { Router } from 'express';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler, AppError } from '../middleware/errorHandler';
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
 * GET /gdpr/download/:requestId
 * Download completed data export
 */
router.get(
  '/download/:requestId',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const { requestId } = req.params;
    const { query: db } = await import('../db');

    // Get the export data
    const result = await db(
      `SELECT ef.data, ef.expires_at, dr.user_id, dr.status
       FROM gdpr_export_files ef
       JOIN data_requests dr ON ef.request_id = dr.id
       WHERE ef.request_id = $1`,
      [requestId]
    );

    if (result.rows.length === 0) {
      throw new AppError(404, 'EXPORT_NOT_FOUND', 'Export file not found or expired');
    }

    const exportFile = result.rows[0];

    // Verify the export belongs to the authenticated user
    if (exportFile.user_id !== req.user!.id) {
      throw new AppError(403, 'FORBIDDEN', 'You do not have permission to access this export');
    }

    // Check if export is completed
    if (exportFile.status !== 'completed') {
      throw new AppError(400, 'EXPORT_NOT_READY', 'Export is not yet ready for download');
    }

    // Check if expired
    if (new Date(exportFile.expires_at) < new Date()) {
      throw new AppError(410, 'EXPORT_EXPIRED', 'Export file has expired (7-day limit)');
    }

    // Update downloaded_at timestamp
    await db(
      'UPDATE gdpr_export_files SET downloaded_at = NOW() WHERE request_id = $1',
      [requestId]
    );

    // Send the file
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="gdpr-export-${requestId}.json"`);
    res.send(exportFile.data);
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

// ============================================
// ADMIN ENDPOINTS
// ============================================

/**
 * GET /gdpr/admin/privacy-policies
 * Get all privacy policy versions (admin only)
 */
router.get(
  '/admin/privacy-policies',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    // TODO: Add admin role check
    if (req.user!.role !== 'admin') {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Admin access required',
        },
      });
      return;
    }

    const policies = await gdprService.getAllPrivacyPolicies();

    res.json({
      success: true,
      data: policies,
    });
  })
);

/**
 * POST /gdpr/admin/privacy-policies
 * Create new privacy policy version (admin only)
 */
const createPolicySchema = z.object({
  version: z.string().min(1),
  content: z.string().min(1),
  effective_date: z.string().datetime(),
});

router.post(
  '/admin/privacy-policies',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    if (req.user!.role !== 'admin') {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Admin access required',
        },
      });
      return;
    }

    const data = createPolicySchema.parse(req.body);

    const policy = await gdprService.createPrivacyPolicy({
      version: data.version,
      content: data.content,
      effective_date: new Date(data.effective_date),
      created_by: req.user!.id,
    });

    res.json({
      success: true,
      data: policy,
    });
  })
);

/**
 * POST /gdpr/admin/privacy-policies/:policyId/activate
 * Activate a privacy policy version (admin only)
 */
router.post(
  '/admin/privacy-policies/:policyId/activate',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    if (req.user!.role !== 'admin') {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Admin access required',
        },
      });
      return;
    }

    const { policyId } = req.params;

    await gdprService.activatePrivacyPolicy(policyId);

    res.json({
      success: true,
      data: {
        message: 'Privacy policy activated successfully',
      },
    });
  })
);

/**
 * GET /gdpr/admin/data-requests
 * Get all data requests (admin only)
 */
router.get(
  '/admin/data-requests',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    if (req.user!.role !== 'admin') {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Admin access required',
        },
      });
      return;
    }

    const { status, type } = req.query;

    const requests = await gdprService.getAllDataRequests({
      status: status as string,
      type: type as string,
    });

    res.json({
      success: true,
      data: requests,
    });
  })
);

/**
 * POST /gdpr/admin/data-requests/:requestId/approve
 * Approve a data request (admin only)
 */
const approveRequestSchema = z.object({
  notes: z.string().optional(),
});

router.post(
  '/admin/data-requests/:requestId/approve',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    if (req.user!.role !== 'admin') {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Admin access required',
        },
      });
      return;
    }

    const { requestId } = req.params;
    const { notes } = approveRequestSchema.parse(req.body);

    await gdprService.approveDataRequest(requestId, req.user!.id, notes);

    res.json({
      success: true,
      data: {
        message: 'Data request approved and processing has begun',
      },
    });
  })
);

/**
 * POST /gdpr/admin/data-requests/:requestId/reject
 * Reject a data request (admin only)
 */
const rejectRequestSchema = z.object({
  notes: z.string().min(1),
});

router.post(
  '/admin/data-requests/:requestId/reject',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    if (req.user!.role !== 'admin') {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Admin access required',
        },
      });
      return;
    }

    const { requestId } = req.params;
    const { notes } = rejectRequestSchema.parse(req.body);

    await gdprService.rejectDataRequest(requestId, req.user!.id, notes);

    res.json({
      success: true,
      data: {
        message: 'Data request rejected',
      },
    });
  })
);

export default router;
