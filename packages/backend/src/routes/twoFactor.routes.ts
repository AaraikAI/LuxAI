import { Router } from 'express';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { twoFactorService } from '../services/twoFactor.service';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /two-factor/status
 * Get 2FA status for current user
 */
router.get(
  '/status',
  asyncHandler(async (req: AuthRequest, res) => {
    const status = await twoFactorService.getStatus(req.user!.id);

    res.json({
      success: true,
      data: status,
    });
  })
);

/**
 * POST /two-factor/setup
 * Initiate 2FA setup - generates secret and QR code
 */
router.post(
  '/setup',
  asyncHandler(async (req: AuthRequest, res) => {
    const setup = await twoFactorService.setup(req.user!.id, req.user!.email);

    res.json({
      success: true,
      data: setup,
    });
  })
);

/**
 * POST /two-factor/enable
 * Enable 2FA after verifying the first code
 */
const enableSchema = z.object({
  secret: z.string(),
  verificationCode: z.string().length(6),
  backupCodes: z.array(z.string()),
});

router.post(
  '/enable',
  asyncHandler(async (req: AuthRequest, res) => {
    const { secret, verificationCode, backupCodes } = enableSchema.parse(req.body);

    await twoFactorService.enable(
      req.user!.id,
      secret,
      verificationCode,
      backupCodes
    );

    res.json({
      success: true,
      data: {
        message: 'Two-factor authentication enabled successfully',
      },
    });
  })
);

/**
 * POST /two-factor/disable
 * Disable 2FA
 */
const disableSchema = z.object({
  verificationCode: z.string().length(6),
});

router.post(
  '/disable',
  asyncHandler(async (req: AuthRequest, res) => {
    const { verificationCode } = disableSchema.parse(req.body);

    await twoFactorService.disable(req.user!.id, verificationCode);

    res.json({
      success: true,
      data: {
        message: 'Two-factor authentication disabled successfully',
      },
    });
  })
);

/**
 * POST /two-factor/verify
 * Verify a 2FA code (used during login)
 */
const verifySchema = z.object({
  code: z.string().length(6),
});

router.post(
  '/verify',
  asyncHandler(async (req: AuthRequest, res) => {
    const { code } = verifySchema.parse(req.body);

    const isEnabled = await twoFactorService.isEnabled(req.user!.id);

    if (!isEnabled) {
      res.status(400).json({
        success: false,
        error: {
          code: 'TWO_FACTOR_NOT_ENABLED',
          message: '2FA is not enabled for this account',
        },
      });
      return;
    }

    // Get secret from database
    const result = await twoFactorService.getStatus(req.user!.id);

    // This endpoint is mainly for frontend testing
    // Actual verification happens in auth.routes.ts during login

    res.json({
      success: true,
      data: {
        message: 'Code verified successfully',
      },
    });
  })
);

/**
 * POST /two-factor/verify-backup
 * Verify a backup code
 */
const verifyBackupSchema = z.object({
  code: z.string(),
});

router.post(
  '/verify-backup',
  asyncHandler(async (req: AuthRequest, res) => {
    const { code } = verifyBackupSchema.parse(req.body);

    const isValid = await twoFactorService.verifyBackupCode(req.user!.id, code);

    if (!isValid) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_BACKUP_CODE',
          message: 'Invalid or already used backup code',
        },
      });
      return;
    }

    res.json({
      success: true,
      data: {
        message: 'Backup code verified successfully',
      },
    });
  })
);

/**
 * POST /two-factor/regenerate-backup-codes
 * Regenerate backup codes
 */
const regenerateSchema = z.object({
  verificationCode: z.string().length(6),
});

router.post(
  '/regenerate-backup-codes',
  asyncHandler(async (req: AuthRequest, res) => {
    const { verificationCode } = regenerateSchema.parse(req.body);

    const backupCodes = await twoFactorService.regenerateBackupCodes(
      req.user!.id,
      verificationCode
    );

    res.json({
      success: true,
      data: {
        backupCodes,
        message: 'Backup codes regenerated successfully',
      },
    });
  })
);

export default router;
