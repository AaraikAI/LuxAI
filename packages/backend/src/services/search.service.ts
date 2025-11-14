import { query } from '../db';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

export interface SearchFilters {
  query?: string;
  entity_type?: string;
  date_from?: string;
  date_to?: string;
  status?: string;
  role?: string;
  limit?: number;
  offset?: number;
}

export interface SearchResult {
  id: string;
  type: string;
  title: string;
  description?: string;
  metadata: any;
  created_at: Date;
  relevance?: number;
}

export interface SavedSearch {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  query?: string;
  filters: any;
  entity_type: string;
  is_default: boolean;
  created_at: Date;
  updated_at: Date;
}

export class SearchService {
  /**
   * Global search across all entities
   */
  async globalSearch(
    userId: string,
    filters: SearchFilters
  ): Promise<{ results: SearchResult[]; total: number }> {
    try {
      const { query: searchQuery, entity_type, limit = 50, offset = 0 } = filters;

      if (!searchQuery || searchQuery.trim().length < 2) {
        return { results: [], total: 0 };
      }

      let results: SearchResult[] = [];

      // Search based on entity type or search all
      if (!entity_type || entity_type === 'all') {
        // Search all entities in parallel
        const [users, itineraries, bookings, vendors] = await Promise.all([
          this.searchUsers(userId, searchQuery, 10),
          this.searchItineraries(userId, searchQuery, 10),
          this.searchBookings(userId, searchQuery, 10),
          this.searchVendors(userId, searchQuery, 10),
        ]);

        results = [...users, ...itineraries, ...bookings, ...vendors];
      } else {
        // Search specific entity type
        switch (entity_type) {
          case 'users':
            results = await this.searchUsers(userId, searchQuery, limit);
            break;
          case 'itineraries':
            results = await this.searchItineraries(userId, searchQuery, limit);
            break;
          case 'bookings':
            results = await this.searchBookings(userId, searchQuery, limit);
            break;
          case 'vendors':
            results = await this.searchVendors(userId, searchQuery, limit);
            break;
          default:
            throw new AppError(400, 'INVALID_INPUT', 'Invalid entity type');
        }
      }

      // Sort by relevance
      results.sort((a, b) => (b.relevance || 0) - (a.relevance || 0));

      // Apply pagination
      const paginatedResults = results.slice(offset, offset + limit);

      // Save to search history
      await this.saveSearchHistory(userId, searchQuery, filters, results.length);

      return {
        results: paginatedResults,
        total: results.length,
      };
    } catch (error) {
      logger.error('Global search failed', { error, userId, filters });
      throw error;
    }
  }

  /**
   * Search users
   */
  private async searchUsers(userId: string, searchQuery: string, limit: number): Promise<SearchResult[]> {
    try {
      // Get user role to determine access
      const userResult = await query('SELECT role FROM users WHERE id = $1', [userId]);
      const userRole = userResult.rows[0]?.role;

      // Only admins can search all users
      if (userRole !== 'admin') {
        return [];
      }

      const result = await query(
        `SELECT id, email, full_name, role, created_at,
                ts_rank(to_tsvector('english', coalesce(email, '') || ' ' || coalesce(full_name, '')),
                        plainto_tsquery('english', $1)) as relevance
         FROM users
         WHERE to_tsvector('english', coalesce(email, '') || ' ' || coalesce(full_name, ''))
               @@ plainto_tsquery('english', $1)
         ORDER BY relevance DESC
         LIMIT $2`,
        [searchQuery, limit]
      );

      return result.rows.map((row) => ({
        id: row.id,
        type: 'user',
        title: row.full_name || row.email,
        description: `${row.role} - ${row.email}`,
        metadata: {
          email: row.email,
          role: row.role,
        },
        created_at: row.created_at,
        relevance: parseFloat(row.relevance),
      }));
    } catch (error) {
      logger.error('User search failed', { error, searchQuery });
      return [];
    }
  }

