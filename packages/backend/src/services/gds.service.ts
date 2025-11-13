import axios from 'axios';
import { config } from '../config';
import { logger } from '../utils/logger';

export interface FlightSearchRequest {
  origin: string; // IATA code
  destination: string; // IATA code
  departureDate: string; // YYYY-MM-DD
  returnDate?: string; // YYYY-MM-DD for round trip
  passengers: number;
  cabinClass: 'economy' | 'premium_economy' | 'business' | 'first';
}

export interface FlightOption {
  id: string;
  airline: string;
  flightNumber: string;
  origin: string;
  destination: string;
  departureTime: Date;
  arrivalTime: Date;
  duration: number; // minutes
  stops: number;
  cabinClass: string;
  price: number;
  currency: string;
  availableSeats: number;
  aircraft: string;
}

export interface HotelSearchRequest {
  city: string;
  checkIn: string; // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD
  guests: number;
  rooms: number;
  minStarRating?: number;
}

export interface HotelOption {
  id: string;
  name: string;
  starRating: number;
  address: string;
  city: string;
  country: string;
  images: string[];
  amenities: string[];
  roomType: string;
  price: number;
  currency: string;
  availableRooms: number;
  breakfastIncluded: boolean;
  refundable: boolean;
}

export class GDSService {
  private sabreClient: any;

