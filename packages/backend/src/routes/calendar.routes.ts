import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { calendarService } from '../services/calendar.service';
import { z } from 'zod';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /calendar/connections
 * Get user's calendar connections
 */
router.get('/connections', asyncHandler(async (req: AuthRequest, res: Response) => {
  const connections = await calendarService.getConnections(req.user!.id);

  res.json({
    success: true,
    data: connections,
  });
}));

/**
 * POST /calendar/connections
 * Connect calendar provider
 */
const connectProviderSchema = z.object({
  provider: z.enum(['google', 'outlook', 'apple']),
  provider_account_id: z.string(),
  provider_account_email: z.string(),
  access_token: z.string(),
  refresh_token: z.string(),
  token_expires_at: z.string(),
  calendar_id: z.string().optional(),
  calendar_name: z.string().optional(),
});

router.post('/connections', asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = connectProviderSchema.parse(req.body);

  const connection = await calendarService.connectProvider({
    ...data,
    user_id: req.user!.id,
    token_expires_at: new Date(data.token_expires_at),
  });

  res.json({
    success: true,
    data: connection,
  });
}));

/**
 * DELETE /calendar/connections/:id
 * Disconnect calendar provider
 */
router.delete('/connections/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  await calendarService.disconnectProvider(id, req.user!.id);

  res.json({
    success: true,
    data: {
      message: 'Calendar provider disconnected',
    },
  });
}));

/**
 * PUT /calendar/connections/:id/sync
 * Toggle calendar sync
 */
const toggleSyncSchema = z.object({
  enabled: z.boolean(),
});

router.put('/connections/:id/sync', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { enabled } = toggleSyncSchema.parse(req.body);

  await calendarService.toggleSync(id, req.user!.id, enabled);

  res.json({
    success: true,
    data: {
      message: `Calendar sync ${enabled ? 'enabled' : 'disabled'}`,
    },
  });
}));

/**
 * POST /calendar/sync/:itineraryId
 * Sync itinerary to calendar
 */
const syncItinerarySchema = z.object({
  connection_id: z.string(),
});

router.post('/sync/:itineraryId', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { itineraryId } = req.params;
  const { connection_id } = syncItinerarySchema.parse(req.body);

  await calendarService.syncItineraryToCalendar(itineraryId, connection_id, req.user!.id);

  res.json({
    success: true,
    data: {
      message: 'Itinerary synced to calendar',
    },
  });
}));

/**
 * GET /calendar/connections/:id/events
 * Get synced events for connection
 */
router.get('/connections/:id/events', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const events = await calendarService.getSyncedEvents(id, req.user!.id);

  res.json({
    success: true,
    data: events,
  });
}));

/**
 * GET /calendar/export/:itineraryId
 * Export itinerary as iCal file
 */
router.get('/export/:itineraryId', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { itineraryId } = req.params;

  const icalContent = await calendarService.exportItineraryAsICal(itineraryId, req.user!.id);

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="itinerary-${itineraryId}.ics"`);
  res.send(icalContent);
}));

export default router;
