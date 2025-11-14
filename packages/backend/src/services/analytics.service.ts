import { getPool } from '../db';
import { logger } from '../utils/logger';

export interface UserAnalytics {
  userId: string;
  totalItineraries: number;
  totalBookings: number;
  totalSpent: number;
  averageItineraryValue: number;
  carbonFootprint: number;
  carbonOffset: number;
  favoriteDestinations: string[];
  preferredVendors: string[];
  activityBreakdown: Record<string, number>;
}

export interface VendorAnalytics {
  vendorId: string;
  totalDeals: number;
  activeDeals: number;
  totalViews: number;
  totalInquiries: number;
  conversionRate: number;
  totalRevenue: number;
  averageDealValue: number;
  topPerformingDeals: Array<{
    dealId: string;
    title: string;
    views: number;
    inquiries: number;
  }>;
  customerSatisfaction: number;
  repeatCustomerRate: number;
}

export interface PlatformAnalytics {
  totalUsers: number;
  activeUsers: number;
  totalItineraries: number;
  totalRevenue: number;
  revenueGrowth: number;
  userGrowth: number;
  topDestinations: Array<{ destination: string; count: number }>;
  topVendors: Array<{ vendorId: string; name: string; revenue: number }>;
  categoryBreakdown: Record<string, number>;
  averageItineraryValue: number;
  conversionRate: number;
}

export class AnalyticsService {
  /**
   * Get analytics for a specific user/client
   */
  async getUserAnalytics(userId: string): Promise<UserAnalytics> {
    const pool = getPool();

    try {
      // Get total itineraries
      const itinerariesResult = await pool.query(
        `SELECT COUNT(*) as count FROM itineraries WHERE client_id = $1`,
        [userId]
      );

      // Get total bookings
      const bookingsResult = await pool.query(
        `SELECT COUNT(*) as count FROM quotes WHERE client_id = $1 AND status = 'accepted'`,
        [userId]
      );

      // Get total spent
      const spentResult = await pool.query(
        `SELECT COALESCE(SUM(total), 0) as total FROM quotes WHERE client_id = $1 AND status = 'accepted'`,
        [userId]
      );

      // Get carbon footprint
      const carbonResult = await pool.query(
        `
        SELECT
          COALESCE(SUM(sm.total_carbon_emissions), 0) as footprint,
          COALESCE(SUM(sm.offset_amount), 0) as offset
        FROM itineraries i
        LEFT JOIN sustainability_metrics sm ON i.id = sm.itinerary_id
        WHERE i.client_id = $1
        `,
        [userId]
      );

      // Get favorite destinations
      const destinationsResult = await pool.query(
        `
        SELECT d.country, COUNT(*) as count
        FROM itineraries i
        JOIN LATERAL jsonb_array_elements(i.destinations) as d(dest) ON true
        WHERE i.client_id = $1
        GROUP BY d.country
        ORDER BY count DESC
        LIMIT 5
        `,
        [userId]
      );

      // Get preferred vendors
      const vendorsResult = await pool.query(
        `
        SELECT v.business_name, COUNT(*) as count
        FROM quotes q
        JOIN vendors v ON q.vendor_id = v.id
        WHERE q.client_id = $1 AND q.status = 'accepted'
        GROUP BY v.id, v.business_name
        ORDER BY count DESC
        LIMIT 5
        `,
        [userId]
      );

      const totalItineraries = parseInt(itinerariesResult.rows[0].count);
      const totalSpent = parseFloat(spentResult.rows[0].total);

      return {
        userId,
        totalItineraries,
        totalBookings: parseInt(bookingsResult.rows[0].count),
        totalSpent,
        averageItineraryValue: totalItineraries > 0 ? totalSpent / totalItineraries : 0,
        carbonFootprint: parseFloat(carbonResult.rows[0].footprint || '0'),
        carbonOffset: parseFloat(carbonResult.rows[0].offset || '0'),
        favoriteDestinations: destinationsResult.rows.map((r) => r.country),
        preferredVendors: vendorsResult.rows.map((r) => r.business_name),
        activityBreakdown: {},
      };
    } catch (error) {
      logger.error('Failed to get user analytics', error);
      throw new Error('Failed to get user analytics');
    }
  }

