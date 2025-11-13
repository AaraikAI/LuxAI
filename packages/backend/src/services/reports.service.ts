import { getPool } from '../db';
import { logger } from '../utils/logger';
import { format } from 'date-fns';

export interface ItineraryReportData {
  itinerary: any;
  client: any;
  designer: any;
  destinations: any[];
  activities: any[];
  accommodations: any[];
  transportation: any[];
  sustainability: any;
  totalCost: number;
}

export interface ReportFormat {
  format: 'pdf' | 'csv' | 'json' | 'excel';
  includeImages: boolean;
  includeFinancials: boolean;
  includeSustainability: boolean;
}

export class ReportsService {
  /**
   * Generate itinerary report data
   */
  async generateItineraryReport(itineraryId: string): Promise<ItineraryReportData> {
    const pool = getPool();

    try {
      // Get itinerary with client and designer info
      const itineraryResult = await pool.query(
        `
        SELECT
          i.*,
          c.first_name as client_first_name,
          c.last_name as client_last_name,
          c.email as client_email,
          d.first_name as designer_first_name,
          d.last_name as designer_last_name,
          d.email as designer_email
        FROM itineraries i
        JOIN users c ON i.client_id = c.id
        JOIN users d ON i.designer_id = d.id
        WHERE i.id = $1
        `,
        [itineraryId]
      );

      if (itineraryResult.rows.length === 0) {
        throw new Error('Itinerary not found');
      }

      const itinerary = itineraryResult.rows[0];

      // Get sustainability metrics
      const sustainabilityResult = await pool.query(
        `SELECT * FROM sustainability_metrics WHERE itinerary_id = $1`,
        [itineraryId]
      );

      // Get quotes/costs
      const quotesResult = await pool.query(
        `SELECT COALESCE(SUM(total), 0) as total_cost FROM quotes WHERE itinerary_id = $1 AND status = 'accepted'`,
        [itineraryId]
      );

      return {
        itinerary: {
          id: itinerary.id,
          title: itinerary.title,
          description: itinerary.description,
          startDate: itinerary.start_date,
          endDate: itinerary.end_date,
          status: itinerary.status,
        },
        client: {
          name: `${itinerary.client_first_name} ${itinerary.client_last_name}`,
          email: itinerary.client_email,
        },
        designer: {
          name: `${itinerary.designer_first_name} ${itinerary.designer_last_name}`,
          email: itinerary.designer_email,
        },
        destinations: itinerary.destinations || [],
        activities: itinerary.activities || [],
        accommodations: itinerary.accommodations || [],
        transportation: itinerary.transportation || [],
        sustainability: sustainabilityResult.rows[0] || null,
        totalCost: parseFloat(quotesResult.rows[0].total_cost),
      };
    } catch (error) {
      logger.error('Failed to generate itinerary report', error);
      throw new Error('Failed to generate report');
    }
  }

  /**
   * Export itinerary to PDF (placeholder)
   */
  async exportToPDF(itineraryId: string): Promise<Buffer> {
    try {
      const reportData = await this.generateItineraryReport(itineraryId);

      // TODO: Implement actual PDF generation using a library like pdfkit or puppeteer
      // For now, return mock data
      logger.info('Generating PDF report', { itineraryId });

      const mockPDF = Buffer.from('Mock PDF content for itinerary: ' + reportData.itinerary.title);
      return mockPDF;
    } catch (error) {
      logger.error('Failed to export to PDF', error);
      throw new Error('Failed to export to PDF');
    }
  }

