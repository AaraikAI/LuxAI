import axios, { AxiosInstance } from 'axios';
import { config } from '../config';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';

/**
 * Amalfi Jets Integration Service
 * Handles private aviation bookings, quotes, and empty legs
 */

export interface AmalfiProvider {
  id: string;
  name: string;
  type: 'air-charter-broker';
  capabilities: string[];
  safetyBadges: string[];
  networkStats: {
    aircraftAccessibleEstimate: number;
  };
  bookingWindows: {
    guaranteedAvailabilityHours: number;
  };
  memberships: AmalfiMembership[];
  contactChannels: string[];
  legalNotes: string[];
}

export interface AmalfiMembership {
  name: string;
  monthlyFee: number;
  benefits: string[];
}

export interface FlightLeg {
  origin: Airport;
  destination: Airport;
  departureTime: Date;
  passengers: number;
  pets?: number;
  catering?: CateringRequest[];
}

export interface Airport {
  code: string; // IATA or ICAO
  name?: string;
  city?: string;
  country?: string;
}

export interface CateringRequest {
  category: string;
  items: string[];
  specialRequests?: string;
}

export interface RFQRequest {
  clientId: string;
  legs: FlightLeg[];
  aircraftPreference?: string;
  flexibilityHours?: number;
  specialRequests?: string;
}

export interface AmalfiQuote {
  id: string;
  rfqId: string;
  legs: FlightLegQuote[];
  aircraft: Aircraft;
  totalPrice: number;
  currency: string;
  validUntil: Date;
  terms: string;
  carbonEmissions: number; // kg CO2
  safetyBadges: string[];
  operatorOfRecord: string;
  addOns: AddOn[];
}

export interface FlightLegQuote {
  origin: Airport;
  destination: Airport;
  departureTime: Date;
  arrivalTime: Date;
  duration: number; // minutes
  distance: number; // nautical miles
  price: number;
}

export interface Aircraft {
  id: string;
  type: string;
  manufacturer: string;
  model: string;
  category: string; // light, midsize, super-midsize, heavy, ultra-long-range
  capacity: number;
  range: number; // nautical miles
  speed: number; // knots
  yearBuilt?: number;
  tailNumber?: string;
  safetyBadges: string[]; // ARGUS, Wyvern, IS-BAO
  amenities: string[];
  images: string[];
}

export interface AddOn {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string; // catering, ground-transport, concierge
}

export interface EmptyLeg {
  id: string;
  origin: Airport;
  destination: Airport;
  departureDate: Date;
  flexibilityDays: number;
  radiusMiles: number;
  aircraft: Aircraft;
  price: number;
  currency: string;
  discount: number; // percentage off regular price
  availableUntil: Date;
}

export interface EmptyLegSearchParams {
  origin?: string;
  destination?: string;
  startDate?: Date;
  endDate?: Date;
  radiusMiles?: number;
  maxPrice?: number;
}

export class AmalfiService {
  private client: AxiosInstance;
  private providerInfo: AmalfiProvider;

