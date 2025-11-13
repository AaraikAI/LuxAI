import { Router } from 'express';
import { gdsService } from '../services/gds.service';
import { authenticate } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

/**
 * POST /gds/flights/search
 * Search for commercial flights
 */
router.post('/flights/search', authenticate, async (req, res) => {
  try {
    const searchRequest = req.body;
    const flights = await gdsService.searchFlights(searchRequest);

    res.json({
      success: true,
      data: flights,
    });
  } catch (error: any) {
    logger.error('Flight search failed', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'FLIGHT_SEARCH_FAILED',
        message: error.message,
      },
    });
  }
});

/**
 * POST /gds/hotels/search
 * Search for hotels
 */
router.post('/hotels/search', authenticate, async (req, res) => {
  try {
    const searchRequest = req.body;
    const hotels = await gdsService.searchHotels(searchRequest);

    res.json({
      success: true,
      data: hotels,
    });
  } catch (error: any) {
    logger.error('Hotel search failed', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'HOTEL_SEARCH_FAILED',
        message: error.message,
      },
    });
  }
});

/**
 * POST /gds/flights/:id/book
 * Book a flight
 */
router.post('/flights/:id/book', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const passengerDetails = req.body;

    const pnr = await gdsService.bookFlight(id, passengerDetails);

    res.json({
      success: true,
      data: { pnr },
    });
  } catch (error: any) {
    logger.error('Flight booking failed', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'FLIGHT_BOOKING_FAILED',
        message: error.message,
      },
    });
  }
});

/**
 * POST /gds/hotels/:id/book
 * Book a hotel
 */
router.post('/hotels/:id/book', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const guestDetails = req.body;

    const confirmation = await gdsService.bookHotel(id, guestDetails);

    res.json({
      success: true,
      data: { confirmation },
    });
  } catch (error: any) {
    logger.error('Hotel booking failed', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'HOTEL_BOOKING_FAILED',
        message: error.message,
      },
    });
  }
});

export default router;