  constructor() {
    // Initialize Sabre API client
    this.sabreClient = axios.create({
      baseURL: config.sabre.apiUrl || 'https://api.cert.platform.sabre.com',
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Get Sabre API access token
   */
  private async getAccessToken(): Promise<string> {
    try {
      const response = await this.sabreClient.post('/v2/auth/token', {
        grant_type: 'client_credentials',
      }, {
        auth: {
          username: config.sabre.apiKey,
          password: config.sabre.apiSecret,
        },
      });

      return response.data.access_token;
    } catch (error) {
      logger.error('Failed to get Sabre access token', error);
      throw new Error('Failed to authenticate with GDS');
    }
  }

  /**
   * Search for flights using Sabre API
   */
  async searchFlights(request: FlightSearchRequest): Promise<FlightOption[]> {
    try {
      const token = await this.getAccessToken();

      // Sabre InstaFlight Low Fare Search API
      const response = await this.sabreClient.post(
        '/v4/offers/shop',
        {
          OTA_AirLowFareSearchRQ: {
            Version: '4',
            POS: {
              Source: [{
                PseudoCityCode: config.sabre.pcc || 'XXXX',
                RequestorID: {
                  Type: '1',
                  ID: '1',
                  CompanyName: {
                    Code: 'TN',
                  },
                },
              }],
            },
            OriginDestinationInformation: [
              {
                RPH: '1',
                DepartureDateTime: request.departureDate,
                OriginLocation: { LocationCode: request.origin },
                DestinationLocation: { LocationCode: request.destination },
              },
              ...(request.returnDate ? [{
                RPH: '2',
                DepartureDateTime: request.returnDate,
                OriginLocation: { LocationCode: request.destination },
                DestinationLocation: { LocationCode: request.origin },
              }] : []),
            ],
            TravelPreferences: {
              CabinPref: [{
                Cabin: this.mapCabinClass(request.cabinClass),
                PreferLevel: 'Preferred',
              }],
            },
            TravelerInfoSummary: {
              AirTravelerAvail: [{
                PassengerTypeQuantity: [{
                  Code: 'ADT',
                  Quantity: request.passengers,
                }],
              }],
            },
            TPA_Extensions: {
              IntelliSellTransaction: {
                RequestType: {
                  Name: '200ITINS',
                },
              },
            },
          },
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      // Parse Sabre response and convert to FlightOption[]
      const itineraries = response.data.groupedItineraryResponse?.itineraryGroups || [];
      const flights: FlightOption[] = [];

      for (const group of itineraries) {
        for (const itinerary of group.itineraries || []) {
          // Extract flight details from itinerary
          const pricingInfo = itinerary.pricingInformation?.[0];
          const legs = itinerary.legs || [];

          for (const leg of legs) {
            const segments = leg.segments || [];
            if (segments.length === 0) continue;

            const firstSegment = segments[0];
            const lastSegment = segments[segments.length - 1];

            flights.push({
              id: itinerary.id || `flight-${Date.now()}-${Math.random()}`,
              airline: firstSegment.airline?.name || 'Unknown',
              flightNumber: `${firstSegment.airline?.code || ''}${firstSegment.flightNumber || ''}`,
              origin: firstSegment.departureAirport?.code || request.origin,
              destination: lastSegment.arrivalAirport?.code || request.destination,
              departureTime: new Date(firstSegment.departureDateTime),
              arrivalTime: new Date(lastSegment.arrivalDateTime),
              duration: leg.elapsedTime || 0,
              stops: segments.length - 1,
              cabinClass: request.cabinClass,
              price: parseFloat(pricingInfo?.fare?.totalFare?.amount || '0'),
              currency: pricingInfo?.fare?.totalFare?.currency || 'USD',
              availableSeats: firstSegment.seatsRemaining || 9,
              aircraft: firstSegment.equipment?.name || 'Unknown',
            });
          }
        }
      }

      return flights;
    } catch (error) {
      logger.error('Failed to search flights', error);

      // Return mock data for development
      return this.getMockFlights(request);
    }
  }

  /**
   * Search for hotels using Sabre API
   */
  async searchHotels(request: HotelSearchRequest): Promise<HotelOption[]> {
    try {
      const token = await this.getAccessToken();

      // Sabre Hotel Availability API
      const response = await this.sabreClient.post(
        '/v3.0.0/get/hotelavail',
        {
          GetHotelAvailRQ: {
            SearchCriteria: {
              GeoSearch: {
                GeoRef: {
                  Radius: 20,
                  UOM: 'MI',
                  RefPoint: {
                    Value: request.city,
                    ValueContext: 'CITY',
                    RefPointType: '6',
                  },
                },
              },
              RateInfoRef: {
                ConvertedRateInfoOnly: false,
                CurrencyCode: 'USD',
                BestOnly: '2',
                PrepaidQualifier: 'IncludePrepaid',
                StayDateRange: {
                  StartDate: request.checkIn,
                  EndDate: request.checkOut,
                },
                Rooms: {
                  Room: Array(request.rooms).fill({
                    Index: 1,
                    Adults: Math.ceil(request.guests / request.rooms),
                  }),
                },
              },
            },
          },
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      // Parse Sabre hotel response
      const hotelList = response.data.GetHotelAvailRS?.HotelAvailInfos?.HotelAvailInfo || [];
      const hotels: HotelOption[] = [];

      for (const hotel of hotelList) {
        const basicInfo = hotel.HotelInfo?.BasicInfo;
        const roomRate = hotel.RoomRates?.RoomRate?.[0];

        if (!basicInfo || !roomRate) continue;

        hotels.push({
          id: hotel.HotelInfo?.HotelCode || `hotel-${Date.now()}-${Math.random()}`,
          name: basicInfo.HotelName || 'Unknown Hotel',
          starRating: parseInt(basicInfo.Award?.[0]?.Rating || '3'),
          address: basicInfo.Address?.AddressLine || '',
          city: basicInfo.Address?.CityName || request.city,
          country: basicInfo.Address?.CountryName || '',
          images: basicInfo.ImageURL ? [basicInfo.ImageURL] : [],
          amenities: basicInfo.Amenities?.Amenity?.map((a: any) => a.Description) || [],
          roomType: roomRate.RoomType || 'Standard Room',
          price: parseFloat(roomRate.Rates?.Rate?.[0]?.Base?.AmountAfterTax || '0'),
          currency: roomRate.Rates?.Rate?.[0]?.Base?.CurrencyCode || 'USD',
          availableRooms: roomRate.RoomsAvailable || 1,
          breakfastIncluded: roomRate.MealsIncluded?.Breakfast || false,
          refundable: roomRate.CancelPenalty?.NonRefundable !== true,
        });
      }

      return hotels;
    } catch (error) {
      logger.error('Failed to search hotels', error);

      // Return mock data for development
      return this.getMockHotels(request);
    }
  }

  /**
   * Book a flight
   */
  async bookFlight(flightId: string, passengerDetails: any): Promise<string> {
    // Implementation would use Sabre booking APIs
    // This is a placeholder
    logger.info('Booking flight', { flightId, passengerDetails });
    return `PNR-${Date.now()}`;
  }

  /**
   * Book a hotel
   */
  async bookHotel(hotelId: string, guestDetails: any): Promise<string> {
    // Implementation would use Sabre booking APIs
    // This is a placeholder
    logger.info('Booking hotel', { hotelId, guestDetails });
    return `CONF-${Date.now()}`;
  }

  // Helper methods

  private mapCabinClass(cabin: string): string {
    const mapping: Record<string, string> = {
      economy: 'Y',
      premium_economy: 'W',
      business: 'C',
      first: 'F',
    };
    return mapping[cabin] || 'Y';
  }

  private getMockFlights(request: FlightSearchRequest): FlightOption[] {
    return [
      {
        id: 'mock-1',
        airline: 'American Airlines',
        flightNumber: 'AA1234',
        origin: request.origin,
        destination: request.destination,
        departureTime: new Date(request.departureDate + 'T08:00:00'),
        arrivalTime: new Date(request.departureDate + 'T12:00:00'),
        duration: 240,
        stops: 0,
        cabinClass: request.cabinClass,
        price: request.cabinClass === 'first' ? 5000 : request.cabinClass === 'business' ? 2500 : 800,
        currency: 'USD',
        availableSeats: 9,
        aircraft: 'Boeing 787',
      },
      {
        id: 'mock-2',
        airline: 'Delta',
        flightNumber: 'DL5678',
        origin: request.origin,
        destination: request.destination,
        departureTime: new Date(request.departureDate + 'T14:00:00'),
        arrivalTime: new Date(request.departureDate + 'T18:30:00'),
        duration: 270,
        stops: 1,
        cabinClass: request.cabinClass,
        price: request.cabinClass === 'first' ? 4500 : request.cabinClass === 'business' ? 2200 : 650,
        currency: 'USD',
        availableSeats: 12,
        aircraft: 'Airbus A350',
      },
    ];
  }

  private getMockHotels(request: HotelSearchRequest): HotelOption[] {
    return [
      {
        id: 'mock-hotel-1',
        name: 'Grand Luxury Hotel',
        starRating: 5,
        address: '123 Main Street',
        city: request.city,
        country: 'USA',
        images: [],
        amenities: ['Pool', 'Spa', 'Restaurant', 'Fitness Center', 'Concierge'],
        roomType: 'Deluxe Suite',
        price: 850,
        currency: 'USD',
        availableRooms: 3,
        breakfastIncluded: true,
        refundable: true,
      },
      {
        id: 'mock-hotel-2',
        name: 'Premium Business Hotel',
        starRating: 4,
        address: '456 Business Blvd',
        city: request.city,
        country: 'USA',
        images: [],
        amenities: ['WiFi', 'Business Center', 'Restaurant', 'Gym'],
        roomType: 'Executive Room',
        price: 450,
        currency: 'USD',
        availableRooms: 5,
        breakfastIncluded: true,
        refundable: false,
      },
    ];
  }
}

export const gdsService = new GDSService();
