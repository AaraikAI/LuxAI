import { query, withTransaction } from '../db';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';
import { PoolClient } from 'pg';

export enum ApprovalStatus {
  PENDING = 'pending',
  APPROVED_BY_ASSISTANT = 'approved_by_assistant',
  APPROVED_BY_FAMILY_OFFICE = 'approved_by_family_office',
  APPROVED_BY_PRINCIPAL = 'approved_by_principal',
  REJECTED = 'rejected'
}

export interface CreateApprovalRequest {
  itineraryId: string;
  lineItemId?: string;
  approverId: string;
  approverRole: string;
  budgetCap?: number;
  notes?: string;
}

export interface ApprovalWorkflow {
  itineraryId: string;
  currentStatus: ApprovalStatus;
  requiresAssistantApproval: boolean;
  requiresFamilyOfficeApproval: boolean;
  requiresPrincipalApproval: boolean;
  budgetThreshold: number;
}

export interface ApprovalDecision {
  approvalId: string;
  decision: 'approve' | 'reject';
  notes?: string;
}

/**
 * Approval Workflow Service
 * Handles multi-stakeholder approval flows for itineraries
 */
export class ApprovalService {
  /**
   * Create approval request
   */
  async createApproval(request: CreateApprovalRequest): Promise<{
    id: string;
    status: ApprovalStatus;
  }> {
    try {
      logger.info('Creating approval request', request);

      const result = await query(
        `INSERT INTO approvals (
          itinerary_id, line_item_id, approver_id, approver_role, status, budget_cap, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, status`,
        [
          request.itineraryId,
          request.lineItemId || null,
          request.approverId,
          request.approverRole,
          ApprovalStatus.PENDING,
          request.budgetCap || null,
          request.notes || null,
        ]
      );

      const approval = result.rows[0];

      logger.info('Approval request created', {
        approvalId: approval.id,
        itineraryId: request.itineraryId,
      });

      return {
        id: approval.id,
        status: approval.status,
      };
    } catch (error: any) {
      logger.error('Failed to create approval', { error, request });
      throw new AppError(500, 'APPROVAL_CREATE_FAILED', 'Failed to create approval request');
    }
  }

