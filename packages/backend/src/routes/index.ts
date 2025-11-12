import { Router } from 'express';
import authRoutes from './auth.routes';
import itineraryRoutes from './itinerary.routes';

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

export default router;
