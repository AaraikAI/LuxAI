import { getPool } from '../db';
import { logger } from '../utils/logger';

export interface VaultSearchFilters {
  category?: string;
  location?: string;
  minPrice?: number;
  maxPrice?: number;
  isExclusive?: boolean;
  isOffMarket?: boolean;
  tags?: string[];
  sustainabilityScore?: number;
  availability?: {
    startDate?: Date;
    endDate?: Date;
  };
}

export interface VaultDeal {
  id: string;
  vendorId: string;
  vendorName: string;
  vendorRating: number;
  title: string;
  description: string;
  category: string;
  subcategory?: string;
  location: {
    city: string;
    country: string;
  };
  priceRange: {
    min: number;
    max: number;
    currency: string;
  };
  isExclusive: boolean;
  isOffMarket: boolean;
  images: string[];
  tags: string[];
  sustainabilityScore?: number;
  availableFrom?: Date;
  availableUntil?: Date;
  createdAt: Date;
}

export class VaultService {
  /**
   * Search the Vault for off-market and exclusive deals
   */
  async searchDeals(filters: VaultSearchFilters): Promise<VaultDeal[]> {
    const pool = getPool();

    try {
      let query = `
        SELECT
          d.id,
          d.vendor_id,
          v.business_name as vendor_name,
          v.rating as vendor_rating,
          d.title,
          d.description,
          d.category,
          d.subcategory,
          d.location,
          d.price_range,
          d.is_exclusive,
          d.is_off_market,
          d.images,
          d.tags,
          d.sustainability_score,
          d.availability,
          d.created_at
        FROM deals d
        JOIN vendors v ON d.vendor_id = v.id
        WHERE d.status = 'active'
      `;

      const params: any[] = [];
      let paramIndex = 1;

      // Add filters
      if (filters.category) {
        query += ` AND d.category = $${paramIndex++}`;
        params.push(filters.category);
      }

      if (filters.location) {
        query += ` AND (d.location->>'city' ILIKE $${paramIndex} OR d.location->>'country' ILIKE $${paramIndex})`;
        params.push(`%${filters.location}%`);
        paramIndex++;
      }

      if (filters.minPrice !== undefined) {
        query += ` AND (d.price_range->>'min')::numeric >= $${paramIndex++}`;
        params.push(filters.minPrice);
      }

      if (filters.maxPrice !== undefined) {
        query += ` AND (d.price_range->>'max')::numeric <= $${paramIndex++}`;
        params.push(filters.maxPrice);
      }

      if (filters.isExclusive !== undefined) {
        query += ` AND d.is_exclusive = $${paramIndex++}`;
        params.push(filters.isExclusive);
      }

      if (filters.isOffMarket !== undefined) {
        query += ` AND d.is_off_market = $${paramIndex++}`;
        params.push(filters.isOffMarket);
      }

      if (filters.tags && filters.tags.length > 0) {
        query += ` AND d.tags && $${paramIndex++}::text[]`;
        params.push(filters.tags);
      }

      if (filters.sustainabilityScore !== undefined) {
        query += ` AND d.sustainability_score >= $${paramIndex++}`;
        params.push(filters.sustainabilityScore);
      }

      // Sort by relevance (exclusive + off-market first, then rating)
      query += ` ORDER BY (d.is_exclusive::int + d.is_off_market::int) DESC, v.rating DESC, d.created_at DESC`;

      query += ` LIMIT 50`;

      const result = await pool.query(query, params);

      return result.rows.map((row) => ({
        id: row.id,
        vendorId: row.vendor_id,
        vendorName: row.vendor_name,
        vendorRating: parseFloat(row.vendor_rating),
        title: row.title,
        description: row.description,
        category: row.category,
        subcategory: row.subcategory,
        location: row.location,
        priceRange: row.price_range,
        isExclusive: row.is_exclusive,
        isOffMarket: row.is_off_market,
        images: row.images,
        tags: row.tags,
        sustainabilityScore: row.sustainability_score,
        availableFrom: row.availability?.startDate,
        availableUntil: row.availability?.endDate,
        createdAt: row.created_at,
      }));
    } catch (error) {
      logger.error('Failed to search vault deals', error);
      throw new Error('Failed to search vault deals');
    }
  }

