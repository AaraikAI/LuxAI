import { Router } from 'express';
import { reportsService } from '../services/reports.service';
import { authenticate } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /reports/itinerary/:id
 * Get itinerary report data
 */
router.get('/itinerary/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const report = await reportsService.generateItineraryReport(id);

    res.json({
      success: true,
      data: report,
    });
  } catch (error: any) {
    logger.error('Failed to generate itinerary report', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'REPORT_GENERATION_FAILED',
        message: error.message,
      },
    });
  }
});

/**
 * GET /reports/itinerary/:id/pdf
 * Export itinerary to PDF
 */
router.get('/itinerary/:id/pdf', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const pdf = await reportsService.exportToPDF(id);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="itinerary-${id}.pdf"`);
    res.send(pdf);
  } catch (error: any) {
    logger.error('Failed to export to PDF', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'PDF_EXPORT_FAILED',
        message: error.message,
      },
    });
  }
});

/**
 * GET /reports/itinerary/:id/csv
 * Export itinerary to CSV
 */
router.get('/itinerary/:id/csv', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const csv = await reportsService.exportToCSV(id);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="itinerary-${id}.csv"`);
    res.send(csv);
  } catch (error: any) {
    logger.error('Failed to export to CSV', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CSV_EXPORT_FAILED',
        message: error.message,
      },
    });
  }
});

/**
 * GET /reports/itinerary/:id/json
 * Export itinerary to JSON
 */
router.get('/itinerary/:id/json', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const json = await reportsService.exportToJSON(id);

    res.json({
      success: true,
      data: json,
    });
  } catch (error: any) {
    logger.error('Failed to export to JSON', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'JSON_EXPORT_FAILED',
        message: error.message,
      },
    });
  }
});

/**
 * POST /reports/itinerary/:id/share
 * Generate shareable link
 */
router.post('/itinerary/:id/share', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const expiresInDays = parseInt(req.body.expiresInDays) || 7;

    const shareLink = await reportsService.generateShareableLink(id, expiresInDays);

    res.json({
      success: true,
      data: { shareLink },
    });
  } catch (error: any) {
    logger.error('Failed to generate shareable link', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SHARE_LINK_FAILED',
        message: error.message,
      },
    });
  }
});

/**
 * GET /reports/share/:token
 * View shared itinerary (public access)
 */
router.get('/share/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const report = await reportsService.getItineraryByShareToken(token);

    if (!report) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'LINK_NOT_FOUND',
          message: 'Share link not found or expired',
        },
      });
    }

    res.json({
      success: true,
      data: report,
    });
  } catch (error: any) {
    logger.error('Failed to get shared itinerary', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SHARED_ITINERARY_FAILED',
        message: error.message,
      },
    });
  }
});

/**
 * GET /reports/analytics
 * Generate analytics report
 */
router.get('/analytics', authenticate, async (req, res) => {
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

    const startDate = new Date(req.query.startDate as string);
    const endDate = new Date(req.query.endDate as string);
    const type = req.query.type as 'revenue' | 'bookings' | 'users';

    const report = await reportsService.generateAnalyticsReport(startDate, endDate, type);

    res.json({
      success: true,
      data: report,
    });
  } catch (error: any) {
    logger.error('Failed to generate analytics report', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ANALYTICS_REPORT_FAILED',
        message: error.message,
      },
    });
  }
});

export default router;
