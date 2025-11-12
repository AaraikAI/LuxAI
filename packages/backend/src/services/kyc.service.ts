import axios, { AxiosInstance } from 'axios';
import { config } from '../config';
import { query } from '../db';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';

export enum KYCProvider {
  PERSONA = 'persona',
  ONFIDO = 'onfido'
}

export enum KYCStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  VERIFIED = 'verified',
  REJECTED = 'rejected',
  EXPIRED = 'expired'
}

export interface KYCVerificationRequest {
  userId: string;
  provider?: KYCProvider;
  metadata?: Record<string, any>;
}

export interface KYCDocument {
  type: 'passport' | 'id' | 'proof_of_address' | 'net_worth_affidavit';
  frontImageUrl?: string;
  backImageUrl?: string;
  metadata?: Record<string, any>;
}

export interface KYCCheckResult {
  userId: string;
  status: KYCStatus;
  verificationId: string;
  provider: KYCProvider;
  checks: {
    identity: boolean;
    documentAuthenticity: boolean;
    facialRecognition: boolean;
    pepScreening: boolean;
    sanctionsScreening: boolean;
    addressVerification: boolean;
  };
  riskScore?: number;
  completedAt?: Date;
  expiresAt?: Date;
}

/**
 * KYC Service for identity verification
 * Supports Persona (primary) and Onfido (fallback)
 */
export class KYCService {
  private personaClient: AxiosInstance | null = null;
  private onfidoClient: AxiosInstance | null = null;

  constructor() {
    // Initialize Persona client
    if (config.kyc.personaApiKey) {
      this.personaClient = axios.create({
        baseURL: 'https://withpersona.com/api/v1',
        headers: {
          'Authorization': `Bearer ${config.kyc.personaApiKey}`,
          'Content-Type': 'application/json',
          'Persona-Version': '2023-01-05',
        },
      });
    }

    // Initialize Onfido client
    if (config.kyc.onfidoApiKey) {
      this.onfidoClient = axios.create({
        baseURL: 'https://api.onfido.com/v3',
        headers: {
          'Authorization': `Token token=${config.kyc.onfidoApiKey}`,
          'Content-Type': 'application/json',
        },
      });
    }
  }

  /**
   * Initiate KYC verification for a user
   */
  async initiateVerification(request: KYCVerificationRequest): Promise<{
    verificationId: string;
    verificationUrl: string;
    status: KYCStatus;
  }> {
    const provider = request.provider || KYCProvider.PERSONA;

    try {
      // Get user info
      const userResult = await query(
        'SELECT id, email, first_name, last_name FROM users WHERE id = $1',
        [request.userId]
      );

      if (userResult.rows.length === 0) {
        throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
      }

      const user = userResult.rows[0];

      // Update user KYC status to in_progress
      await query(
        'UPDATE users SET kyc_status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        ['in_progress', request.userId]
      );

      if (provider === KYCProvider.PERSONA && this.personaClient) {
        return await this.initiatePersonaVerification(user, request.metadata);
      } else if (provider === KYCProvider.ONFIDO && this.onfidoClient) {
        return await this.initiateOnfidoVerification(user, request.metadata);
      } else {
        throw new AppError(500, 'KYC_NOT_CONFIGURED', 'KYC provider not configured');
      }
    } catch (error: any) {
      logger.error('Failed to initiate KYC verification', { error, userId: request.userId });
      throw error;
    }
  }

  /**
   * Check KYC verification status
   */
  async checkVerificationStatus(
    userId: string,
    verificationId: string,
    provider: KYCProvider
  ): Promise<KYCCheckResult> {
    try {
      if (provider === KYCProvider.PERSONA && this.personaClient) {
        return await this.checkPersonaStatus(userId, verificationId);
      } else if (provider === KYCProvider.ONFIDO && this.onfidoClient) {
        return await this.checkOnfidoStatus(userId, verificationId);
      } else {
        throw new AppError(500, 'KYC_NOT_CONFIGURED', 'KYC provider not configured');
      }
    } catch (error: any) {
      logger.error('Failed to check KYC status', { error, userId, verificationId });
      throw error;
    }
  }

