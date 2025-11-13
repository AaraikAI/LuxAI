import { Router } from 'express';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { liveUpdatesService, LiveUpdateType, LiveUpdatePriority } from '../services/liveUpdates.service';

const router = Router();

router.use(authenticate);

const createUpdateSchema = z.object({
  itineraryId: z.string().uuid(),
  type: z.nativeEnum(LiveUpdateType),
  title: z.string(),
  message: z.string(),
  priority: z.nativeEnum(LiveUpdatePriority),
  startTime: z.string().datetime(),
  endTime: z.string().datetime().optional(),
  metadata: z.record(z.any()).optional(),
});

router.post('/', asyncHandler(async (req: AuthRequest, res) => {
  const data = createUpdateSchema.parse(req.body);
  const result = await liveUpdatesService.createLiveUpdate({
    ...data,
    clientId: req.user!.id,
    startTime: new Date(data.startTime),
    endTime: data.endTime ? new Date(data.endTime) : undefined,
  });

  res.status(201).json({ success: true, data: result });
}));

router.patch('/:id', asyncHandler(async (req: AuthRequest, res) => {
  const { id } = req.params;
  await liveUpdatesService.updateLiveActivity(id, req.body);
  res.json({ success: true, message: 'Live activity updated' });
}));

router.delete('/:id', asyncHandler(async (req: AuthRequest, res) => {
  const { id } = req.params;
  await liveUpdatesService.endLiveActivity(id);
  res.json({ success: true, message: 'Live activity ended' });
}));

router.get('/itinerary/:itineraryId', asyncHandler(async (req: AuthRequest, res) => {
  const { itineraryId } = req.params;
  const updates = await liveUpdatesService.getActiveLiveUpdates(itineraryId);
  res.json({ success: true, data: updates });
}));

export default router;