  /**
   * Process approval decision
   */
  async processApprovalDecision(decision: ApprovalDecision): Promise<{
    approved: boolean;
    nextApprover?: string;
    completed: boolean;
  }> {
    try {
      return await withTransaction(async (client: PoolClient) => {
        // Get approval details
        const approvalResult = await client.query(
          `SELECT a.*, i.total_budget, i.approval_status as itinerary_approval_status
           FROM approvals a
           JOIN itineraries i ON i.id = a.itinerary_id
           WHERE a.id = $1`,
          [decision.approvalId]
        );

        if (approvalResult.rows.length === 0) {
          throw new AppError(404, 'APPROVAL_NOT_FOUND', 'Approval not found');
        }

        const approval = approvalResult.rows[0];

        if (approval.status !== ApprovalStatus.PENDING) {
          throw new AppError(400, 'APPROVAL_ALREADY_PROCESSED', 'Approval already processed');
        }

        let newStatus: ApprovalStatus;
        let itineraryStatus: string;

        if (decision.decision === 'reject') {
          newStatus = ApprovalStatus.REJECTED;
          itineraryStatus = 'rejected';

          // Update approval
          await client.query(
            `UPDATE approvals
             SET status = $1, notes = $2, resolved_at = CURRENT_TIMESTAMP
             WHERE id = $3`,
            [newStatus, decision.notes, decision.approvalId]
          );

          // Update itinerary
          await client.query(
            `UPDATE itineraries
             SET approval_status = $1, status = 'cancelled', updated_at = CURRENT_TIMESTAMP
             WHERE id = $2`,
            [itineraryStatus, approval.itinerary_id]
          );

          logger.info('Approval rejected', {
            approvalId: decision.approvalId,
            itineraryId: approval.itinerary_id,
          });

          return {
            approved: false,
            completed: true,
          };
        }

        // Determine next status based on current approver role
        const approverRole = approval.approver_role;

        if (approverRole === 'assistant') {
          newStatus = ApprovalStatus.APPROVED_BY_ASSISTANT;
          itineraryStatus = 'approved_by_assistant';
        } else if (approverRole === 'family_office' || approverRole === 'agency_manager') {
          newStatus = ApprovalStatus.APPROVED_BY_FAMILY_OFFICE;
          itineraryStatus = 'approved_by_family_office';
        } else if (approverRole === 'client') {
          newStatus = ApprovalStatus.APPROVED_BY_PRINCIPAL;
          itineraryStatus = 'approved_by_principal';
        } else {
          throw new AppError(400, 'INVALID_APPROVER_ROLE', 'Invalid approver role');
        }

        // Update approval
        await client.query(
          `UPDATE approvals
           SET status = $1, notes = $2, resolved_at = CURRENT_TIMESTAMP
           WHERE id = $3`,
          [newStatus, decision.notes, decision.approvalId]
        );

        // Update itinerary
        await client.query(
          `UPDATE itineraries
           SET approval_status = $1, updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [itineraryStatus, approval.itinerary_id]
        );

        // Check if workflow is complete
        const workflowComplete = newStatus === ApprovalStatus.APPROVED_BY_PRINCIPAL;

        if (workflowComplete) {
          await client.query(
            `UPDATE itineraries
             SET status = 'approved', updated_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [approval.itinerary_id]
          );
        }

        logger.info('Approval processed', {
          approvalId: decision.approvalId,
          newStatus,
          workflowComplete,
        });

        // Determine next approver
        let nextApprover: string | undefined;
        if (!workflowComplete) {
          if (newStatus === ApprovalStatus.APPROVED_BY_ASSISTANT) {
            nextApprover = 'family_office';
          } else if (newStatus === ApprovalStatus.APPROVED_BY_FAMILY_OFFICE) {
            nextApprover = 'principal';
          }
        }

        return {
          approved: true,
          nextApprover,
          completed: workflowComplete,
        };
      });
    } catch (error: any) {
      logger.error('Failed to process approval decision', { error, decision });
      throw error;
    }
  }

  /**
   * Get pending approvals for a user
   */
  async getPendingApprovals(userId: string, role: string): Promise<any[]> {
    try {
      const result = await query(
        `SELECT
           a.id,
           a.itinerary_id,
           a.line_item_id,
           a.status,
           a.budget_cap,
           a.notes,
           a.created_at,
           i.title as itinerary_title,
           i.total_budget,
           i.start_date,
           i.end_date,
           u.first_name as client_first_name,
           u.last_name as client_last_name
         FROM approvals a
         JOIN itineraries i ON i.id = a.itinerary_id
         JOIN users u ON u.id = i.client_id
         WHERE a.approver_id = $1
           AND a.status = $2
         ORDER BY a.created_at DESC`,
        [userId, ApprovalStatus.PENDING]
      );

      return result.rows;
    } catch (error: any) {
      logger.error('Failed to get pending approvals', { error, userId });
      throw new AppError(500, 'APPROVALS_FETCH_FAILED', 'Failed to fetch pending approvals');
    }
  }

  /**
   * Get approval history for an itinerary
   */
  async getApprovalHistory(itineraryId: string): Promise<any[]> {
    try {
      const result = await query(
        `SELECT
           a.id,
           a.approver_id,
           a.approver_role,
           a.status,
           a.notes,
           a.created_at,
           a.resolved_at,
           u.first_name as approver_first_name,
           u.last_name as approver_last_name
         FROM approvals a
         JOIN users u ON u.id = a.approver_id
         WHERE a.itinerary_id = $1
         ORDER BY a.created_at ASC`,
        [itineraryId]
      );

      return result.rows;
    } catch (error: any) {
      logger.error('Failed to get approval history', { error, itineraryId });
      throw new AppError(500, 'APPROVAL_HISTORY_FAILED', 'Failed to fetch approval history');
    }
  }

  /**
   * Check if budget exceeds cap
   */
  async checkBudgetExceeded(itineraryId: string, budgetCap?: number): Promise<{
    exceeded: boolean;
    currentBudget: number;
    budgetCap?: number;
    percentageOver?: number;
  }> {
    try {
      const result = await query(
        'SELECT total_budget FROM itineraries WHERE id = $1',
        [itineraryId]
      );

      if (result.rows.length === 0) {
        throw new AppError(404, 'ITINERARY_NOT_FOUND', 'Itinerary not found');
      }

      const currentBudget = result.rows[0].total_budget || 0;

      if (!budgetCap) {
        return {
          exceeded: false,
          currentBudget,
        };
      }

      const exceeded = currentBudget > budgetCap;
      const percentageOver = exceeded
        ? ((currentBudget - budgetCap) / budgetCap) * 100
        : 0;

      return {
        exceeded,
        currentBudget,
        budgetCap,
        percentageOver: Math.round(percentageOver * 100) / 100,
      };
    } catch (error: any) {
      logger.error('Failed to check budget', { error, itineraryId });
      throw error;
    }
  }

  /**
   * Initiate approval workflow for an itinerary
   */
  async initiateApprovalWorkflow(
    itineraryId: string,
    workflow: ApprovalWorkflow
  ): Promise<{ approvalIds: string[] }> {
    try {
      const approvalIds: string[] = [];

      // Create approval for assistant if required
      if (workflow.requiresAssistantApproval) {
        // Find assistant for this itinerary
        const assistantResult = await query(
          `SELECT designer_id FROM itineraries WHERE id = $1`,
          [itineraryId]
        );

        if (assistantResult.rows[0]?.designer_id) {
          const approval = await this.createApproval({
            itineraryId,
            approverId: assistantResult.rows[0].designer_id,
            approverRole: 'assistant',
            budgetCap: workflow.budgetThreshold,
          });
          approvalIds.push(approval.id);
        }
      }

      logger.info('Approval workflow initiated', { itineraryId, approvalIds });

      return { approvalIds };
    } catch (error: any) {
      logger.error('Failed to initiate approval workflow', { error, itineraryId });
      throw new AppError(500, 'WORKFLOW_INIT_FAILED', 'Failed to initiate approval workflow');
    }
  }
}

export const approvalService = new ApprovalService();
