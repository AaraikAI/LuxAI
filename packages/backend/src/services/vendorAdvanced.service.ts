import { query } from '../db';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

export class VendorAdvancedService {
  /**
   * Get vendor inventory
   */
  async getInventory(vendorId: string): Promise<any[]> {
    try {
      const result = await query(
        `SELECT * FROM vendor_inventory WHERE vendor_id = $1 ORDER BY name ASC`,
        [vendorId]
      );

      return result.rows.map((row) => ({
        ...row,
        metadata: row.metadata,
      }));
    } catch (error) {
      logger.error('Failed to get vendor inventory', { error, vendorId });
      throw error;
    }
  }

  /**
   * Create inventory item
   */
  async createInventoryItem(data: {
    vendor_id: string;
    name: string;
    description?: string;
    category?: string;
    sku?: string;
    quantity?: number;
    min_quantity?: number;
    unit?: string;
    base_price?: number;
    metadata?: any;
  }): Promise<any> {
    try {
      const result = await query(
        `INSERT INTO vendor_inventory
         (vendor_id, name, description, category, sku, quantity, min_quantity, unit, base_price, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          data.vendor_id,
          data.name,
          data.description,
          data.category,
          data.sku,
          data.quantity || 0,
          data.min_quantity || 0,
          data.unit,
          data.base_price,
          JSON.stringify(data.metadata || {}),
        ]
      );

      logger.info('Inventory item created', { vendorId: data.vendor_id, itemId: result.rows[0].id });

      return {
        ...result.rows[0],
        metadata: result.rows[0].metadata,
      };
    } catch (error) {
      logger.error('Failed to create inventory item', { error, data });
      throw error;
    }
  }

  /**
   * Update inventory quantity
   */
  async updateInventoryQuantity(itemId: string, vendorId: string, quantity: number): Promise<void> {
    try {
      const result = await query(
        `UPDATE vendor_inventory
         SET quantity = $1, updated_at = NOW()
         WHERE id = $2 AND vendor_id = $3`,
        [quantity, itemId, vendorId]
      );

      if (result.rowCount === 0) {
        throw new AppError(404, 'NOT_FOUND', 'Inventory item not found');
      }

      logger.info('Inventory quantity updated', { itemId, vendorId, quantity });
    } catch (error) {
      logger.error('Failed to update inventory quantity', { error, itemId, vendorId });
      throw error;
    }
  }

  /**
   * Get availability for date range
   */
  async getAvailability(
    vendorId: string,
    startDate: Date,
    endDate: Date,
    inventoryId?: string
  ): Promise<any[]> {
    try {
      let sql = `
        SELECT * FROM vendor_availability
        WHERE vendor_id = $1 AND date BETWEEN $2 AND $3
      `;
      const params: any[] = [vendorId, startDate, endDate];

      if (inventoryId) {
        sql += ' AND inventory_id = $4';
        params.push(inventoryId);
      }

      sql += ' ORDER BY date ASC, start_time ASC';

      const result = await query(sql, params);

      return result.rows;
    } catch (error) {
      logger.error('Failed to get availability', { error, vendorId, startDate, endDate });
      throw error;
    }
  }

  /**
   * Set availability
   */
  async setAvailability(data: {
    vendor_id: string;
    inventory_id?: string;
    date: Date;
    start_time?: string;
    end_time?: string;
    available_quantity?: number;
    is_available: boolean;
    notes?: string;
  }): Promise<any> {
    try {
      const result = await query(
        `INSERT INTO vendor_availability
         (vendor_id, inventory_id, date, start_time, end_time, available_quantity, is_available, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (vendor_id, inventory_id, date, start_time)
         DO UPDATE SET
           end_time = $5,
           available_quantity = $6,
           is_available = $7,
           notes = $8,
           updated_at = NOW()
         RETURNING *`,
        [
          data.vendor_id,
          data.inventory_id,
          data.date,
          data.start_time,
          data.end_time,
          data.available_quantity,
          data.is_available,
          data.notes,
        ]
      );

      logger.info('Availability set', { vendorId: data.vendor_id, date: data.date });

      return result.rows[0];
    } catch (error) {
      logger.error('Failed to set availability', { error, data });
      throw error;
    }
  }

  /**
   * Get pricing rules
   */
  async getPricingRules(vendorId: string, inventoryId?: string): Promise<any[]> {
    try {
      let sql = 'SELECT * FROM pricing_rules WHERE vendor_id = $1 AND is_active = true';
      const params: any[] = [vendorId];

      if (inventoryId) {
        sql += ' AND (inventory_id = $2 OR inventory_id IS NULL)';
        params.push(inventoryId);
      }

      sql += ' ORDER BY priority DESC, created_at ASC';

      const result = await query(sql, params);

      return result.rows.map((row) => ({
        ...row,
        conditions: row.conditions,
      }));
    } catch (error) {
      logger.error('Failed to get pricing rules', { error, vendorId });
      throw error;
    }
  }

  /**
   * Create pricing rule
   */
  async createPricingRule(data: {
    vendor_id: string;
    inventory_id?: string;
    rule_type: string;
    rule_name: string;
    conditions: any;
    adjustment_type: 'percentage' | 'fixed';
    adjustment_value: number;
    priority?: number;
    start_date?: Date;
    end_date?: Date;
  }): Promise<any> {
    try {
      const result = await query(
        `INSERT INTO pricing_rules
         (vendor_id, inventory_id, rule_type, rule_name, conditions,
          adjustment_type, adjustment_value, priority, start_date, end_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          data.vendor_id,
          data.inventory_id,
          data.rule_type,
          data.rule_name,
          JSON.stringify(data.conditions),
          data.adjustment_type,
          data.adjustment_value,
          data.priority || 0,
          data.start_date,
          data.end_date,
        ]
      );

      logger.info('Pricing rule created', { vendorId: data.vendor_id, ruleId: result.rows[0].id });

      return {
        ...result.rows[0],
        conditions: result.rows[0].conditions,
      };
    } catch (error) {
      logger.error('Failed to create pricing rule', { error, data });
      throw error;
    }
  }

  /**
   * Calculate price with rules
   */
  async calculatePrice(
    vendorId: string,
    inventoryId: string,
    basePrice: number,
    context: any
  ): Promise<{ finalPrice: number; appliedRules: any[] }> {
    try {
      const rules = await this.getPricingRules(vendorId, inventoryId);

      let finalPrice = basePrice;
      const appliedRules: any[] = [];

      for (const rule of rules) {
        // Check if rule applies based on conditions
        if (this.evaluateRuleConditions(rule.conditions, context)) {
          if (rule.adjustment_type === 'percentage') {
            finalPrice = finalPrice * (1 + rule.adjustment_value / 100);
          } else {
            finalPrice = finalPrice + rule.adjustment_value;
          }

          appliedRules.push({
            rule_name: rule.rule_name,
            adjustment: rule.adjustment_value,
            type: rule.adjustment_type,
          });
        }
      }

      return {
        finalPrice: Math.max(0, finalPrice),
        appliedRules,
      };
    } catch (error) {
      logger.error('Failed to calculate price', { error, vendorId, inventoryId });
      return { finalPrice: basePrice, appliedRules: [] };
    }
  }

  /**
   * Evaluate rule conditions
   */
  private evaluateRuleConditions(conditions: any, context: any): boolean {
    // Simple condition evaluation
    // In production, this could be more sophisticated
    try {
      if (conditions.date_range) {
        const now = new Date();
        const start = new Date(conditions.date_range.start);
        const end = new Date(conditions.date_range.end);
        if (now < start || now > end) return false;
      }

      if (conditions.min_duration && context.duration < conditions.min_duration) {
        return false;
      }

      if (conditions.min_quantity && context.quantity < conditions.min_quantity) {
        return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get promotional campaigns
   */
  async getCampaigns(vendorId: string, includeInactive = false): Promise<any[]> {
    try {
      let sql = 'SELECT * FROM promotional_campaigns WHERE vendor_id = $1';
      const params: any[] = [vendorId];

      if (!includeInactive) {
        sql += ' AND is_active = true AND start_date <= NOW() AND end_date >= NOW()';
      }

      sql += ' ORDER BY created_at DESC';

      const result = await query(sql, params);

      return result.rows.map((row) => ({
        ...row,
        applicable_items: row.applicable_items,
        metadata: row.metadata,
      }));
    } catch (error) {
      logger.error('Failed to get campaigns', { error, vendorId });
      throw error;
    }
  }

  /**
   * Create promotional campaign
   */
  async createCampaign(data: {
    vendor_id: string;
    name: string;
    description?: string;
    campaign_type: string;
    discount_type?: string;
    discount_value?: number;
    min_purchase_amount?: number;
    max_discount_amount?: number;
    usage_limit?: number;
    promo_code?: string;
    applicable_items?: string[];
    start_date: Date;
    end_date: Date;
    metadata?: any;
  }): Promise<any> {
    try {
      const result = await query(
        `INSERT INTO promotional_campaigns
         (vendor_id, name, description, campaign_type, discount_type, discount_value,
          min_purchase_amount, max_discount_amount, usage_limit, promo_code,
          applicable_items, start_date, end_date, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         RETURNING *`,
        [
          data.vendor_id,
          data.name,
          data.description,
          data.campaign_type,
          data.discount_type,
          data.discount_value,
          data.min_purchase_amount,
          data.max_discount_amount,
          data.usage_limit,
          data.promo_code,
          JSON.stringify(data.applicable_items || []),
          data.start_date,
          data.end_date,
          JSON.stringify(data.metadata || {}),
        ]
      );

      logger.info('Campaign created', { vendorId: data.vendor_id, campaignId: result.rows[0].id });

      return {
        ...result.rows[0],
        applicable_items: result.rows[0].applicable_items,
        metadata: result.rows[0].metadata,
      };
    } catch (error) {
      logger.error('Failed to create campaign', { error, data });
      throw error;
    }
  }

  /**
   * Validate and apply promo code
   */
  async applyPromoCode(
    promoCode: string,
    userId: string,
    purchaseAmount: number,
    vendorId?: string
  ): Promise<{ valid: boolean; discount: number; campaign?: any }> {
    try {
      let sql = `
        SELECT * FROM promotional_campaigns
        WHERE promo_code = $1
          AND is_active = true
          AND start_date <= NOW()
          AND end_date >= NOW()
          AND (usage_limit IS NULL OR usage_count < usage_limit)
      `;
      const params: any[] = [promoCode];

      if (vendorId) {
        sql += ' AND vendor_id = $2';
        params.push(vendorId);
      }

      const result = await query(sql, params);

      if (result.rows.length === 0) {
        return { valid: false, discount: 0 };
      }

      const campaign = result.rows[0];

      // Check minimum purchase amount
      if (campaign.min_purchase_amount && purchaseAmount < campaign.min_purchase_amount) {
        return { valid: false, discount: 0 };
      }

      // Calculate discount
      let discount = 0;
      if (campaign.discount_type === 'percentage') {
        discount = (purchaseAmount * campaign.discount_value) / 100;
      } else if (campaign.discount_type === 'fixed') {
        discount = campaign.discount_value;
      }

      // Apply max discount cap
      if (campaign.max_discount_amount && discount > campaign.max_discount_amount) {
        discount = campaign.max_discount_amount;
      }

      return {
        valid: true,
        discount,
        campaign: {
          ...campaign,
          applicable_items: campaign.applicable_items,
          metadata: campaign.metadata,
        },
      };
    } catch (error) {
      logger.error('Failed to apply promo code', { error, promoCode, userId });
      return { valid: false, discount: 0 };
    }
  }

  /**
   * Record campaign usage
   */
  async recordCampaignUsage(data: {
    campaign_id: string;
    user_id: string;
    booking_id?: string;
    discount_amount: number;
  }): Promise<void> {
    try {
      await query(
        `INSERT INTO campaign_usage (campaign_id, user_id, booking_id, discount_amount)
         VALUES ($1, $2, $3, $4)`,
        [data.campaign_id, data.user_id, data.booking_id, data.discount_amount]
      );

      // Increment usage count
      await query(
        'UPDATE promotional_campaigns SET usage_count = usage_count + 1 WHERE id = $1',
        [data.campaign_id]
      );

      logger.info('Campaign usage recorded', { campaignId: data.campaign_id, userId: data.user_id });
    } catch (error) {
      logger.error('Failed to record campaign usage', { error, data });
      throw error;
    }
  }
}

export const vendorAdvancedService = new VendorAdvancedService();
