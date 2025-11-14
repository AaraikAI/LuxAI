import { query } from '../db';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

export interface ReportTemplate {
  id: string;
  name: string;
  description?: string;
  category: string;
  config: any;
  is_system: boolean;
  created_by?: string;
  created_at: Date;
  updated_at: Date;
}

export interface CustomReport {
  id: string;
  user_id: string;
  template_id?: string;
  name: string;
  description?: string;
  config: any;
  is_scheduled: boolean;
  schedule_cron?: string;
  last_run_at?: Date;
  next_run_at?: Date;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface ReportExecution {
  id: string;
  report_id: string;
  user_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result_data?: any;
  error_message?: string;
  execution_time_ms?: number;
  row_count: number;
  file_url?: string;
  started_at?: Date;
  completed_at?: Date;
  created_at: Date;
}

export class ReportingService {
  /**
   * Get all report templates
   */
  async getTemplates(category?: string): Promise<ReportTemplate[]> {
    try {
      let sql = 'SELECT * FROM report_templates';
      const params: any[] = [];

      if (category) {
        sql += ' WHERE category = $1';
        params.push(category);
      }

      sql += ' ORDER BY is_system DESC, name ASC';

      const result = await query(sql, params);

      return result.rows.map((row) => ({
        ...row,
        config: row.config,
      }));
    } catch (error) {
      logger.error('Failed to get report templates', { error });
      throw error;
    }
  }

  /**
   * Create report template
   */
  async createTemplate(data: {
    name: string;
    description?: string;
    category: string;
    config: any;
    created_by: string;
  }): Promise<ReportTemplate> {
    try {
      const result = await query(
        `INSERT INTO report_templates (name, description, category, config, created_by)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [data.name, data.description, data.category, JSON.stringify(data.config), data.created_by]
      );

      logger.info('Report template created', { name: data.name });

      return {
        ...result.rows[0],
        config: result.rows[0].config,
      };
    } catch (error) {
      logger.error('Failed to create report template', { error, data });
      throw error;
    }
  }

  /**
   * Get user's custom reports
   */
  async getUserReports(userId: string): Promise<CustomReport[]> {
    try {
      const result = await query(
        `SELECT * FROM custom_reports
         WHERE user_id = $1
         ORDER BY created_at DESC`,
        [userId]
      );

      return result.rows.map((row) => ({
        ...row,
        config: row.config,
      }));
    } catch (error) {
      logger.error('Failed to get user reports', { error, userId });
      throw error;
    }
  }

  /**
   * Create custom report
   */
  async createReport(data: {
    user_id: string;
    template_id?: string;
    name: string;
    description?: string;
    config: any;
    is_scheduled?: boolean;
    schedule_cron?: string;
  }): Promise<CustomReport> {
    try {
      // Calculate next run time if scheduled
      let nextRunAt = null;
      if (data.is_scheduled && data.schedule_cron) {
        // Simple next run calculation (can be enhanced with cron parser)
        nextRunAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // Default: 24 hours
      }

      const result = await query(
        `INSERT INTO custom_reports
         (user_id, template_id, name, description, config, is_scheduled, schedule_cron, next_run_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          data.user_id,
          data.template_id,
          data.name,
          data.description,
          JSON.stringify(data.config),
          data.is_scheduled || false,
          data.schedule_cron,
          nextRunAt,
        ]
      );

      logger.info('Custom report created', { userId: data.user_id, name: data.name });

      return {
        ...result.rows[0],
        config: result.rows[0].config,
      };
    } catch (error) {
      logger.error('Failed to create custom report', { error, data });
      throw error;
    }
  }

  /**
   * Update custom report
   */
  async updateReport(
    reportId: string,
    userId: string,
    updates: {
      name?: string;
      description?: string;
      config?: any;
      is_scheduled?: boolean;
      schedule_cron?: string;
      is_active?: boolean;
    }
  ): Promise<CustomReport> {
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

      if (updates.config !== undefined) {
        updateFields.push(`config = $${paramIndex++}`);
        params.push(JSON.stringify(updates.config));
      }

      if (updates.is_scheduled !== undefined) {
        updateFields.push(`is_scheduled = $${paramIndex++}`);
        params.push(updates.is_scheduled);
      }

      if (updates.schedule_cron !== undefined) {
        updateFields.push(`schedule_cron = $${paramIndex++}`);
        params.push(updates.schedule_cron);
      }

      if (updates.is_active !== undefined) {
        updateFields.push(`is_active = $${paramIndex++}`);
        params.push(updates.is_active);
      }

      if (updateFields.length === 0) {
        throw new AppError(400, 'INVALID_INPUT', 'No valid update fields provided');
      }

      params.push(reportId, userId);

      const result = await query(
        `UPDATE custom_reports
         SET ${updateFields.join(', ')}, updated_at = NOW()
         WHERE id = $${paramIndex++} AND user_id = $${paramIndex}
         RETURNING *`,
        params
      );

      if (result.rows.length === 0) {
        throw new AppError(404, 'NOT_FOUND', 'Report not found');
      }

      logger.info('Custom report updated', { reportId, userId });

      return {
        ...result.rows[0],
        config: result.rows[0].config,
      };
    } catch (error) {
      logger.error('Failed to update report', { error, reportId, userId });
      throw error;
    }
  }

  /**
   * Delete custom report
   */
  async deleteReport(reportId: string, userId: string): Promise<void> {
    try {
      const result = await query(
        'DELETE FROM custom_reports WHERE id = $1 AND user_id = $2',
        [reportId, userId]
      );

      if (result.rowCount === 0) {
        throw new AppError(404, 'NOT_FOUND', 'Report not found');
      }

      logger.info('Custom report deleted', { reportId, userId });
    } catch (error) {
      logger.error('Failed to delete report', { error, reportId, userId });
      throw error;
    }
  }