  constructor() {
    this.client = axios.create({
      baseURL: config.amalfi.apiUrl,
      headers: {
        'Authorization': `Bearer ${config.amalfi.apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    // Provider information
    this.providerInfo = {
      id: 'amalfi-jets',
      name: 'Amalfi Jets',
      type: 'air-charter-broker',
      capabilities: [
        'on-demand-charter',
        'jet-card',
        'empty-legs',
        'concierge'
      ],
      safetyBadges: ['ARGUS', 'Wyvern', 'IS-BAO'],
      networkStats: {
        aircraftAccessibleEstimate: 3500,
      },
      bookingWindows: {
        guaranteedAvailabilityHours: 48, // for cardholders
      },
      memberships: [
        {
          name: 'Amalfi Reserve',
          monthlyFee: 99,
          benefits: [
            'Guaranteed availability within 48 hours',
            'Fixed hourly rates',
            'No repositioning fees',
            'Complimentary catering'
          ]
        },
        {
          name: 'Amalfi Elite',
          monthlyFee: 500,
          benefits: [
            'All Reserve benefits',
            'Priority access to empty legs',
            '24/7 dedicated concierge',
            'Complimentary ground transportation'
          ]
        }
      ],
      contactChannels: ['partner_portal', 'secure_email_api', 'app_hand-off'],
      legalNotes: ['broker; operator-of-record disclosed at confirmation'],
    };
  }

  /**
   * Get provider information
   */
  getProviderInfo(): AmalfiProvider {
    return this.providerInfo;
  }

  /**
   * Submit Request for Quote (RFQ)
   */
  async submitRFQ(request: RFQRequest): Promise<{ rfqId: string; status: string }> {
    try {
      logger.info('Submitting RFQ to Amalfi Jets', {
        clientId: request.clientId,
        legs: request.legs.length,
      });

      // In production, this would call the actual Amalfi API
      // For now, return a mock response
      const rfqId = `rfq_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Store RFQ in database
      const { query } = await import('../db');
      await query(
        `INSERT INTO quotes (
          id, client_id, vendor_id, status, subtotal, total, currency, valid_until
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          rfqId,
          request.clientId,
          'amalfi-jets',
          'sent',
          0,
          0,
          'USD',
          new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        ]
      );

      logger.info('RFQ submitted successfully', { rfqId });

      return {
        rfqId,
        status: 'pending',
      };
    } catch (error: any) {
      logger.error('Failed to submit RFQ', { error, request });
      throw new AppError(500, 'RFQ_FAILED', 'Failed to submit RFQ to Amalfi Jets');
    }
  }

  /**
   * Get quote by RFQ ID
   */
  async getQuote(rfqId: string): Promise<AmalfiQuote> {
    try {
      logger.info('Fetching quote from Amalfi Jets', { rfqId });

      // In production, fetch from Amalfi API
      // For now, return mock data
      const quote: AmalfiQuote = {
        id: `quote_${Date.now()}`,
        rfqId,
        legs: [],
        aircraft: {
          id: 'aircraft_1',
          type: 'Gulfstream G650',
          manufacturer: 'Gulfstream Aerospace',
          model: 'G650',
          category: 'ultra-long-range',
          capacity: 18,
          range: 7000,
          speed: 516,
          yearBuilt: 2022,
          safetyBadges: ['ARGUS Platinum', 'Wyvern Wingman'],
          amenities: [
            'Full galley',
            'Private stateroom',
            'High-speed WiFi',
            'Satellite phone',
            'Entertainment system'
          ],
          images: []
        },
        totalPrice: 85000,
        currency: 'USD',
        validUntil: new Date(Date.now() + 48 * 60 * 60 * 1000),
        terms: 'Quote valid for 48 hours. Payment due 24 hours before departure.',
        carbonEmissions: 12500,
        safetyBadges: ['ARGUS', 'Wyvern', 'IS-BAO'],
        operatorOfRecord: 'Elite Air Charter Services',
        addOns: [
          {
            id: 'addon_1',
            name: 'Gourmet Catering',
            description: 'Premium catering from local Michelin-starred restaurant',
            price: 2500,
            category: 'catering'
          },
          {
            id: 'addon_2',
            name: 'Ground Transportation',
            description: 'Luxury sedan or SUV service',
            price: 500,
            category: 'ground-transport'
          }
        ]
      };

      return quote;
    } catch (error: any) {
      logger.error('Failed to fetch quote', { error, rfqId });
      throw new AppError(500, 'QUOTE_FETCH_FAILED', 'Failed to fetch quote from Amalfi Jets');
    }
  }

  /**
   * Search for empty legs
   */
  async searchEmptyLegs(params: EmptyLegSearchParams): Promise<EmptyLeg[]> {
    try {
      logger.info('Searching empty legs', params);

      // In production, fetch from Amalfi API
      // For now, return mock data
      const emptyLegs: EmptyLeg[] = [
        {
          id: 'empty_leg_1',
          origin: { code: 'TEB', name: 'Teterboro Airport', city: 'New York', country: 'USA' },
          destination: { code: 'PBI', name: 'Palm Beach International', city: 'Palm Beach', country: 'USA' },
          departureDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
          flexibilityDays: 1,
          radiusMiles: 100,
          aircraft: {
            id: 'aircraft_2',
            type: 'Bombardier Challenger 350',
            manufacturer: 'Bombardier',
            model: 'Challenger 350',
            category: 'super-midsize',
            capacity: 10,
            range: 3200,
            speed: 470,
            safetyBadges: ['ARGUS Gold', 'Wyvern'],
            amenities: ['WiFi', 'Refreshments', 'Entertainment system'],
            images: []
          },
          price: 15000,
          currency: 'USD',
          discount: 65, // 65% off regular price
          availableUntil: new Date(Date.now() + 48 * 60 * 60 * 1000)
        },
        {
          id: 'empty_leg_2',
          origin: { code: 'VNY', name: 'Van Nuys Airport', city: 'Los Angeles', country: 'USA' },
          destination: { code: 'LAS', name: 'Las Vegas McCarran', city: 'Las Vegas', country: 'USA' },
          departureDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
          flexibilityDays: 2,
          radiusMiles: 50,
          aircraft: {
            id: 'aircraft_3',
            type: 'Citation X',
            manufacturer: 'Cessna',
            model: 'Citation X',
            category: 'midsize',
            capacity: 8,
            range: 3242,
            speed: 527,
            safetyBadges: ['ARGUS Platinum'],
            amenities: ['WiFi', 'Catering available'],
            images: []
          },
          price: 8500,
          currency: 'USD',
          discount: 70,
          availableUntil: new Date(Date.now() + 72 * 60 * 60 * 1000)
        }
      ];

      // Filter based on params
      let filtered = emptyLegs;

      if (params.origin) {
        filtered = filtered.filter(leg =>
          leg.origin.code.toLowerCase().includes(params.origin!.toLowerCase())
        );
      }

      if (params.destination) {
        filtered = filtered.filter(leg =>
          leg.destination.code.toLowerCase().includes(params.destination!.toLowerCase())
        );
      }

      if (params.maxPrice) {
        filtered = filtered.filter(leg => leg.price <= params.maxPrice!);
      }

      return filtered;
    } catch (error: any) {
      logger.error('Failed to search empty legs', { error, params });
      throw new AppError(500, 'EMPTY_LEG_SEARCH_FAILED', 'Failed to search empty legs');
    }
  }

  /**
   * Get available aircraft
   */
  async getAvailableAircraft(): Promise<Aircraft[]> {
    try {
      logger.info('Fetching available aircraft');

      // In production, fetch from Amalfi API
      const aircraft: Aircraft[] = [
        {
          id: 'aircraft_1',
          type: 'Gulfstream G650',
          manufacturer: 'Gulfstream Aerospace',
          model: 'G650',
          category: 'ultra-long-range',
          capacity: 18,
          range: 7000,
          speed: 516,
          yearBuilt: 2022,
          safetyBadges: ['ARGUS Platinum', 'Wyvern Wingman', 'IS-BAO'],
          amenities: [
            'Full galley',
            'Private stateroom',
            'High-speed WiFi',
            'Satellite phone',
            'Entertainment system',
            'Shower'
          ],
          images: []
        },
        {
          id: 'aircraft_2',
          type: 'Bombardier Global 7500',
          manufacturer: 'Bombardier',
          model: 'Global 7500',
          category: 'ultra-long-range',
          capacity: 19,
          range: 7700,
          speed: 516,
          yearBuilt: 2023,
          safetyBadges: ['ARGUS Platinum', 'Wyvern Wingman'],
          amenities: [
            'Four living spaces',
            'Full galley',
            'Master suite',
            'High-speed WiFi',
            'Entertainment system'
          ],
          images: []
        },
        {
          id: 'aircraft_3',
          type: 'Bombardier Challenger 350',
          manufacturer: 'Bombardier',
          model: 'Challenger 350',
          category: 'super-midsize',
          capacity: 10,
          range: 3200,
          speed: 470,
          yearBuilt: 2021,
          safetyBadges: ['ARGUS Gold', 'Wyvern'],
          amenities: [
            'WiFi',
            'Galley',
            'Entertainment system',
            'Lavatory'
          ],
          images: []
        }
      ];

      return aircraft;
    } catch (error: any) {
      logger.error('Failed to fetch aircraft', { error });
      throw new AppError(500, 'AIRCRAFT_FETCH_FAILED', 'Failed to fetch available aircraft');
    }
  }

  /**
   * Book a flight
   */
  async bookFlight(quoteId: string, clientId: string): Promise<{
    bookingId: string;
    confirmationNumber: string;
    status: string;
  }> {
    try {
      logger.info('Booking flight', { quoteId, clientId });

      // In production, call Amalfi API to confirm booking
      const bookingId = `booking_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const confirmationNumber = `AJ${Date.now().toString().slice(-6)}`;

      // Update quote status to accepted
      const { query } = await import('../db');
      await query(
        'UPDATE quotes SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        ['accepted', quoteId]
      );

      logger.info('Flight booked successfully', { bookingId, confirmationNumber });

      return {
        bookingId,
        confirmationNumber,
        status: 'confirmed',
      };
    } catch (error: any) {
      logger.error('Failed to book flight', { error, quoteId });
      throw new AppError(500, 'BOOKING_FAILED', 'Failed to book flight');
    }
  }

  /**
   * Calculate carbon emissions for a flight
   */
  calculateCarbonEmissions(
    distance: number,
    aircraftType: string,
    passengers: number
  ): number {
    // Simplified ICAO model
    // Average fuel burn: ~3.5 kg fuel per nautical mile for midsize jets
    // 1 kg of jet fuel = ~3.15 kg CO2
    const fuelBurnPerNM = 3.5;
    const co2PerKgFuel = 3.15;

    const totalFuelBurn = distance * fuelBurnPerNM;
    const totalCO2 = totalFuelBurn * co2PerKgFuel;

    // Divide by passengers for per-person emissions
    return Math.round(totalCO2 / passengers);
  }
}

export const amalfiService = new AmalfiService();