  /**
   * Search itineraries
   */
  private async searchItineraries(
    userId: string,
    searchQuery: string,
    limit: number
  ): Promise<SearchResult[]> {
    try {
      // Get user role
      const userResult = await query('SELECT role FROM users WHERE id = $1', [userId]);
      const userRole = userResult.rows[0]?.role;

      let whereClause = '';
      const params: any[] = [searchQuery, limit];

      // Non-admins can only see their own itineraries
      if (userRole !== 'admin') {
        whereClause = 'AND user_id = $3';
        params.push(userId);
      }

      const result = await query(
        `SELECT id, title, description, status, destination, start_date, end_date, created_at,
                ts_rank(to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, '') || ' ' || coalesce(destination, '')),
                        plainto_tsquery('english', $1)) as relevance
         FROM itineraries
         WHERE to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, '') || ' ' || coalesce(destination, ''))
               @@ plainto_tsquery('english', $1)
               ${whereClause}
         ORDER BY relevance DESC
         LIMIT $2`,
        params
      );

      return result.rows.map((row) => ({
        id: row.id,
        type: 'itinerary',
        title: row.title,
        description: row.description || `Trip to ${row.destination}`,
        metadata: {
          status: row.status,
          destination: row.destination,
          start_date: row.start_date,
          end_date: row.end_date,
        },
        created_at: row.created_at,
        relevance: parseFloat(row.relevance),
      }));
    } catch (error) {
      logger.error('Itinerary search failed', { error, searchQuery });
      return [];
    }
  }

  /**
   * Search bookings
   */
  private async searchBookings(
    userId: string,
    searchQuery: string,
    limit: number
  ): Promise<SearchResult[]> {
    try {
      const userResult = await query('SELECT role FROM users WHERE id = $1', [userId]);
      const userRole = userResult.rows[0]?.role;

      let whereClause = '';
      const params: any[] = [searchQuery, limit];

      if (userRole !== 'admin') {
        whereClause = 'AND b.user_id = $3';
        params.push(userId);
      }

      const result = await query(
        `SELECT b.id, b.booking_reference, b.status, b.total_amount, b.created_at,
                i.title as itinerary_title
         FROM bookings b
         LEFT JOIN itineraries i ON b.itinerary_id = i.id
         WHERE b.booking_reference ILIKE $1 || '%'
               ${whereClause}
         ORDER BY b.created_at DESC
         LIMIT $2`,
        params
      ).catch(() => ({ rows: [] }));

      return result.rows.map((row) => ({
        id: row.id,
        type: 'booking',
        title: `Booking ${row.booking_reference}`,
        description: row.itinerary_title || 'Booking',
        metadata: {
          booking_reference: row.booking_reference,
          status: row.status,
          total_amount: row.total_amount,
        },
        created_at: row.created_at,
        relevance: 1,
      }));
    } catch (error) {
      logger.error('Booking search failed', { error, searchQuery });
      return [];
    }
  }

  /**
   * Search vendors
   */
  private async searchVendors(
    userId: string,
    searchQuery: string,
    limit: number
  ): Promise<SearchResult[]> {
    try {
      const result = await query(
        `SELECT id, company_name, category, description, location, created_at
         FROM vendors
         WHERE company_name ILIKE '%' || $1 || '%'
            OR category ILIKE '%' || $1 || '%'
            OR location ILIKE '%' || $1 || '%'
         ORDER BY company_name
         LIMIT $2`,
        [searchQuery, limit]
      ).catch(() => ({ rows: [] }));

      return result.rows.map((row) => ({
        id: row.id,
        type: 'vendor',
        title: row.company_name,
        description: `${row.category} - ${row.location}`,
        metadata: {
          category: row.category,
          location: row.location,
        },
        created_at: row.created_at,
        relevance: 1,
      }));
    } catch (error) {
      logger.error('Vendor search failed', { error, searchQuery });
      return [];
    }
  }

