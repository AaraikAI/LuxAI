import { Router } from 'express';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { sustainabilityService } from '../services/sustainability.service';

const router = Router();

router.use(authenticate);

const calculateSchema = z.object({
  itineraryId: z.string().uuid(),
  flights: z.array(z.object({
    distance: z.number(),
    aircraftType: z.string(),
    passengers: z.number(),
    flightClass: z.enum(['economy', 'business', 'first', 'private']).optional(),
  })),
  accommodations: z.array(z.object({
    nights: z.number(),
    hotelCategory: z.enum(['budget', 'standard', 'luxury', 'ultra-luxury']),
    rooms: z.number(),
  })),
  groundTransportation: z.array(z.object({
    distance: z.number(),
    vehicleType: z.enum(['sedan', 'suv', 'luxury-car', 'electric', 'yacht']),
  })),
  activities: z.array(z.object({
    type: z.string(),
    duration: z.number(),
    participants: z.number(),
  })),
});

router.post('/calculate', asyncHandler(async (req: AuthRequest, res) => {
  const data = calculateSchema.parse(req.body);
  const report = await sustainabilityService.calculateCarbonFootprint(data);
  res.json({ success: true, data: report });
}));

router.get('/report/:itineraryId', asyncHandler(async (req: AuthRequest, res) => {
  const { itineraryId } = req.params;
  const report = await sustainabilityService.getSustainabilityReport(itineraryId);
  res.json({ success: true, data: report });
}));

router.post('/offset/purchase', asyncHandler(async (req: AuthRequest, res) => {
  const { itineraryId, offsetAmount } = req.body;
  const result = await sustainabilityService.purchaseCarbonOffset(
    itineraryId,
    req.user!.id,
    offsetAmount
  );
  res.json({ success: true, data: result });
}));

export default router;