  /**
   * Export itinerary to CSV
   */
  async exportToCSV(itineraryId: string): Promise<string> {
    try {
      const reportData = await this.generateItineraryReport(itineraryId);

      let csv = 'Type,Name,Date,Location,Cost,Notes\n';

      // Add destinations
      for (const dest of reportData.destinations) {
        csv += `Destination,"${dest.name}","${format(new Date(dest.arrivalDate), 'yyyy-MM-dd')}","${dest.country}","","${dest.notes || ''}"\n`;
      }

      // Add activities
      for (const activity of reportData.activities) {
        csv += `Activity,"${activity.name}","${format(new Date(activity.startTime), 'yyyy-MM-dd HH:mm')}","${activity.location?.name || ''}","${activity.cost || 0}","${activity.description}"\n`;
      }

      // Add accommodations
      for (const accommodation of reportData.accommodations) {
        csv += `Accommodation,"${accommodation.name}","${format(new Date(accommodation.checkIn), 'yyyy-MM-dd')}","${accommodation.address?.city || ''}","${accommodation.cost || 0}","${accommodation.rooms} rooms"\n`;
      }

      // Add transportation
      for (const transport of reportData.transportation) {
        csv += `Transportation,"${transport.type}","${format(new Date(transport.departureTime), 'yyyy-MM-dd HH:mm')}","${transport.provider || ''}","${transport.cost || 0}",""\n`;
      }

      return csv;
    } catch (error) {
      logger.error('Failed to export to CSV', error);
      throw new Error('Failed to export to CSV');
    }
  }

  /**
   * Export itinerary to JSON
   */
  async exportToJSON(itineraryId: string): Promise<any> {
    try {
      const reportData = await this.generateItineraryReport(itineraryId);
      return reportData;
    } catch (error) {
      logger.error('Failed to export to JSON', error);
      throw new Error('Failed to export to JSON');
    }
  }

  /**
   * Generate shareable link for itinerary
   */
  async generateShareableLink(itineraryId: string, expiresInDays: number = 7): Promise<string> {
    const pool = getPool();

    try {
      const shareToken = this.generateToken();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);

      await pool.query(
        `
        INSERT INTO shareable_links (
          itinerary_id,
          share_token,
          expires_at,
          created_at
        ) VALUES ($1, $2, $3, NOW())
        ON CONFLICT (itinerary_id) DO UPDATE
        SET share_token = $2, expires_at = $3, created_at = NOW()
        `,
        [itineraryId, shareToken, expiresAt]
      );

      return `/share/${shareToken}`;
    } catch (error) {
      logger.error('Failed to generate shareable link', error);
      throw new Error('Failed to generate shareable link');
    }
  }

  /**
   * Get itinerary by share token
   */
  async getItineraryByShareToken(shareToken: string): Promise<ItineraryReportData | null> {
    const pool = getPool();

    try {
      const result = await pool.query(
        `
        SELECT itinerary_id
        FROM shareable_links
        WHERE share_token = $1 AND expires_at > NOW()
        `,
        [shareToken]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const itineraryId = result.rows[0].itinerary_id;
      return await this.generateItineraryReport(itineraryId);
    } catch (error) {
      logger.error('Failed to get itinerary by share token', error);
      throw new Error('Failed to get itinerary');
    }
  }

  /**
   * Generate analytics report for a date range
   */
  async generateAnalyticsReport(
    startDate: Date,
    endDate: Date,
    type: 'revenue' | 'bookings' | 'users'
  ): Promise<any> {
    const pool = getPool();

    try {
      let query = '';
      switch (type) {
        case 'revenue':
          query = `
            SELECT
              DATE_TRUNC('day', created_at) as date,
              SUM(total) as value
            FROM quotes
            WHERE status = 'accepted'
              AND created_at BETWEEN $1 AND $2
            GROUP BY DATE_TRUNC('day', created_at)
            ORDER BY date ASC
          `;
          break;
        case 'bookings':
          query = `
            SELECT
              DATE_TRUNC('day', created_at) as date,
              COUNT(*) as value
            FROM quotes
            WHERE status = 'accepted'
              AND created_at BETWEEN $1 AND $2
            GROUP BY DATE_TRUNC('day', created_at)
            ORDER BY date ASC
          `;
          break;
        case 'users':
          query = `
            SELECT
              DATE_TRUNC('day', created_at) as date,
              COUNT(*) as value
            FROM users
            WHERE created_at BETWEEN $1 AND $2
            GROUP BY DATE_TRUNC('day', created_at)
            ORDER BY date ASC
          `;
          break;
      }

      const result = await pool.query(query, [startDate, endDate]);

      return {
        type,
        startDate,
        endDate,
        data: result.rows.map((row) => ({
          date: row.date,
          value: parseFloat(row.value),
        })),
      };
    } catch (error) {
      logger.error('Failed to generate analytics report', error);
      throw new Error('Failed to generate analytics report');
    }
  }

  // Helper methods

  private generateToken(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }
}

export const reportsService = new ReportsService();