  /**
   * Upload document for KYC verification
   */
  async uploadDocument(
    userId: string,
    document: KYCDocument,
    verificationId?: string
  ): Promise<{ documentId: string }> {
    try {
      // Store document reference in database
      const result = await query(
        `INSERT INTO documents (
          user_id, type, name, url, mime_type, size, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id`,
        [
          userId,
          document.type,
          `${document.type}_${Date.now()}`,
          document.frontImageUrl || '',
          'image/jpeg',
          0,
          'pending_review'
        ]
      );

      return { documentId: result.rows[0].id };
    } catch (error: any) {
      logger.error('Failed to upload KYC document', { error, userId });
      throw error;
    }
  }

  /**
   * Update user KYC status in database
   */
  async updateUserKYCStatus(
    userId: string,
    status: KYCStatus,
    verificationId?: string
  ): Promise<void> {
    try {
      const now = new Date();
      await query(
        `UPDATE users
         SET kyc_status = $1,
             kyc_verified_at = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [status, status === 'verified' ? now : null, userId]
      );

      logger.info('Updated user KYC status', { userId, status });
    } catch (error: any) {
      logger.error('Failed to update KYC status', { error, userId, status });
      throw error;
    }
  }

  /**
   * Perform PEP and sanctions screening
   */
  async performPEPScreening(userId: string, fullName: string): Promise<{
    isPEP: boolean;
    isSanctioned: boolean;
    matches: any[];
  }> {
    try {
      // In production, integrate with OFAC/PEP databases
      // For now, return mock data
      logger.info('Performing PEP/sanctions screening', { userId, fullName });

      return {
        isPEP: false,
        isSanctioned: false,
        matches: []
      };
    } catch (error: any) {
      logger.error('PEP screening failed', { error, userId });
      throw error;
    }
  }

  // ==========================================
  // PERSONA INTEGRATION
  // ==========================================

  private async initiatePersonaVerification(
    user: any,
    metadata?: Record<string, any>
  ): Promise<{
    verificationId: string;
    verificationUrl: string;
    status: KYCStatus;
  }> {
    if (!this.personaClient) {
      throw new AppError(500, 'PERSONA_NOT_CONFIGURED', 'Persona not configured');
    }

    try {
      // Create inquiry
      const response = await this.personaClient.post('/inquiries', {
        data: {
          type: 'inquiry',
          attributes: {
            'inquiry-template-id': config.kyc.personaTemplateId || 'itmpl_default',
            'reference-id': user.id,
            'name-first': user.first_name,
            'name-last': user.last_name,
            'email-address': user.email,
            ...metadata
          }
        }
      });

      const inquiry = response.data.data;
      const verificationId = inquiry.id;
      const verificationUrl = inquiry.attributes['inquiry-url'];

      logger.info('Persona verification initiated', { userId: user.id, verificationId });

      return {
        verificationId,
        verificationUrl,
        status: KYCStatus.IN_PROGRESS
      };
    } catch (error: any) {
      logger.error('Persona verification initiation failed', { error, userId: user.id });
      throw new AppError(
        500,
        'PERSONA_ERROR',
        error.response?.data?.errors?.[0]?.title || 'Failed to initiate Persona verification'
      );
    }
  }

  private async checkPersonaStatus(
    userId: string,
    verificationId: string
  ): Promise<KYCCheckResult> {
    if (!this.personaClient) {
      throw new AppError(500, 'PERSONA_NOT_CONFIGURED', 'Persona not configured');
    }

    try {
      const response = await this.personaClient.get(`/inquiries/${verificationId}`);
      const inquiry = response.data.data;
      const status = inquiry.attributes.status;

      // Map Persona status to our KYC status
      let kycStatus: KYCStatus;
      if (status === 'completed' && inquiry.attributes['decision-status'] === 'approved') {
        kycStatus = KYCStatus.VERIFIED;
      } else if (status === 'completed' && inquiry.attributes['decision-status'] === 'declined') {
        kycStatus = KYCStatus.REJECTED;
      } else if (status === 'expired') {
        kycStatus = KYCStatus.EXPIRED;
      } else {
        kycStatus = KYCStatus.IN_PROGRESS;
      }

      // Update user status if verified or rejected
      if (kycStatus === KYCStatus.VERIFIED || kycStatus === KYCStatus.REJECTED) {
        await this.updateUserKYCStatus(userId, kycStatus, verificationId);
      }

      return {
        userId,
        status: kycStatus,
        verificationId,
        provider: KYCProvider.PERSONA,
        checks: {
          identity: true,
          documentAuthenticity: true,
          facialRecognition: true,
          pepScreening: true,
          sanctionsScreening: true,
          addressVerification: true,
        },
        completedAt: status === 'completed' ? new Date() : undefined,
        expiresAt: inquiry.attributes['expires-at'] ? new Date(inquiry.attributes['expires-at']) : undefined,
      };
    } catch (error: any) {
      logger.error('Persona status check failed', { error, verificationId });
      throw new AppError(
        500,
        'PERSONA_ERROR',
        'Failed to check Persona verification status'
      );
    }
  }

  // ==========================================
  // ONFIDO INTEGRATION
  // ==========================================

  private async initiateOnfidoVerification(
    user: any,
    metadata?: Record<string, any>
  ): Promise<{
    verificationId: string;
    verificationUrl: string;
    status: KYCStatus;
  }> {
    if (!this.onfidoClient) {
      throw new AppError(500, 'ONFIDO_NOT_CONFIGURED', 'Onfido not configured');
    }

    try {
      // Create applicant
      const applicantResponse = await this.onfidoClient.post('/applicants', {
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
      });

      const applicantId = applicantResponse.data.id;

      // Create SDK token
      const tokenResponse = await this.onfidoClient.post('/sdk_token', {
        applicant_id: applicantId,
        referrer: '*://*/*'
      });

      const sdkToken = tokenResponse.data.token;

      logger.info('Onfido verification initiated', { userId: user.id, applicantId });

      return {
        verificationId: applicantId,
        verificationUrl: `https://id.onfido.com?token=${sdkToken}`,
        status: KYCStatus.IN_PROGRESS
      };
    } catch (error: any) {
      logger.error('Onfido verification initiation failed', { error, userId: user.id });
      throw new AppError(
        500,
        'ONFIDO_ERROR',
        'Failed to initiate Onfido verification'
      );
    }
  }

