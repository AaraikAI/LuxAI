import { query } from '../db';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';

export interface CarbonCalculationRequest {
  itineraryId: string;
  flights: FlightEmission[];
  accommodations: AccommodationEmission[];
  groundTransportation: GroundTransportEmission[];
  activities: ActivityEmission[];
}

export interface FlightEmission {
  distance: number; // nautical miles
  aircraftType: string;
  passengers: number;
  flightClass?: 'economy' | 'business' | 'first' | 'private';
}

export interface AccommodationEmission {
  nights: number;
  hotelCategory: 'budget' | 'standard' | 'luxury' | 'ultra-luxury';
  rooms: number;
}

export interface GroundTransportEmission {
  distance: number; // miles
  vehicleType: 'sedan' | 'suv' | 'luxury-car' | 'electric' | 'yacht';
}

export interface ActivityEmission {
  type: string;
  duration: number; // hours
  participants: number;
}

export interface SustainabilityReport {
  itineraryId: string;
  totalCarbonEmissions: number; // kg CO2
  breakdown: {
    flights: number;
    accommodations: number;
    groundTransportation: number;
    activities: number;
  };
  offsetAmount: number;
  offsetCost: number;
  offsetProvider: string;
  sustainabilityScore: number; // 0-100
  recommendations: string[];
  comparisonToAverage: {
    percentageDifference: number;
    category: 'much-lower' | 'lower' | 'average' | 'higher' | 'much-higher';
  };
}

/**
 * Sustainability Calculator Service
 * ICAO-based carbon emissions calculation and offset management
 */
export class SustainabilityService {
  private readonly OFFSET_COST_PER_KG = 0.015; // $0.015 per kg CO2
  private readonly OFFSET_PROVIDER = 'Carbonfund.org';

  /**
   * Calculate comprehensive carbon footprint
   */
  async calculateCarbonFootprint(
    request: CarbonCalculationRequest
  ): Promise<SustainabilityReport> {
    try {
      logger.info('Calculating carbon footprint', { itineraryId: request.itineraryId });

      // Calculate emissions for each category
      const flightEmissions = this.calculateFlightEmissions(request.flights);
      const accommodationEmissions = this.calculateAccommodationEmissions(
        request.accommodations
      );
      const groundEmissions = this.calculateGroundTransportEmissions(
        request.groundTransportation
      );
      const activityEmissions = this.calculateActivityEmissions(request.activities);

      const totalEmissions =
        flightEmissions + accommodationEmissions + groundEmissions + activityEmissions;

      // Calculate offset cost
      const offsetCost = totalEmissions * this.OFFSET_COST_PER_KG;

      // Calculate sustainability score (0-100, lower emissions = higher score)
      const sustainabilityScore = this.calculateSustainabilityScore(
        totalEmissions,
        request
      );

      // Generate recommendations
      const recommendations = this.generateRecommendations(
        flightEmissions,
        accommodationEmissions,
        groundEmissions
      );

      // Compare to average luxury trip
      const comparisonToAverage = this.compareToAverage(totalEmissions);

      const report: SustainabilityReport = {
        itineraryId: request.itineraryId,
        totalCarbonEmissions: Math.round(totalEmissions),
        breakdown: {
          flights: Math.round(flightEmissions),
          accommodations: Math.round(accommodationEmissions),
          groundTransportation: Math.round(groundEmissions),
          activities: Math.round(activityEmissions),
        },
        offsetAmount: Math.round(totalEmissions),
        offsetCost: Math.round(offsetCost * 100) / 100,
        offsetProvider: this.OFFSET_PROVIDER,
        sustainabilityScore,
        recommendations,
        comparisonToAverage,
      };

      // Store in database
      await this.saveSustainabilityMetrics(report);

      logger.info('Carbon footprint calculated', {
        itineraryId: request.itineraryId,
        totalEmissions,
        sustainabilityScore,
      });

      return report;
    } catch (error: any) {
      logger.error('Failed to calculate carbon footprint', { error, request });
      throw new AppError(500, 'CARBON_CALC_FAILED', 'Failed to calculate carbon footprint');
    }
  }