  /**
   * Get analytics for a specific vendor
   */
  async getVendorAnalytics(vendorId: string): Promise<VendorAnalytics> {
    const pool = getPool();

    try {
      // Get deal statistics
      const dealsResult = await pool.query(
        `
        SELECT
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'active' THEN 1 END) as active,
          COALESCE(SUM(view_count), 0) as views
        FROM deals
        WHERE vendor_id = $1
        `,
        [vendorId]
      );

      // Get inquiries (quote requests)
      const inquiriesResult = await pool.query(
        `SELECT COUNT(*) as count FROM quotes WHERE vendor_id = $1`,
        [vendorId]
      );

      // Get accepted quotes
      const acceptedResult = await pool.query(
        `SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as revenue FROM quotes WHERE vendor_id = $1 AND status = 'accepted'`,
        [vendorId]
      );

      // Get top performing deals
      const topDealsResult = await pool.query(
        `
        SELECT
          d.id as deal_id,
          d.title,
          d.view_count as views,
          COUNT(q.id) as inquiries
        FROM deals d
        LEFT JOIN quotes q ON d.id = q.deal_id
        WHERE d.vendor_id = $1
        GROUP BY d.id, d.title, d.view_count
        ORDER BY (d.view_count + COUNT(q.id) * 10) DESC
        LIMIT 5
        `,
        [vendorId]
      );

      // Get customer satisfaction (average rating)
      const satisfactionResult = await pool.query(
        `SELECT COALESCE(AVG(rating), 0) as rating FROM ratings WHERE vendor_id = $1`,
        [vendorId]
      );

      // Calculate repeat customer rate
      const repeatCustomerResult = await pool.query(
        `
        WITH customer_purchase_counts AS (
          SELECT
            q.requester_id,
            COUNT(*) as purchase_count
          FROM quotes q
          JOIN deals d ON q.deal_id = d.id
          WHERE d.vendor_id = $1 AND q.status = 'accepted'
          GROUP BY q.requester_id
        )
        SELECT
          COUNT(*) FILTER (WHERE purchase_count > 1) as repeat_customers,
          COUNT(*) as total_customers
        FROM customer_purchase_counts
        `,
        [vendorId]
      );

      const totalDeals = parseInt(dealsResult.rows[0].total);
      const totalViews = parseInt(dealsResult.rows[0].views);
      const totalInquiries = parseInt(inquiriesResult.rows[0].count);
      const acceptedQuotes = parseInt(acceptedResult.rows[0].count);
      const totalRevenue = parseFloat(acceptedResult.rows[0].revenue);
      const repeatCustomers = parseInt(repeatCustomerResult.rows[0].repeat_customers || '0');
      const totalCustomers = parseInt(repeatCustomerResult.rows[0].total_customers || '0');

      return {
        vendorId,
        totalDeals,
        activeDeals: parseInt(dealsResult.rows[0].active),
        totalViews,
        totalInquiries,
        conversionRate: totalInquiries > 0 ? (acceptedQuotes / totalInquiries) * 100 : 0,
        totalRevenue,
        averageDealValue: acceptedQuotes > 0 ? totalRevenue / acceptedQuotes : 0,
        topPerformingDeals: topDealsResult.rows.map((r) => ({
          dealId: r.deal_id,
          title: r.title,
          views: parseInt(r.views),
          inquiries: parseInt(r.inquiries),
        })),
        customerSatisfaction: parseFloat(satisfactionResult.rows[0].rating),
        repeatCustomerRate: totalCustomers > 0 ? (repeatCustomers / totalCustomers) * 100 : 0,
      };
    } catch (error) {
      logger.error('Failed to get vendor analytics', error);
      throw new Error('Failed to get vendor analytics');
    }
  }

