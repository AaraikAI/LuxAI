import { Router } from 'express';
import { z } from 'zod';
import { authService } from '../services/auth.service';
import { asyncHandler } from '../middleware/errorHandler';
import { UserRole } from '@luxai/shared';

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: z.nativeEnum(UserRole),
  phone: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const verify2FASchema = z.object({
  tempToken: z.string(),
  code: z.string().length(6).or(z.string().regex(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/)),
  isBackupCode: z.boolean().optional(),
});

router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const data = registerSchema.parse(req.body);
    const result = await authService.register(data);

    res.status(201).json({
      success: true,
      data: result,
    });
  })
);

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const data = loginSchema.parse(req.body);
    const result = await authService.login(data);

    res.json({
      success: true,
      data: result,
    });
  })
);

router.post(
  '/verify-2fa',
  asyncHandler(async (req, res) => {
    const data = verify2FASchema.parse(req.body);
    const result = await authService.verify2FA(
      data.tempToken,
      data.code,
      data.isBackupCode || false
    );

    res.json({
      success: true,
      data: result,
    });
  })
);

router.post(
  '/verify',
  asyncHandler(async (req, res) => {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_TOKEN',
          message: 'Token is required',
        },
      });
    }

    const user = await authService.verifyToken(token);

    res.json({
      success: true,
      data: { user },
    });
  })
);

export default router;
