import express, { Response } from 'express';
import { z } from 'zod';
import { securityService } from '../services/security.service';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// IP Whitelist Management
const addIPSchema = z.object({
  ipAddress: z.string().ip(),
});

router.post(
  '/ip-whitelist',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { ipAddress } = addIPSchema.parse(req.body);
    await securityService.addIPToWhitelist(req.user!.id, ipAddress);
    res.json({
      success: true,
      data: { message: 'IP address added to whitelist' },
    });
  })
);

router.get(
  '/ip-whitelist',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const ipList = await securityService.getWhitelistedIPs(req.user!.id);
    res.json({
      success: true,
      data: ipList,
    });
  })
);

router.delete(
  '/ip-whitelist/:ipAddress',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { ipAddress } = req.params;
    await securityService.removeIPFromWhitelist(req.user!.id, ipAddress);
    res.json({
      success: true,
      data: { message: 'IP address removed from whitelist' },
    });
  })
);

// Password Breach Check
const checkPasswordSchema = z.object({
  password: z.string().min(1),
});

router.post(
  '/check-password-breach',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { password } = checkPasswordSchema.parse(req.body);
    const result = await securityService.checkPasswordBreach(password);
    res.json({
      success: true,
      data: result,
    });
  })
);

// Password Strength Check
router.post(
  '/check-password-strength',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { password } = checkPasswordSchema.parse(req.body);
    const result = securityService.checkPasswordStrength(password);
    res.json({
      success: true,
      data: result,
    });
  })
);

// Suspicious Activity Detection
router.get(
  '/suspicious-activity',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';

    const result = await securityService.detectSuspiciousActivity(
      req.user!.id,
      ipAddress,
      userAgent
    );

    res.json({
      success: true,
      data: result,
    });
  })
);

// Security Alerts
router.get(
  '/alerts',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 50;

    const result = await securityService.getSecurityAlerts(req.user!.id, limit);

    res.json({
      success: true,
      data: result,
    });
  })
);

export default router;