  /**
   * Get platform-wide analytics (admin view)
   */
  async getPlatformAnalytics(): Promise<PlatformAnalytics> {
    const pool = getPool();

    try {
      // Get user statistics
      const usersResult = await pool.query(
        `
        SELECT
          COUNT(*) as total,
          COUNT(CASE WHEN last_login_at > NOW() - INTERVAL '30 days' THEN 1 END) as active
        FROM users
        `
      );

      // Get itinerary count
      const itinerariesResult = await pool.query(
        `SELECT COUNT(*) as count FROM itineraries`
      );

      // Get revenue
      const revenueResult = await pool.query(
        `SELECT COALESCE(SUM(total), 0) as total FROM quotes WHERE status = 'accepted'`
      );

      // Get revenue growth (last 30 days vs previous 30 days)
      const revenueGrowthResult = await pool.query(
        `
        SELECT
          COALESCE(SUM(CASE WHEN created_at > NOW() - INTERVAL '30 days' THEN total ELSE 0 END), 0) as current,
          COALESCE(SUM(CASE WHEN created_at BETWEEN NOW() - INTERVAL '60 days' AND NOW() - INTERVAL '30 days' THEN total ELSE 0 END), 0) as previous
        FROM quotes
        WHERE status = 'accepted'
        `
      );

      // Get user growth
      const userGrowthResult = await pool.query(
        `
        SELECT
          COUNT(CASE WHEN created_at > NOW() - INTERVAL '30 days' THEN 1 END) as current,
          COUNT(CASE WHEN created_at BETWEEN NOW() - INTERVAL '60 days' AND NOW() - INTERVAL '30 days' THEN 1 END) as previous
        FROM users
        `
      );

      // Get top destinations
      const destinationsResult = await pool.query(
        `
        SELECT d->>'country' as destination, COUNT(*) as count
        FROM itineraries i
        CROSS JOIN jsonb_array_elements(i.destinations) as d
        GROUP BY d->>'country'
        ORDER BY count DESC
        LIMIT 10
        `
      );

      // Get top vendors by revenue
      const vendorsResult = await pool.query(
        `
        SELECT
          v.id as vendor_id,
          v.business_name as name,
          COALESCE(SUM(q.total), 0) as revenue
        FROM vendors v
        LEFT JOIN quotes q ON v.id = q.vendor_id AND q.status = 'accepted'
        GROUP BY v.id, v.business_name
        ORDER BY revenue DESC
        LIMIT 10
        `
      );

      // Get category breakdown
      const categoryResult = await pool.query(
        `
        SELECT category, COUNT(*) as count
        FROM deals
        WHERE status = 'active'
        GROUP BY category
        `
      );

      // Calculate average itinerary value (sum of all line items per itinerary)
      const avgItineraryValueResult = await pool.query(
        `
        SELECT COALESCE(AVG(total_value), 0) as avg_value
        FROM (
          SELECT
            i.id as itinerary_id,
            COALESCE(SUM(li.price * li.quantity), 0) as total_value
          FROM itineraries i
          LEFT JOIN line_items li ON i.id = li.itinerary_id
          GROUP BY i.id
        ) itinerary_values
        WHERE total_value > 0
        `
      );

      // Calculate conversion rate (itineraries with approved status / total itineraries)
      const conversionRateResult = await pool.query(
        `
        SELECT
          COUNT(*) FILTER (WHERE status = 'approved') as approved_itineraries,
          COUNT(*) as total_itineraries
        FROM itineraries
        WHERE created_at >= NOW() - INTERVAL '90 days'
        `
      );

      const currentRevenue = parseFloat(revenueGrowthResult.rows[0].current);
      const previousRevenue = parseFloat(revenueGrowthResult.rows[0].previous);
      const currentUsers = parseInt(userGrowthResult.rows[0].current);
      const previousUsers = parseInt(userGrowthResult.rows[0].previous);
      const approvedItineraries = parseInt(conversionRateResult.rows[0].approved_itineraries || '0');
      const totalItinerariesForConversion = parseInt(conversionRateResult.rows[0].total_itineraries || '0');

      return {
        totalUsers: parseInt(usersResult.rows[0].total),
        activeUsers: parseInt(usersResult.rows[0].active),
        totalItineraries: parseInt(itinerariesResult.rows[0].count),
        totalRevenue: parseFloat(revenueResult.rows[0].total),
        revenueGrowth: previousRevenue > 0 ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 : 0,
        userGrowth: previousUsers > 0 ? ((currentUsers - previousUsers) / previousUsers) * 100 : 0,
        topDestinations: destinationsResult.rows.map((r) => ({
          destination: r.destination,
          count: parseInt(r.count),
        })),
        topVendors: vendorsResult.rows.map((r) => ({
          vendorId: r.vendor_id,
          name: r.name,
          revenue: parseFloat(r.revenue),
        })),
        categoryBreakdown: categoryResult.rows.reduce((acc, r) => {
          acc[r.category] = parseInt(r.count);
          return acc;
        }, {} as Record<string, number>),
        averageItineraryValue: parseFloat(avgItineraryValueResult.rows[0].avg_value),
        conversionRate: totalItinerariesForConversion > 0 ? (approvedItineraries / totalItinerariesForConversion) * 100 : 0,
      };
    } catch (error) {
      logger.error('Failed to get platform analytics', error);
      throw new Error('Failed to get platform analytics');
    }
  }

  /**
   * Get time-series data for charts
   */
  async getTimeSeriesData(
    metric: 'revenue' | 'users' | 'itineraries' | 'bookings',
    startDate: Date,
    endDate: Date,
    granularity: 'day' | 'week' | 'month' = 'day'
  ): Promise<Array<{ date: string; value: number }>> {
    const pool = getPool();

    try {
      const truncFunc = granularity === 'day' ? 'day' : granularity === 'week' ? 'week' : 'month';

      let query = '';
      let table = '';
      let valueColumn = 'COUNT(*)';

      switch (metric) {
        case 'revenue':
          table = 'quotes';
          valueColumn = 'COALESCE(SUM(total), 0)';
          query = `WHERE status = 'accepted'`;
          break;
        case 'users':
          table = 'users';
          break;
        case 'itineraries':
          table = 'itineraries';
          break;
        case 'bookings':
          table = 'quotes';
          query = `WHERE status = 'accepted'`;
          break;
      }

      const result = await pool.query(
        `
        SELECT
          DATE_TRUNC('${truncFunc}', created_at) as date,
          ${valueColumn} as value
        FROM ${table}
        ${query}
        AND created_at BETWEEN $1 AND $2
        GROUP BY DATE_TRUNC('${truncFunc}', created_at)
        ORDER BY date ASC
        `,
        [startDate, endDate]
      );

      return result.rows.map((r) => ({
        date: r.date.toISOString().split('T')[0],
        value: parseFloat(r.value),
      }));
    } catch (error) {
      logger.error('Failed to get time series data', error);
      throw new Error('Failed to get time series data');
    }
  }
}

export const analyticsService = new AnalyticsService();
