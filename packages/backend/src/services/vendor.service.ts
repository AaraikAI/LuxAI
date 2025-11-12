import { query, withTransaction } from '../db';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';
import { PoolClient } from 'pg';

export enum VendorOnboardingStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  KYB_VERIFICATION = 'kyb_verification',
  APPROVED = 'approved',
  REJECTED = 'rejected'
}

export interface VendorOnboardingRequest {
  userId: string;
  businessName: string;
  legalName: string;
  registrationNumber: string;
  category: string;
  capabilities: string[];
  safetyBadges?: string[];
  insuranceCoverage: number;
  insuranceExpiresAt: Date;
  businessAddress: any;
  businessEmail: string;
  businessPhone: string;
  taxId: string;
  bankAccount: BankAccountDetails;
}

export interface BankAccountDetails {
  accountHolderName: string;
  accountNumber: string;
  routingNumber: string;
  accountType: 'checking' | 'savings';
  bankName: string;
}

export interface VendorProfile {
  id: string;
  userId: string;
  businessName: string;
  category: string;
  status: VendorOnboardingStatus;
  rating: number;
  reviewCount: number;
  dealCount: number;
  completedBookings: number;
  responseTime: number; // average in minutes
  createdAt: Date;
}

export interface DealCreationRequest {
  vendorId: string;
  title: string;
  description: string;
  category: string;
  subcategory?: string;
  location: any;
  priceRange: {
    min: number;
    max: number;
    currency: string;
  };
  isExclusive: boolean;
  isOffMarket: boolean;
  availability?: any;
  images: string[];
  tags: string[];
  sustainabilityScore?: number;
}

/**
 * Vendor Studio Service
 * Handles vendor onboarding, profile management, and deal creation
 */
