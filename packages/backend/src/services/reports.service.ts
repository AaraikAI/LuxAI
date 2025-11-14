import { getPool } from '../db';
import { logger } from '../utils/logger';
import { format } from 'date-fns';
import PDFDocument from 'pdfkit';

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
   * Export itinerary to PDF
   */
  async exportToPDF(itineraryId: string): Promise<Buffer> {
    try {
      const reportData = await this.generateItineraryReport(itineraryId);
      logger.info('Generating PDF report', { itineraryId });

      return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        const chunks: Buffer[] = [];

        // Collect PDF chunks
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Add header
        doc.fontSize(24)
           .fillColor('#1a1a1a')
           .text('Luxury Travel Itinerary', { align: 'center' });

        doc.moveDown(0.5);
        doc.fontSize(18)
           .fillColor('#2563eb')
           .text(reportData.itinerary.title, { align: 'center' });

        doc.moveDown(1);

        // Add horizontal line
        doc.moveTo(50, doc.y)
           .lineTo(545, doc.y)
           .strokeColor('#e5e7eb')
           .stroke();

        doc.moveDown(1);

        // Client Information
        doc.fontSize(14)
           .fillColor('#1a1a1a')
           .text('Client Information', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(10)
           .fillColor('#4b5563')
           .text(`Name: ${reportData.client?.full_name || 'N/A'}`)
           .text(`Email: ${reportData.client?.email || 'N/A'}`)
           .text(`Travel Dates: ${format(new Date(reportData.itinerary.startDate), 'MMM dd, yyyy')} - ${format(new Date(reportData.itinerary.endDate), 'MMM dd, yyyy')}`);

        doc.moveDown(1);

        // Destinations
        if (reportData.destinations.length > 0) {
          doc.fontSize(14)
             .fillColor('#1a1a1a')
             .text('Destinations', { underline: true });
          doc.moveDown(0.5);

          reportData.destinations.forEach((dest: any, index: number) => {
            doc.fontSize(12)
               .fillColor('#2563eb')
               .text(`${index + 1}. ${dest.name}, ${dest.country}`);
            doc.fontSize(10)
               .fillColor('#4b5563')
               .text(`   Arrival: ${format(new Date(dest.arrivalDate), 'MMM dd, yyyy')}`)
               .text(`   Departure: ${format(new Date(dest.departureDate), 'MMM dd, yyyy')}`);
            if (dest.notes) {
              doc.text(`   Notes: ${dest.notes}`);
            }
            doc.moveDown(0.5);
          });
          doc.moveDown(0.5);
        }

        // Activities
        if (reportData.activities.length > 0) {
          doc.fontSize(14)
             .fillColor('#1a1a1a')
             .text('Activities', { underline: true });
          doc.moveDown(0.5);

          reportData.activities.forEach((activity: any) => {
            doc.fontSize(11)
               .fillColor('#2563eb')
               .text(`• ${activity.name}`);
            doc.fontSize(9)
               .fillColor('#4b5563')
               .text(`  ${format(new Date(activity.startTime), 'MMM dd, yyyy HH:mm')} - ${format(new Date(activity.endTime), 'HH:mm')}`);
            if (activity.location?.name) {
              doc.text(`  Location: ${activity.location.name}`);
            }
            if (activity.cost) {
              doc.text(`  Cost: $${activity.cost.toLocaleString()}`);
            }
            doc.moveDown(0.3);
          });
          doc.moveDown(0.5);
        }

        // Accommodations
        if (reportData.accommodations.length > 0) {
          doc.fontSize(14)
             .fillColor('#1a1a1a')
             .text('Accommodations', { underline: true });
          doc.moveDown(0.5);

          reportData.accommodations.forEach((acc: any) => {
            doc.fontSize(11)
               .fillColor('#2563eb')
               .text(`• ${acc.name}`);
            doc.fontSize(9)
               .fillColor('#4b5563')
               .text(`  Check-in: ${format(new Date(acc.checkIn), 'MMM dd, yyyy')}`)
               .text(`  Check-out: ${format(new Date(acc.checkOut), 'MMM dd, yyyy')}`)
               .text(`  Rooms: ${acc.rooms}`);
            if (acc.cost) {
              doc.text(`  Cost: $${acc.cost.toLocaleString()}`);
            }
            doc.moveDown(0.3);
          });
          doc.moveDown(0.5);
        }

        // Transportation
        if (reportData.transportation.length > 0) {
          doc.fontSize(14)
             .fillColor('#1a1a1a')
             .text('Transportation', { underline: true });
          doc.moveDown(0.5);

          reportData.transportation.forEach((transport: any) => {
            doc.fontSize(11)
               .fillColor('#2563eb')
               .text(`• ${transport.type.toUpperCase()}: ${transport.from} → ${transport.to}`);
            doc.fontSize(9)
               .fillColor('#4b5563')
               .text(`  Departure: ${format(new Date(transport.departureTime), 'MMM dd, yyyy HH:mm')}`);
            if (transport.arrivalTime) {
              doc.text(`  Arrival: ${format(new Date(transport.arrivalTime), 'MMM dd, yyyy HH:mm')}`);
            }
            if (transport.cost) {
              doc.text(`  Cost: $${transport.cost.toLocaleString()}`);
            }
            doc.moveDown(0.3);
          });
          doc.moveDown(0.5);
        }

        // Financial Summary
        doc.fontSize(14)
           .fillColor('#1a1a1a')
           .text('Financial Summary', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(12)
           .fillColor('#16a34a')
           .text(`Total Cost: $${reportData.totalCost.toLocaleString()}`, { bold: true });

        // Sustainability
        if (reportData.sustainability?.carbon_footprint_kg) {
          doc.moveDown(1);
          doc.fontSize(14)
             .fillColor('#1a1a1a')
             .text('Sustainability', { underline: true });
          doc.moveDown(0.5);
          doc.fontSize(10)
             .fillColor('#4b5563')
             .text(`Carbon Footprint: ${reportData.sustainability.carbon_footprint_kg.toFixed(2)} kg CO₂`);
        }

        // Footer
        doc.moveDown(2);
        doc.fontSize(8)
           .fillColor('#9ca3af')
           .text(`Generated on ${format(new Date(), 'MMMM dd, yyyy')}`, { align: 'center' })
           .text('LuxAI Designer - Luxury Travel Platform', { align: 'center' });

        // Finalize PDF
        doc.end();
      });
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
