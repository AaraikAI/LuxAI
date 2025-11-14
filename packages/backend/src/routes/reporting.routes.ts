import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { reportingService } from '../services/reporting.service';
import { z } from 'zod';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /reporting/templates
 * Get all report templates
 */
router.get('/templates', asyncHandler(async (req: AuthRequest, res: Response) => {
  const category = req.query.category as string;

  const templates = await reportingService.getTemplates(category);

  res.json({
    success: true,
    data: templates,
  });
}));

/**
 * POST /reporting/templates
 * Create report template (admin only)
 */
const createTemplateSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  category: z.string(),
  config: z.record(z.any()),
});

router.post('/templates', asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = createTemplateSchema.parse(req.body);

  const template = await reportingService.createTemplate({
    ...data,
    created_by: req.user!.id,
  });

  res.json({
    success: true,
    data: template,
  });
}));

/**
 * GET /reporting/reports
 * Get user's custom reports
 */
router.get('/reports', asyncHandler(async (req: AuthRequest, res: Response) => {
  const reports = await reportingService.getUserReports(req.user!.id);

  res.json({
    success: true,
    data: reports,
  });
}));

/**
 * POST /reporting/reports
 * Create custom report
 */
const createReportSchema = z.object({
  template_id: z.string().optional(),
  name: z.string(),
  description: z.string().optional(),
  config: z.record(z.any()),
  is_scheduled: z.boolean().optional(),
  schedule_cron: z.string().optional(),
});

router.post('/reports', asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = createReportSchema.parse(req.body);

  const report = await reportingService.createReport({
    ...data,
    user_id: req.user!.id,
  });

  res.json({
    success: true,
    data: report,
  });
}));

/**
 * PUT /reporting/reports/:id
 * Update custom report
 */
const updateReportSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  config: z.record(z.any()).optional(),
  is_scheduled: z.boolean().optional(),
  schedule_cron: z.string().optional(),
  is_active: z.boolean().optional(),
});

router.put('/reports/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const updates = updateReportSchema.parse(req.body);

  const report = await reportingService.updateReport(id, req.user!.id, updates);

  res.json({
    success: true,
    data: report,
  });
}));

/**
 * DELETE /reporting/reports/:id
 * Delete custom report
 */
router.delete('/reports/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  await reportingService.deleteReport(id, req.user!.id);

  res.json({
    success: true,
    data: {
      message: 'Report deleted successfully',
    },
  });
}));

/**
 * POST /reporting/reports/:id/execute
 * Execute report
 */
router.post('/reports/:id/execute', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const execution = await reportingService.executeReport(id, req.user!.id);

  res.json({
    success: true,
    data: execution,
  });
}));

/**
 * GET /reporting/reports/:id/history
 * Get report execution history
 */
router.get('/reports/:id/history', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const limit = parseInt(req.query.limit as string) || 20;

  const history = await reportingService.getExecutionHistory(id, req.user!.id, limit);

  res.json({
    success: true,
    data: history,
  });
}));

/**
 * GET /reporting/executions/:id
 * Get execution details
 */
router.get('/executions/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const execution = await reportingService.getExecution(id, req.user!.id);

  res.json({
    success: true,
    data: execution,
  });
}));

export default router;
