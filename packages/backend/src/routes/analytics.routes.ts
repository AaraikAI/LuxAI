import { Router } from 'express';
import { analyticsService } from '../services/analytics.service';
import { authenticate } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /analytics/user/:id
 * Get analytics for a specific user
 */
router.get('/user/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const requestingUserId = (req as any).user.id;

    // Users can only see their own analytics (unless admin)
    if (id !== requestingUserId && (req as any).user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You can only view your own analytics',
        },
      });
    }

    const analytics = await analyticsService.getUserAnalytics(id);

    res.json({
      success: true,
      data: analytics,
    });
  } catch (error: any) {
    logger.error('Failed to get user analytics', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'GET_USER_ANALYTICS_FAILED',
        message: error.message,
      },
    });
  }
});

/**
 * GET /analytics/vendor/:id
 * Get analytics for a specific vendor
 */
router.get('/vendor/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const analytics = await analyticsService.getVendorAnalytics(id);

    res.json({
      success: true,
      data: analytics,
    });
  } catch (error: any) {
    logger.error('Failed to get vendor analytics', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'GET_VENDOR_ANALYTICS_FAILED',
        message: error.message,
      },
    });
  }
});

/**
 * GET /analytics/platform
 * Get platform-wide analytics (admin only)
 */
router.get('/platform', authenticate, async (req, res) => {
  try {
    // Check if user is admin
    if ((req as any).user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Admin access required',
        },
      });
    }

    const analytics = await analyticsService.getPlatformAnalytics();

    res.json({
      success: true,
      data: analytics,
    });
  } catch (error: any) {
    logger.error('Failed to get platform analytics', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'GET_PLATFORM_ANALYTICS_FAILED',
        message: error.message,
      },
    });
  }
});

/**
 * GET /analytics/timeseries
 * Get time-series data for charts
 */
router.get('/timeseries', authenticate, async (req, res) => {
  try {
    const metric = req.query.metric as 'revenue' | 'users' | 'itineraries' | 'bookings';
    const startDate = new Date(req.query.startDate as string);
    const endDate = new Date(req.query.endDate as string);
    const granularity = (req.query.granularity as 'day' | 'week' | 'month') || 'day';

    if (!metric || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PARAMETERS',
          message: 'metric, startDate, and endDate are required',
        },
      });
    }

    const data = await analyticsService.getTimeSeriesData(metric, startDate, endDate, granularity);

    res.json({
      success: true,
      data,
    });
  } catch (error: any) {
    logger.error('Failed to get time series data', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'GET_TIMESERIES_FAILED',
        message: error.message,
      },
    });
  }
});

export default router;