  /**
   * Execute report
   */
  async executeReport(reportId: string, userId: string): Promise<ReportExecution> {
    const startTime = Date.now();

    try {
      // Get report configuration
      const reportResult = await query(
        'SELECT * FROM custom_reports WHERE id = $1 AND user_id = $2',
        [reportId, userId]
      );

      if (reportResult.rows.length === 0) {
        throw new AppError(404, 'NOT_FOUND', 'Report not found');
      }

      const report = reportResult.rows[0];
      const config = report.config;

      // Create execution record
      const executionResult = await query(
        `INSERT INTO report_executions (report_id, user_id, status, started_at)
         VALUES ($1, $2, 'running', NOW())
         RETURNING id`,
        [reportId, userId]
      );

      const executionId = executionResult.rows[0].id;

      // Execute the report query based on config
      const reportData = await this.runReportQuery(config);

      const executionTime = Date.now() - startTime;

      // Update execution record with results
      const finalResult = await query(
        `UPDATE report_executions
         SET status = 'completed',
             result_data = $1,
             row_count = $2,
             execution_time_ms = $3,
             completed_at = NOW()
         WHERE id = $4
         RETURNING *`,
        [JSON.stringify(reportData), reportData.length, executionTime, executionId]
      );

      // Update last_run_at on the report
      await query(
        'UPDATE custom_reports SET last_run_at = NOW() WHERE id = $1',
        [reportId]
      );

      logger.info('Report executed successfully', { reportId, executionId, rowCount: reportData.length });

      return {
        ...finalResult.rows[0],
        result_data: finalResult.rows[0].result_data,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;

      // Record failure
      await query(
        `INSERT INTO report_executions
         (report_id, user_id, status, error_message, execution_time_ms, completed_at, started_at)
         VALUES ($1, $2, 'failed', $3, $4, NOW(), NOW())`,
        [reportId, userId, (error as Error).message, executionTime]
      ).catch(() => {});

      logger.error('Report execution failed', { error, reportId, userId });
      throw error;
    }
  }

  /**
   * Run report query based on configuration
   */
  private async runReportQuery(config: any): Promise<any[]> {
    try {
      const { entity, columns, filters, aggregations, groupBy, orderBy, limit } = config;

      // Build SQL query dynamically
      let sql = 'SELECT ';
      const params: any[] = [];
      let paramIndex = 1;

      // Columns
      if (columns && columns.length > 0) {
        sql += columns.join(', ');
      } else {
        sql += '*';
      }

      // Aggregations
      if (aggregations && aggregations.length > 0) {
        if (columns && columns.length > 0) {
          sql += ', ';
        }
        sql += aggregations
          .map((agg: any) => `${agg.function}(${agg.field}) as ${agg.alias}`)
          .join(', ');
      }

      // From clause
      sql += ` FROM ${entity}`;

      // Where clause (filters)
      if (filters && filters.length > 0) {
        const whereClauses = filters.map((filter: any) => {
          const value = filter.value;
          params.push(value);

          switch (filter.operator) {
            case 'in':
              return `${filter.field} = ANY($${paramIndex++}::text[])`;
            case 'between':
              params.push(filter.value2);
              return `${filter.field} BETWEEN $${paramIndex++} AND $${paramIndex++}`;
            default:
              return `${filter.field} ${filter.operator} $${paramIndex++}`;
          }
        });

        sql += ' WHERE ' + whereClauses.join(' AND ');
      }

      // Group by
      if (groupBy && groupBy.length > 0) {
        sql += ` GROUP BY ${groupBy.join(', ')}`;
      }

      // Order by
      if (orderBy && orderBy.length > 0) {
        const orderClauses = orderBy.map(
          (order: any) => `${order.field} ${order.direction || 'ASC'}`
        );
        sql += ` ORDER BY ${orderClauses.join(', ')}`;
      }

      // Limit
      if (limit) {
        sql += ` LIMIT ${parseInt(limit)}`;
      } else {
        sql += ' LIMIT 1000'; // Default limit
      }

      const result = await query(sql, params);
      return result.rows;
    } catch (error) {
      logger.error('Report query execution failed', { error, config });
      throw new AppError(500, 'QUERY_ERROR', 'Failed to execute report query');
    }
  }

  /**
   * Get report execution history
   */
  async getExecutionHistory(
    reportId: string,
    userId: string,
    limit: number = 20
  ): Promise<ReportExecution[]> {
    try {
      const result = await query(
        `SELECT * FROM report_executions
         WHERE report_id = $1 AND user_id = $2
         ORDER BY created_at DESC
         LIMIT $3`,
        [reportId, userId, limit]
      );

      return result.rows.map((row) => ({
        ...row,
        result_data: row.result_data,
      }));
    } catch (error) {
      logger.error('Failed to get execution history', { error, reportId, userId });
      throw error;
    }
  }

  /**
   * Get execution by ID
   */
  async getExecution(executionId: string, userId: string): Promise<ReportExecution> {
    try {
      const result = await query(
        'SELECT * FROM report_executions WHERE id = $1 AND user_id = $2',
        [executionId, userId]
      );

      if (result.rows.length === 0) {
        throw new AppError(404, 'NOT_FOUND', 'Execution not found');
      }

      return {
        ...result.rows[0],
        result_data: result.rows[0].result_data,
      };
    } catch (error) {
      logger.error('Failed to get execution', { error, executionId, userId });
      throw error;
    }
  }
}

export const reportingService = new ReportingService();
