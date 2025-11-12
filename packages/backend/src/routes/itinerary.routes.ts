import { Router } from 'express';
import { z } from 'zod';
import { authenticate, AuthRequest, authorize } from '../middleware/auth';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { aiService } from '../services/ai.service';
import { query, withTransaction } from '../db';
import { UserRole } from '@luxai/shared';

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

const generateItinerarySchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  destinations: z.array(z.string()).optional(),
  budget: z.number().optional(),
  specialRequests: z.string().optional(),
});

router.post(
  '/generate',
  authorize(UserRole.CLIENT, UserRole.DESIGNER),
  asyncHandler(async (req: AuthRequest, res) => {
    const data = generateItinerarySchema.parse(req.body);

    // Generate with AI
    const itinerary = await aiService.generateItinerary({
      clientId: req.user!.id,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      destinations: data.destinations,
      budget: data.budget,
      specialRequests: data.specialRequests,
    });

    // Save to database
    const savedItinerary = await withTransaction(async (client) => {
      // Insert itinerary
      const itinResult = await client.query(
        `INSERT INTO itineraries (
          client_id, designer_id, title, description, start_date, end_date,
          status, ai_generated, total_budget, currency
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *`,
        [
          req.user!.id,
          null,
          itinerary.title,
          itinerary.description,
          data.startDate,
          data.endDate,
          'draft',
          true,
          itinerary.estimatedCost,
          'USD',
        ]
      );

      const savedItin = itinResult.rows[0];

      // Insert destinations
      for (const dest of itinerary.destinations) {
        await client.query(
          `INSERT INTO destinations (
            itinerary_id, name, country, coordinates, arrival_date, departure_date
          ) VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            savedItin.id,
            dest.name,
            dest.country,
            JSON.stringify({ latitude: 0, longitude: 0 }),
            dest.arrivalDate,
            dest.departureDate,
          ]
        );
      }

      return savedItin;
    });

    res.status(201).json({
      success: true,
      data: {
        itinerary: savedItinerary,
        details: itinerary,
      },
    });
  })
);

router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res) => {
    const result = await query(
      `SELECT * FROM itineraries WHERE client_id = $1 ORDER BY created_at DESC`,
      [req.user!.id]
    );

    res.json({
      success: true,
      data: result.rows,
    });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req: AuthRequest, res) => {
    const { id } = req.params;

    const result = await query(
      `SELECT * FROM itineraries WHERE id = $1 AND client_id = $2`,
      [id, req.user!.id]
    );

    if (result.rows.length === 0) {
      throw new AppError(404, 'ITINERARY_NOT_FOUND', 'Itinerary not found');
    }

    // Get destinations
    const destinations = await query(
      `SELECT * FROM destinations WHERE itinerary_id = $1 ORDER BY arrival_date`,
      [id]
    );

    // Get activities
    const activities = await query(
      `SELECT * FROM activities WHERE itinerary_id = $1 ORDER BY start_time`,
      [id]
    );

    // Get accommodations
    const accommodations = await query(
      `SELECT * FROM accommodations WHERE itinerary_id = $1 ORDER BY check_in`,
      [id]
    );

    // Get transportation
    const transportation = await query(
      `SELECT * FROM transportation WHERE itinerary_id = $1 ORDER BY departure_time`,
      [id]
    );

    res.json({
      success: true,
      data: {
        ...result.rows[0],
        destinations: destinations.rows,
        activities: activities.rows,
        accommodations: accommodations.rows,
        transportation: transportation.rows,
      },
    });
  })
);

router.patch(
  '/:id/status',
  asyncHandler(async (req: AuthRequest, res) => {
    const { id } = req.params;
    const { status } = req.body;

    const result = await query(
      `UPDATE itineraries SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND client_id = $3
       RETURNING *`,
      [status, id, req.user!.id]
    );

    if (result.rows.length === 0) {
      throw new AppError(404, 'ITINERARY_NOT_FOUND', 'Itinerary not found');
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  })
);

export default router;
