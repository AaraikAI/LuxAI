import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { sessionService } from '../services/session.service';
import { z } from 'zod';

const router = Router();

// Get all active sessions for current user
router.get(
  '/',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const sessions = await sessionService.getUserSessions(req.user!.id);

    res.json({
      success: true,
      data: sessions,
    });
  })
);

// Revoke a specific session
router.delete(
  '/:sessionId',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const { sessionId } = req.params;

    await sessionService.revokeSession(sessionId);

    res.json({
      success: true,
      message: 'Session revoked successfully',
    });
  })
);

// Revoke all sessions except current
router.post(
  '/revoke-all',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    await sessionService.revokeAllUserSessions(req.user!.id);

    res.json({
      success: true,
      message: 'All sessions revoked successfully',
    });
  })
);

// Get trusted devices
router.get(
  '/trusted-devices',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const devices = await sessionService.getTrustedDevices(req.user!.id);

    res.json({
      success: true,
      data: devices,
    });
  })
);

// Trust current device
const trustDeviceSchema = z.object({
  deviceName: z.string().min(1),
});

router.post(
  '/trust-device',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const { deviceName } = trustDeviceSchema.parse(req.body);

    const fingerprint = sessionService.generateDeviceFingerprint(
      req.get('user-agent') || '',
      req.ip || ''
    );

    await sessionService.trustDevice(
      req.user!.id,
      fingerprint.hash,
      deviceName,
      fingerprint.info
    );

    res.json({
      success: true,
      message: 'Device trusted successfully',
    });
  })
);

// Remove trusted device
router.delete(
  '/trusted-devices/:deviceId',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const { deviceId } = req.params;

    await sessionService.removeTrustedDevice(req.user!.id, deviceId);

    res.json({
      success: true,
      message: 'Trusted device removed successfully',
    });
  })
);

export default router;
