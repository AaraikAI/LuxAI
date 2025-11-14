import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { searchService } from '../services/search.service';
import { z } from 'zod';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /search
 * Global search across all entities
 */
router.get('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const filters = {
    query: req.query.q as string,
    entity_type: req.query.type as string,
    limit: parseInt(req.query.limit as string) || 50,
    offset: parseInt(req.query.offset as string) || 0,
  };

  const result = await searchService.globalSearch(req.user!.id, filters);

  res.json({
    success: true,
    data: result,
  });
}));

/**
 * GET /search/history
 * Get user's search history
 */
router.get('/history', asyncHandler(async (req: AuthRequest, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 20;

  const history = await searchService.getSearchHistory(req.user!.id, limit);

  res.json({
    success: true,
    data: history,
  });
}));

/**
 * DELETE /search/history
 * Clear user's search history
 */
router.delete('/history', asyncHandler(async (req: AuthRequest, res: Response) => {
  await searchService.clearSearchHistory(req.user!.id);

  res.json({
    success: true,
    data: {
      message: 'Search history cleared',
    },
  });
}));

/**
 * GET /search/saved
 * Get user's saved searches
 */
router.get('/saved', asyncHandler(async (req: AuthRequest, res: Response) => {
  const savedSearches = await searchService.getSavedSearches(req.user!.id);

  res.json({
    success: true,
    data: savedSearches,
  });
}));

/**
 * POST /search/saved
 * Create saved search
 */
const createSavedSearchSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  query: z.string().optional(),
  filters: z.record(z.any()),
  entity_type: z.string(),
  is_default: z.boolean().optional(),
});

router.post('/saved', asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = createSavedSearchSchema.parse(req.body);

  const savedSearch = await searchService.createSavedSearch({
    ...data,
    user_id: req.user!.id,
  });

  res.json({
    success: true,
    data: savedSearch,
  });
}));

/**
 * PUT /search/saved/:id
 * Update saved search
 */
const updateSavedSearchSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  query: z.string().optional(),
  filters: z.record(z.any()).optional(),
  entity_type: z.string().optional(),
  is_default: z.boolean().optional(),
});

router.put('/saved/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const updates = updateSavedSearchSchema.parse(req.body);

  const savedSearch = await searchService.updateSavedSearch(id, req.user!.id, updates);

  res.json({
    success: true,
    data: savedSearch,
  });
}));

/**
 * DELETE /search/saved/:id
 * Delete saved search
 */
router.delete('/saved/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  await searchService.deleteSavedSearch(id, req.user!.id);

  res.json({
    success: true,
    data: {
      message: 'Saved search deleted',
    },
  });
}));

export default router;