  /**
   * Save search to history
   */
  private async saveSearchHistory(
    userId: string,
    searchQuery: string,
    filters: SearchFilters,
    resultsCount: number
  ): Promise<void> {
    try {
      await query(
        `INSERT INTO search_history (user_id, query, filters, entity_type, results_count)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, searchQuery, JSON.stringify(filters), filters.entity_type || 'all', resultsCount]
      );
    } catch (error) {
      // Don't fail the search if history save fails
      logger.error('Failed to save search history', { error });
    }
  }

  /**
   * Get user's search history
   */
  async getSearchHistory(
    userId: string,
    limit: number = 20
  ): Promise<any[]> {
    try {
      const result = await query(
        `SELECT id, query, filters, entity_type, results_count, created_at
         FROM search_history
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT $2`,
        [userId, limit]
      );

      return result.rows.map((row) => ({
        ...row,
        filters: row.filters,
      }));
    } catch (error) {
      logger.error('Failed to get search history', { error, userId });
      throw error;
    }
  }

  /**
   * Clear user's search history
   */
  async clearSearchHistory(userId: string): Promise<void> {
    try {
      await query('DELETE FROM search_history WHERE user_id = $1', [userId]);
      logger.info('Search history cleared', { userId });
    } catch (error) {
      logger.error('Failed to clear search history', { error, userId });
      throw error;
    }
  }

  /**
   * Get user's saved searches
   */
  async getSavedSearches(userId: string): Promise<SavedSearch[]> {
    try {
      const result = await query(
        `SELECT id, user_id, name, description, query, filters, entity_type, is_default, created_at, updated_at
         FROM saved_searches
         WHERE user_id = $1
         ORDER BY is_default DESC, name ASC`,
        [userId]
      );

      return result.rows.map((row) => ({
        ...row,
        filters: row.filters,
      }));
    } catch (error) {
      logger.error('Failed to get saved searches', { error, userId });
      throw error;
    }
  }

  /**
   * Create saved search
   */
  async createSavedSearch(data: {
    user_id: string;
    name: string;
    description?: string;
    query?: string;
    filters: any;
    entity_type: string;
    is_default?: boolean;
  }): Promise<SavedSearch> {
    try {
      const result = await query(
        `INSERT INTO saved_searches (user_id, name, description, query, filters, entity_type, is_default)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          data.user_id,
          data.name,
          data.description,
          data.query,
          JSON.stringify(data.filters),
          data.entity_type,
          data.is_default || false,
        ]
      );

      logger.info('Saved search created', { userId: data.user_id, name: data.name });

      return {
        ...result.rows[0],
        filters: result.rows[0].filters,
      };
    } catch (error) {
      logger.error('Failed to create saved search', { error, data });
      throw error;
    }
  }

  /**
   * Update saved search
   */
  async updateSavedSearch(
    id: string,
    userId: string,
    updates: {
      name?: string;
      description?: string;
      query?: string;
      filters?: any;
      entity_type?: string;
      is_default?: boolean;
    }
  ): Promise<SavedSearch> {
    try {
      const updateFields: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (updates.name !== undefined) {
        updateFields.push(`name = $${paramIndex++}`);
        params.push(updates.name);
      }

      if (updates.description !== undefined) {
        updateFields.push(`description = $${paramIndex++}`);
        params.push(updates.description);
      }

      if (updates.query !== undefined) {
        updateFields.push(`query = $${paramIndex++}`);
        params.push(updates.query);
      }

      if (updates.filters !== undefined) {
        updateFields.push(`filters = $${paramIndex++}`);
        params.push(JSON.stringify(updates.filters));
      }

      if (updates.entity_type !== undefined) {
        updateFields.push(`entity_type = $${paramIndex++}`);
        params.push(updates.entity_type);
      }

      if (updates.is_default !== undefined) {
        updateFields.push(`is_default = $${paramIndex++}`);
        params.push(updates.is_default);
      }

      if (updateFields.length === 0) {
        throw new AppError(400, 'INVALID_INPUT', 'No valid update fields provided');
      }

      params.push(id, userId);

      const result = await query(
        `UPDATE saved_searches
         SET ${updateFields.join(', ')}, updated_at = NOW()
         WHERE id = $${paramIndex++} AND user_id = $${paramIndex}
         RETURNING *`,
        params
      );

      if (result.rows.length === 0) {
        throw new AppError(404, 'NOT_FOUND', 'Saved search not found');
      }

      logger.info('Saved search updated', { id, userId });

      return {
        ...result.rows[0],
        filters: result.rows[0].filters,
      };
    } catch (error) {
      logger.error('Failed to update saved search', { error, id, userId });
      throw error;
    }
  }

  /**
   * Delete saved search
   */
  async deleteSavedSearch(id: string, userId: string): Promise<void> {
    try {
      const result = await query(
        'DELETE FROM saved_searches WHERE id = $1 AND user_id = $2',
        [id, userId]
      );

      if (result.rowCount === 0) {
        throw new AppError(404, 'NOT_FOUND', 'Saved search not found');
      }

      logger.info('Saved search deleted', { id, userId });
    } catch (error) {
      logger.error('Failed to delete saved search', { error, id, userId });
      throw error;
    }
  }
}

export const searchService = new SearchService();