  /**
   * Get deal details by ID
   */
  async getDealById(dealId: string): Promise<VaultDeal | null> {
    const pool = getPool();

    try {
      const result = await pool.query(
        `
        SELECT
          d.id,
          d.vendor_id,
          v.business_name as vendor_name,
          v.rating as vendor_rating,
          d.title,
          d.description,
          d.category,
          d.subcategory,
          d.location,
          d.price_range,
          d.is_exclusive,
          d.is_off_market,
          d.images,
          d.tags,
          d.sustainability_score,
          d.availability,
          d.created_at
        FROM deals d
        JOIN vendors v ON d.vendor_id = v.id
        WHERE d.id = $1 AND d.status = 'active'
        `,
        [dealId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        id: row.id,
        vendorId: row.vendor_id,
        vendorName: row.vendor_name,
        vendorRating: parseFloat(row.vendor_rating),
        title: row.title,
        description: row.description,
        category: row.category,
        subcategory: row.subcategory,
        location: row.location,
        priceRange: row.price_range,
        isExclusive: row.is_exclusive,
        isOffMarket: row.is_off_market,
        images: row.images,
        tags: row.tags,
        sustainabilityScore: row.sustainability_score,
        availableFrom: row.availability?.startDate,
        availableUntil: row.availability?.endDate,
        createdAt: row.created_at,
      };
    } catch (error) {
      logger.error('Failed to get deal by ID', error);
      throw new Error('Failed to get deal');
    }
  }

  /**
   * Get featured/curated deals
   */
  async getFeaturedDeals(limit: number = 10): Promise<VaultDeal[]> {
    const pool = getPool();

    try {
      const result = await pool.query(
        `
        SELECT
          d.id,
          d.vendor_id,
          v.business_name as vendor_name,
          v.rating as vendor_rating,
          d.title,
          d.description,
          d.category,
          d.subcategory,
          d.location,
          d.price_range,
          d.is_exclusive,
          d.is_off_market,
          d.images,
          d.tags,
          d.sustainability_score,
          d.availability,
          d.created_at
        FROM deals d
        JOIN vendors v ON d.vendor_id = v.id
        WHERE d.status = 'active'
          AND (d.is_exclusive = true OR d.is_off_market = true)
        ORDER BY v.rating DESC, d.created_at DESC
        LIMIT $1
        `,
        [limit]
      );

      return result.rows.map((row) => ({
        id: row.id,
        vendorId: row.vendor_id,
        vendorName: row.vendor_name,
        vendorRating: parseFloat(row.vendor_rating),
        title: row.title,
        description: row.description,
        category: row.category,
        subcategory: row.subcategory,
        location: row.location,
        priceRange: row.price_range,
        isExclusive: row.is_exclusive,
        isOffMarket: row.is_off_market,
        images: row.images,
        tags: row.tags,
        sustainabilityScore: row.sustainability_score,
        availableFrom: row.availability?.startDate,
        availableUntil: row.availability?.endDate,
        createdAt: row.created_at,
      }));
    } catch (error) {
      logger.error('Failed to get featured deals', error);
      throw new Error('Failed to get featured deals');
    }
  }

  /**
   * Increment view count for a deal
   */
  async recordDealView(dealId: string): Promise<void> {
    const pool = getPool();

    try {
      await pool.query(
        `UPDATE deals SET view_count = view_count + 1 WHERE id = $1`,
        [dealId]
      );
    } catch (error) {
      logger.error('Failed to record deal view', error);
      // Don't throw - this is a non-critical operation
    }
  }

  /**
   * Request a quote for a deal
   */
  async requestQuote(dealId: string, clientId: string, details: any): Promise<string> {
    const pool = getPool();

    try {
      // Get deal and vendor info
      const dealResult = await pool.query(
        `SELECT vendor_id FROM deals WHERE id = $1`,
        [dealId]
      );

      if (dealResult.rows.length === 0) {
        throw new Error('Deal not found');
      }

      const vendorId = dealResult.rows[0].vendor_id;

      // Create quote request
      const quoteResult = await pool.query(
        `
        INSERT INTO quotes (
          deal_id,
          vendor_id,
          client_id,
          status,
          details,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
        RETURNING id
        `,
        [dealId, vendorId, clientId, 'draft', JSON.stringify(details)]
      );

      return quoteResult.rows[0].id;
    } catch (error) {
      logger.error('Failed to request quote', error);
      throw new Error('Failed to request quote');
    }
  }
}

export const vaultService = new VaultService();