  private async checkOnfidoStatus(
    userId: string,
    applicantId: string
  ): Promise<KYCCheckResult> {
    if (!this.onfidoClient) {
      throw new AppError(500, 'ONFIDO_NOT_CONFIGURED', 'Onfido not configured');
    }

    try {
      // Get checks for applicant
      const checksResponse = await this.onfidoClient.get(`/checks`, {
        params: { applicant_id: applicantId }
      });

      const checks = checksResponse.data.checks;
      if (checks.length === 0) {
        return {
          userId,
          status: KYCStatus.IN_PROGRESS,
          verificationId: applicantId,
          provider: KYCProvider.ONFIDO,
          checks: {
            identity: false,
            documentAuthenticity: false,
            facialRecognition: false,
            pepScreening: false,
            sanctionsScreening: false,
            addressVerification: false,
          }
        };
      }

      const latestCheck = checks[0];
      const result = latestCheck.result;

      let kycStatus: KYCStatus;
      if (result === 'clear') {
        kycStatus = KYCStatus.VERIFIED;
      } else if (result === 'consider') {
        kycStatus = KYCStatus.IN_PROGRESS;
      } else {
        kycStatus = KYCStatus.REJECTED;
      }

      // Update user status if verified or rejected
      if (kycStatus === KYCStatus.VERIFIED || kycStatus === KYCStatus.REJECTED) {
        await this.updateUserKYCStatus(userId, kycStatus, applicantId);
      }

      return {
        userId,
        status: kycStatus,
        verificationId: applicantId,
        provider: KYCProvider.ONFIDO,
        checks: {
          identity: true,
          documentAuthenticity: true,
          facialRecognition: true,
          pepScreening: false,
          sanctionsScreening: false,
          addressVerification: false,
        },
        completedAt: latestCheck.completed_at_iso8601 ? new Date(latestCheck.completed_at_iso8601) : undefined,
      };
    } catch (error: any) {
      logger.error('Onfido status check failed', { error, applicantId });
      throw new AppError(
        500,
        'ONFIDO_ERROR',
        'Failed to check Onfido verification status'
      );
    }
  }
}

export const kycService = new KYCService();