export class VendorService {
  /**
   * Submit vendor onboarding application
   */
  async submitOnboarding(request: VendorOnboardingRequest): Promise<{
    vendorId: string;
    status: VendorOnboardingStatus;
  }> {
    try {
      return await withTransaction(async (client: PoolClient) => {
        // Check if user already has a vendor profile
        const existingVendor = await client.query(
          'SELECT id FROM vendors WHERE user_id = $1',
          [request.userId]
        );

        if (existingVendor.rows.length > 0) {
          throw new AppError(409, 'VENDOR_EXISTS', 'User already has a vendor profile');
        }

        // Validate insurance coverage
        if (request.insuranceCoverage < 1000000) {
          throw new AppError(
            400,
            'INSUFFICIENT_INSURANCE',
            'Minimum $1M insurance coverage required'
          );
        }

        // Create vendor record
        const vendorResult = await client.query(
          `INSERT INTO vendors (
            user_id, business_name, legal_name, registration_number,
            category, capabilities, safety_badges, insurance_coverage,
            insurance_expires_at, kyb_status, rating, review_count
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          RETURNING id`,
          [
            request.userId,
            request.businessName,
            request.legalName,
            request.registrationNumber,
            request.category,
            request.capabilities,
            request.safetyBadges || [],
            request.insuranceCoverage,
            request.insuranceExpiresAt,
            'pending',
            0,
            0
          ]
        );

        const vendorId = vendorResult.rows[0].id;

        // Store business details in documents table
        await client.query(
          `INSERT INTO documents (
            user_id, related_entity_id, related_entity_type, type, name, url, mime_type, size, status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            request.userId,
            vendorId,
            'vendor',
            'insurance',
            'Insurance Certificate',
            '', // URL to be uploaded
            'application/pdf',
            0,
            'pending_review'
          ]
        );

        logger.info('Vendor onboarding submitted', { vendorId, userId: request.userId });

        return {
          vendorId,
          status: VendorOnboardingStatus.IN_PROGRESS,
        };
      });
    } catch (error: any) {
      logger.error('Failed to submit vendor onboarding', { error, request });
      throw error;
    }
  }

  /**
   * Update vendor KYB status
   */
  async updateKYBStatus(
    vendorId: string,
    status: 'verified' | 'rejected',
    notes?: string
  ): Promise<void> {
    try {
      await query(
        `UPDATE vendors
         SET kyb_status = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [status, vendorId]
      );

      logger.info('Vendor KYB status updated', { vendorId, status });
    } catch (error: any) {
      logger.error('Failed to update KYB status', { error, vendorId });
      throw new AppError(500, 'KYB_UPDATE_FAILED', 'Failed to update KYB status');
    }
  }

  /**
   * Get vendor profile
   */
  async getVendorProfile(vendorId: string): Promise<VendorProfile> {
    try {
      const result = await query(
        `SELECT
          v.id, v.user_id, v.business_name, v.category, v.kyb_status as status,
          v.rating, v.review_count, v.created_at,
          COUNT(DISTINCT d.id) as deal_count,
          0 as completed_bookings,
          0 as response_time
         FROM vendors v
         LEFT JOIN deals d ON d.vendor_id = v.id
         WHERE v.id = $1
         GROUP BY v.id`,
        [vendorId]
      );

      if (result.rows.length === 0) {
        throw new AppError(404, 'VENDOR_NOT_FOUND', 'Vendor not found');
      }

      return result.rows[0];
    } catch (error: any) {
      logger.error('Failed to get vendor profile', { error, vendorId });
      throw error;
    }
  }

  /**
   * Create deal/listing
   */
  async createDeal(request: DealCreationRequest): Promise<{ dealId: string }> {
    try {
      // Verify vendor is approved
      const vendorResult = await query(
        'SELECT kyb_status FROM vendors WHERE id = $1',
        [request.vendorId]
      );

      if (vendorResult.rows.length === 0) {
        throw new AppError(404, 'VENDOR_NOT_FOUND', 'Vendor not found');
      }

      if (vendorResult.rows[0].kyb_status !== 'verified') {
        throw new AppError(
          403,
          'VENDOR_NOT_VERIFIED',
          'Vendor must be verified to create deals'
        );
      }

      const result = await query(
        `INSERT INTO deals (
          vendor_id, title, description, category, subcategory,
          location, price_range, is_exclusive, is_off_market,
          availability, images, tags, sustainability_score
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING id`,
        [
          request.vendorId,
          request.title,
          request.description,
          request.category,
          request.subcategory,
          JSON.stringify(request.location),
          JSON.stringify(request.priceRange),
          request.isExclusive,
          request.isOffMarket,
          JSON.stringify(request.availability || {}),
          request.images,
          request.tags,
          request.sustainabilityScore,
        ]
      );

      const dealId = result.rows[0].id;

      logger.info('Deal created', { dealId, vendorId: request.vendorId });

      return { dealId };
    } catch (error: any) {
      logger.error('Failed to create deal', { error, request });
      throw error;
    }
  }

  /**
   * Get vendor deals
   */
  async getVendorDeals(vendorId: string): Promise<any[]> {
    try {
      const result = await query(
        `SELECT * FROM deals
         WHERE vendor_id = $1
         ORDER BY created_at DESC`,
        [vendorId]
      );

      return result.rows;
    } catch (error: any) {
      logger.error('Failed to get vendor deals', { error, vendorId });
      throw new AppError(500, 'DEALS_FETCH_FAILED', 'Failed to fetch deals');
    }
  }

  /**
   * Update deal
   */
  async updateDeal(
    dealId: string,
    vendorId: string,
    updates: Partial<DealCreationRequest>
  ): Promise<void> {
    try {
      // Verify ownership
      const dealResult = await query(
        'SELECT vendor_id FROM deals WHERE id = $1',
        [dealId]
      );

      if (dealResult.rows.length === 0) {
        throw new AppError(404, 'DEAL_NOT_FOUND', 'Deal not found');
      }

      if (dealResult.rows[0].vendor_id !== vendorId) {
        throw new AppError(403, 'FORBIDDEN', 'Not authorized to update this deal');
      }

      // Build update query dynamically
      const updateFields: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      if (updates.title !== undefined) {
        updateFields.push(`title = $${paramCount++}`);
        values.push(updates.title);
      }
      if (updates.description !== undefined) {
        updateFields.push(`description = $${paramCount++}`);
        values.push(updates.description);
      }
      if (updates.priceRange !== undefined) {
        updateFields.push(`price_range = $${paramCount++}`);
        values.push(JSON.stringify(updates.priceRange));
      }
      if (updates.availability !== undefined) {
        updateFields.push(`availability = $${paramCount++}`);
        values.push(JSON.stringify(updates.availability));
      }
      if (updates.images !== undefined) {
        updateFields.push(`images = $${paramCount++}`);
        values.push(updates.images);
      }

      if (updateFields.length === 0) {
        return;
      }

      updateFields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(dealId);

      await query(
        `UPDATE deals SET ${updateFields.join(', ')} WHERE id = $${paramCount}`,
        values
      );

      logger.info('Deal updated', { dealId, vendorId });
    } catch (error: any) {
      logger.error('Failed to update deal', { error, dealId });
      throw error;
    }
  }

  /**
   * Delete deal
   */
  async deleteDeal(dealId: string, vendorId: string): Promise<void> {
    try {
      // Verify ownership
      const dealResult = await query(
        'SELECT vendor_id FROM deals WHERE id = $1',
        [dealId]
      );

      if (dealResult.rows.length === 0) {
        throw new AppError(404, 'DEAL_NOT_FOUND', 'Deal not found');
      }

      if (dealResult.rows[0].vendor_id !== vendorId) {
        throw new AppError(403, 'FORBIDDEN', 'Not authorized to delete this deal');
      }

      await query('DELETE FROM deals WHERE id = $1', [dealId]);

      logger.info('Deal deleted', { dealId, vendorId });
    } catch (error: any) {
      logger.error('Failed to delete deal', { error, dealId });
      throw error;
    }
  }

  /**
   * Get vendor analytics
   */
  async getVendorAnalytics(vendorId: string): Promise<any> {
    try {
      const result = await query(
        `SELECT
          COUNT(DISTINCT d.id) as total_deals,
          COUNT(DISTINCT q.id) as total_quotes,
          COUNT(DISTINCT CASE WHEN q.status = 'accepted' THEN q.id END) as accepted_quotes,
          COALESCE(SUM(CASE WHEN q.status = 'accepted' THEN q.total END), 0) as total_revenue,
          v.rating,
          v.review_count
         FROM vendors v
         LEFT JOIN deals d ON d.vendor_id = v.id
         LEFT JOIN quotes q ON q.vendor_id = v.id
         WHERE v.id = $1
         GROUP BY v.id`,
        [vendorId]
      );

      if (result.rows.length === 0) {
        return {
          total_deals: 0,
          total_quotes: 0,
          accepted_quotes: 0,
          total_revenue: 0,
          rating: 0,
          review_count: 0,
        };
      }

      return result.rows[0];
    } catch (error: any) {
      logger.error('Failed to get vendor analytics', { error, vendorId });
      throw new AppError(500, 'ANALYTICS_FAILED', 'Failed to fetch analytics');
    }
  }

  /**
   * Search deals in the Vault
   */
  async searchDeals(filters: {
    category?: string;
    minPrice?: number;
    maxPrice?: number;
    location?: string;
    isOffMarket?: boolean;
    tags?: string[];
    limit?: number;
    offset?: number;
  }): Promise<{ deals: any[]; total: number }> {
    try {
      let whereConditions: string[] = [];
      let values: any[] = [];
      let paramCount = 1;

      if (filters.category) {
        whereConditions.push(`d.category = $${paramCount++}`);
        values.push(filters.category);
      }

      if (filters.isOffMarket !== undefined) {
        whereConditions.push(`d.is_off_market = $${paramCount++}`);
        values.push(filters.isOffMarket);
      }

      if (filters.tags && filters.tags.length > 0) {
        whereConditions.push(`d.tags && $${paramCount++}`);
        values.push(filters.tags);
      }

      const whereClause = whereConditions.length > 0
        ? `WHERE ${whereConditions.join(' AND ')}`
        : '';

      // Get total count
      const countResult = await query(
        `SELECT COUNT(*) FROM deals d ${whereClause}`,
        values
      );
      const total = parseInt(countResult.rows[0].count);

      // Get deals
      const limit = filters.limit || 20;
      const offset = filters.offset || 0;

      const result = await query(
        `SELECT d.*, v.business_name as vendor_name, v.rating as vendor_rating
         FROM deals d
         JOIN vendors v ON v.id = d.vendor_id
         ${whereClause}
         ORDER BY d.created_at DESC
         LIMIT $${paramCount++} OFFSET $${paramCount++}`,
        [...values, limit, offset]
      );

      return {
        deals: result.rows,
        total,
      };
    } catch (error: any) {
      logger.error('Failed to search deals', { error, filters });
      throw new AppError(500, 'DEALS_SEARCH_FAILED', 'Failed to search deals');
    }
  }
}

export const vendorService = new VendorService();