  /**
   * Calculate flight emissions using ICAO model
   */
  private calculateFlightEmissions(flights: FlightEmission[]): number {
    let totalEmissions = 0;

    for (const flight of flights) {
      // ICAO methodology:
      // 1. Calculate fuel consumption based on distance and aircraft type
      // 2. Apply load factor and passenger count
      // 3. Convert fuel to CO2 (1 kg fuel = 3.15 kg CO2)

      let fuelBurnRate: number; // kg fuel per nautical mile

      // Aircraft-specific fuel burn rates
      if (flight.flightClass === 'private') {
        // Private jets: higher per-passenger emissions
        if (flight.aircraftType.includes('light')) {
          fuelBurnRate = 2.5;
        } else if (flight.aircraftType.includes('midsize')) {
          fuelBurnRate = 3.5;
        } else if (flight.aircraftType.includes('heavy')) {
          fuelBurnRate = 5.0;
        } else {
          fuelBurnRate = 4.0; // default
        }
      } else {
        // Commercial flights
        fuelBurnRate = 3.0; // average for commercial aircraft
      }

      // Calculate total fuel consumption
      const totalFuel = flight.distance * fuelBurnRate;

      // Convert to CO2 (3.15 kg CO2 per kg fuel)
      const totalCO2 = totalFuel * 3.15;

      // Divide by passengers (or apply load factor for commercial)
      const emissionsPerPassenger = totalCO2 / flight.passengers;

      // Apply radiative forcing factor (1.9 for high-altitude emissions)
      const adjustedEmissions = emissionsPerPassenger * 1.9;

      totalEmissions += adjustedEmissions;
    }

    return totalEmissions;
  }

  /**
   * Calculate accommodation emissions
   */
  private calculateAccommodationEmissions(
    accommodations: AccommodationEmission[]
  ): number {
    let totalEmissions = 0;

    // Emissions per room per night (kg CO2)
    const emissionRates = {
      budget: 15,
      standard: 25,
      luxury: 40,
      'ultra-luxury': 60,
    };

    for (const accommodation of accommodations) {
      const rate = emissionRates[accommodation.hotelCategory];
      totalEmissions += rate * accommodation.nights * accommodation.rooms;
    }

    return totalEmissions;
  }

  /**
   * Calculate ground transportation emissions
   */
  private calculateGroundTransportEmissions(
    transportation: GroundTransportEmission[]
  ): number {
    let totalEmissions = 0;

    // Emissions per mile (kg CO2)
    const emissionRates = {
      sedan: 0.3,
      suv: 0.45,
      'luxury-car': 0.5,
      electric: 0.1,
      yacht: 5.0, // per nautical mile
    };

    for (const transport of transportation) {
      const rate = emissionRates[transport.vehicleType];
      totalEmissions += rate * transport.distance;
    }

    return totalEmissions;
  }

  /**
   * Calculate activity emissions
   */
  private calculateActivityEmissions(activities: ActivityEmission[]): number {
    // Most activities have minimal direct emissions
    // This is a simplified calculation
    return activities.length * 5; // 5 kg CO2 per activity average
  }

  /**
   * Calculate sustainability score (0-100)
   */
  private calculateSustainabilityScore(
    totalEmissions: number,
    request: CarbonCalculationRequest
  ): number {
    // Average luxury trip: ~5000 kg CO2
    const averageLuxuryTrip = 5000;

    // Calculate score based on comparison to average
    const ratio = totalEmissions / averageLuxuryTrip;

    let score: number;
    if (ratio <= 0.5) {
      score = 90 + (0.5 - ratio) * 20; // 90-100
    } else if (ratio <= 1.0) {
      score = 70 + (1.0 - ratio) * 40; // 70-90
    } else if (ratio <= 1.5) {
      score = 50 + (1.5 - ratio) * 40; // 50-70
    } else if (ratio <= 2.0) {
      score = 30 + (2.0 - ratio) * 40; // 30-50
    } else {
      score = Math.max(0, 30 - (ratio - 2.0) * 15); // 0-30
    }

    return Math.round(Math.max(0, Math.min(100, score)));
  }

