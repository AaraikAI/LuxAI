import { Router } from 'express';
import authRoutes from './auth.routes';
import itineraryRoutes from './itinerary.routes';
import kycRoutes from './kyc.routes';
import aviationRoutes from './aviation.routes';
import approvalRoutes from './approval.routes';

const router = Router();

// Health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    },
  });
});

// API routes
router.use('/auth', authRoutes);
router.use('/itineraries', itineraryRoutes);
router.use('/kyc', kycRoutes);
router.use('/aviation', aviationRoutes);
router.use('/approvals', approvalRoutes);

export default router;
