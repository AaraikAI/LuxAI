import { Router } from 'express';
import { z } from 'zod';
import { authenticate, AuthRequest, authorize } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { amalfiService } from '../services/amalfi.service';
import { UserRole } from '@luxai/shared';

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

const submitRFQSchema = z.object({
  legs: z.array(z.object({
    origin: z.object({
      code: z.string(),
      name: z.string().optional(),
    }),
    destination: z.object({
      code: z.string(),
      name: z.string().optional(),
    }),
    departureTime: z.string().datetime(),
    passengers: z.number().min(1).max(19),
    pets: z.number().optional(),
    catering: z.array(z.object({
      category: z.string(),
      items: z.array(z.string()),
      specialRequests: z.string().optional(),
    })).optional(),
  })).min(1),
  aircraftPreference: z.string().optional(),
  flexibilityHours: z.number().optional(),
  specialRequests: z.string().optional(),
});

const searchEmptyLegsSchema = z.object({
  origin: z.string().optional(),
  destination: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  radiusMiles: z.number().optional(),
  maxPrice: z.number().optional(),
});

const bookFlightSchema = z.object({
  quoteId: z.string(),
});

/**
 * Get Amalfi Jets provider information
 * GET /api/aviation/provider
 */
router.get(
  '/provider',
  asyncHandler(async (req: AuthRequest, res) => {
    const providerInfo = amalfiService.getProviderInfo();

    res.json({
      success: true,
      data: providerInfo,
    });
  })
);

/**
 * Submit Request for Quote (RFQ)
 * POST /api/aviation/rfq
 */
router.post(
  '/rfq',
  authorize(UserRole.CLIENT, UserRole.DESIGNER),
  asyncHandler(async (req: AuthRequest, res) => {
    const data = submitRFQSchema.parse(req.body);

    // Convert string dates to Date objects
    const legs = data.legs.map(leg => ({
      ...leg,
      departureTime: new Date(leg.departureTime),
    }));

    const result = await amalfiService.submitRFQ({
      clientId: req.user!.id,
      legs,
      aircraftPreference: data.aircraftPreference,
      flexibilityHours: data.flexibilityHours,
      specialRequests: data.specialRequests,
    });

    res.status(201).json({
      success: true,
      data: result,
      message: 'RFQ submitted successfully. You will receive a quote within 2 hours during business hours.',
    });
  })
);

/**
 * Get quote by RFQ ID
 * GET /api/aviation/quote/:rfqId
 */
router.get(
  '/quote/:rfqId',
  authorize(UserRole.CLIENT, UserRole.DESIGNER),
  asyncHandler(async (req: AuthRequest, res) => {
    const { rfqId } = req.params;

    const quote = await amalfiService.getQuote(rfqId);

    res.json({
      success: true,
      data: quote,
    });
  })
);

/**
 * Search for empty legs
 * POST /api/aviation/empty-legs/search
 */
router.post(
  '/empty-legs/search',
  authorize(UserRole.CLIENT, UserRole.DESIGNER),
  asyncHandler(async (req: AuthRequest, res) => {
    const data = searchEmptyLegsSchema.parse(req.body);

    const emptyLegs = await amalfiService.searchEmptyLegs({
      origin: data.origin,
      destination: data.destination,
      startDate: data.startDate ? new Date(data.startDate) : undefined,
      endDate: data.endDate ? new Date(data.endDate) : undefined,
      radiusMiles: data.radiusMiles,
      maxPrice: data.maxPrice,
    });

    res.json({
      success: true,
      data: emptyLegs,
      meta: {
        count: emptyLegs.length,
      },
    });
  })
);

/**
 * Get available aircraft
 * GET /api/aviation/aircraft
 */
router.get(
  '/aircraft',
  authorize(UserRole.CLIENT, UserRole.DESIGNER),
  asyncHandler(async (req: AuthRequest, res) => {
    const aircraft = await amalfiService.getAvailableAircraft();

    res.json({
      success: true,
      data: aircraft,
      meta: {
        count: aircraft.length,
      },
    });
  })
);

/**
 * Book a flight
 * POST /api/aviation/book
 */
router.post(
  '/book',
  authorize(UserRole.CLIENT, UserRole.DESIGNER),
  asyncHandler(async (req: AuthRequest, res) => {
    const data = bookFlightSchema.parse(req.body);

    const booking = await amalfiService.bookFlight(data.quoteId, req.user!.id);

    res.status(201).json({
      success: true,
      data: booking,
      message: 'Flight booked successfully. You will receive confirmation details via email.',
    });
  })
);

/**
 * Calculate carbon emissions
 * POST /api/aviation/carbon-calculator
 */
router.post(
  '/carbon-calculator',
  asyncHandler(async (req: AuthRequest, res) => {
    const { distance, aircraftType, passengers } = req.body;

    if (!distance || !aircraftType || !passengers) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Distance, aircraft type, and passengers are required',
        },
      });
    }

    const emissions = amalfiService.calculateCarbonEmissions(
      distance,
      aircraftType,
      passengers
    );

    res.json({
      success: true,
      data: {
        totalEmissions: emissions * passengers,
        perPassengerEmissions: emissions,
        distance,
        aircraftType,
        passengers,
        unit: 'kg CO2',
      },
    });
  })
);

export default router;