  /**
   * Generate sustainability recommendations
   */
  private generateRecommendations(
    flightEmissions: number,
    accommodationEmissions: number,
    groundEmissions: number
  ): string[] {
    const recommendations: string[] = [];

    if (flightEmissions > 3000) {
      recommendations.push(
        'Consider flying direct routes to reduce emissions by up to 20%'
      );
      recommendations.push(
        'Explore commercial first class instead of private jets for lower emissions'
      );
    }

    if (accommodationEmissions > 500) {
      recommendations.push(
        'Choose eco-certified luxury hotels with sustainability programs'
      );
    }

    if (groundEmissions > 300) {
      recommendations.push('Use electric or hybrid vehicles for ground transportation');
    }

    recommendations.push(
      'Offset your carbon footprint through verified carbon offset programs'
    );
    recommendations.push('Support local conservation projects at your destinations');

    return recommendations;
  }

  /**
   * Compare to average luxury trip
   */
  private compareToAverage(totalEmissions: number): {
    percentageDifference: number;
    category: 'much-lower' | 'lower' | 'average' | 'higher' | 'much-higher';
  } {
    const averageLuxuryTrip = 5000; // kg CO2
    const difference = ((totalEmissions - averageLuxuryTrip) / averageLuxuryTrip) * 100;

    let category: 'much-lower' | 'lower' | 'average' | 'higher' | 'much-higher';
    if (difference < -30) {
      category = 'much-lower';
    } else if (difference < -10) {
      category = 'lower';
    } else if (difference <= 10) {
      category = 'average';
    } else if (difference <= 30) {
      category = 'higher';
    } else {
      category = 'much-higher';
    }

    return {
      percentageDifference: Math.round(difference),
      category,
    };
  }

  /**
   * Save sustainability metrics to database
   */
  private async saveSustainabilityMetrics(report: SustainabilityReport): Promise<void> {
    await query(
      `UPDATE itineraries
       SET sustainability_metrics = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [JSON.stringify(report), report.itineraryId]
    );
  }

  /**
   * Get sustainability report for itinerary
   */
  async getSustainabilityReport(itineraryId: string): Promise<SustainabilityReport | null> {
    try {
      const result = await query(
        'SELECT sustainability_metrics FROM itineraries WHERE id = $1',
        [itineraryId]
      );

      if (result.rows.length === 0 || !result.rows[0].sustainability_metrics) {
        return null;
      }

      return result.rows[0].sustainability_metrics;
    } catch (error: any) {
      logger.error('Failed to get sustainability report', { error, itineraryId });
      throw new AppError(
        500,
        'SUSTAINABILITY_REPORT_FAILED',
        'Failed to fetch sustainability report'
      );
    }
  }

  /**
   * Purchase carbon offset
   */
  async purchaseCarbonOffset(
    itineraryId: string,
    clientId: string,
    offsetAmount: number
  ): Promise<{ certificateId: string; cost: number }> {
    try {
      const cost = offsetAmount * this.OFFSET_COST_PER_KG;

      // In production, integrate with actual offset provider API
      const certificateId = `CERT_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      logger.info('Carbon offset purchased', {
        itineraryId,
        clientId,
        offsetAmount,
        cost,
        certificateId,
      });

      return {
        certificateId,
        cost,
      };
    } catch (error: any) {
      logger.error('Failed to purchase carbon offset', { error, itineraryId });
      throw new AppError(500, 'OFFSET_PURCHASE_FAILED', 'Failed to purchase carbon offset');
    }
  }
}

export const sustainabilityService = new SustainabilityService();
