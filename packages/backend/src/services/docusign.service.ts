import axios, { AxiosInstance } from 'axios';
import { config } from '../config';
import { query } from '../db';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';

export interface DocuSignEnvelope {
  envelopeId: string;
  status: 'created' | 'sent' | 'delivered' | 'signed' | 'completed' | 'declined' | 'voided';
  documentsUrl: string;
  signingUrl?: string;
}

export interface CreateEnvelopeRequest {
  documentId: string;
  signers: Signer[];
  emailSubject: string;
  emailBody: string;
  templateId?: string;
}

export interface Signer {
  name: string;
  email: string;
  recipientId: string;
  routingOrder: number;
  tabs?: DocumentTabs;
}

export interface DocumentTabs {
  signHereTabs?: SignHereTab[];
  dateSignedTabs?: DateSignedTab[];
  textTabs?: TextTab[];
}

export interface SignHereTab {
  documentId: string;
  pageNumber: number;
  xPosition: number;
  yPosition: number;
}

export interface DateSignedTab {
  documentId: string;
  pageNumber: number;
  xPosition: number;
  yPosition: number;
}

export interface TextTab {
  documentId: string;
  pageNumber: number;
  xPosition: number;
  yPosition: number;
  width: number;
  height: number;
  required: boolean;
  tabLabel: string;
}

/**
 * DocuSign E-Signature Service
 * Handles document signing workflows
 */
export class DocuSignService {
  private client: AxiosInstance | null = null;
  private accessToken: string | null = null;
  private accountId: string | null = null;

  constructor() {
    if (config.docusign?.apiKey) {
      this.client = axios.create({
        baseURL: config.docusign.baseUrl || 'https://demo.docusign.net/restapi',
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }
  }

  /**
   * Initialize DocuSign with OAuth token
   */
  async initialize(): Promise<void> {
    if (!this.client || !config.docusign?.apiKey) {
      logger.warn('DocuSign not configured');
      return;
    }

    try {
      // In production, implement OAuth 2.0 JWT flow
      // This is a simplified version
      this.accessToken = config.docusign.apiKey;
      this.accountId = config.docusign.accountId;

      logger.info('DocuSign initialized');
    } catch (error: any) {
      logger.error('Failed to initialize DocuSign', { error });
      throw new AppError(500, 'DOCUSIGN_INIT_FAILED', 'Failed to initialize DocuSign');
    }
  }

  /**
   * Create envelope for signing
   */
  async createEnvelope(request: CreateEnvelopeRequest): Promise<DocuSignEnvelope> {
    if (!this.client || !this.accessToken) {
      throw new AppError(500, 'DOCUSIGN_NOT_CONFIGURED', 'DocuSign not configured');
    }

    try {
      // Get document details
      const documentResult = await query(
        'SELECT * FROM documents WHERE id = $1',
        [request.documentId]
      );

      if (documentResult.rows.length === 0) {
        throw new AppError(404, 'DOCUMENT_NOT_FOUND', 'Document not found');
      }

      const document = documentResult.rows[0];

      // Create envelope
      const envelopeDefinition = {
        emailSubject: request.emailSubject,
        emailBody: request.emailBody,
        documents: [
          {
            documentId: '1',
            name: document.name,
            documentBase64: await this.getDocumentBase64(document.url),
          },
        ],
        recipients: {
          signers: request.signers.map((signer) => ({
            email: signer.email,
            name: signer.name,
            recipientId: signer.recipientId,
            routingOrder: signer.routingOrder,
            tabs: signer.tabs || {},
          })),
        },
        status: 'sent', // Send immediately
      };

      const response = await this.client.post(
        `/v2.1/accounts/${this.accountId}/envelopes`,
        envelopeDefinition,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        }
      );

      const envelopeId = response.data.envelopeId;
      const status = response.data.status;

      // Get signing URL for first signer
      const signingUrl = await this.getSigningUrl(envelopeId, request.signers[0]);

      // Store envelope info in database
      await query(
        `UPDATE documents
         SET metadata = jsonb_set(
           COALESCE(metadata, '{}'::jsonb),
           '{docusign}',
           $1::jsonb
         )
         WHERE id = $2`,
        [
          JSON.stringify({
            envelopeId,
            status,
            createdAt: new Date().toISOString(),
          }),
          request.documentId,
        ]
      );

      logger.info('DocuSign envelope created', { envelopeId, documentId: request.documentId });

      return {
        envelopeId,
        status: 'sent',
        documentsUrl: response.data.uri,
        signingUrl,
      };
    } catch (error: any) {
      logger.error('Failed to create DocuSign envelope', { error, request });
      throw new AppError(500, 'ENVELOPE_CREATE_FAILED', 'Failed to create signing envelope');
    }
  }

  /**
   * Get signing URL for recipient
   */
  async getSigningUrl(envelopeId: string, signer: Signer): Promise<string> {
    if (!this.client || !this.accessToken) {
      throw new AppError(500, 'DOCUSIGN_NOT_CONFIGURED', 'DocuSign not configured');
    }

    try {
      const response = await this.client.post(
        `/v2.1/accounts/${this.accountId}/envelopes/${envelopeId}/views/recipient`,
        {
          returnUrl: `${config.web.url}/documents/signed`,
          authenticationMethod: 'email',
          email: signer.email,
          userName: signer.name,
          clientUserId: signer.recipientId,
        },
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        }
      );

      return response.data.url;
    } catch (error: any) {
      logger.error('Failed to get signing URL', { error, envelopeId });
      throw new AppError(500, 'SIGNING_URL_FAILED', 'Failed to get signing URL');
    }
  }

  /**
   * Get envelope status
   */
  async getEnvelopeStatus(envelopeId: string): Promise<{
    status: string;
    completedDateTime?: string;
    signers: Array<{ name: string; status: string; signedDateTime?: string }>;
  }> {
    if (!this.client || !this.accessToken) {
      throw new AppError(500, 'DOCUSIGN_NOT_CONFIGURED', 'DocuSign not configured');
    }

    try {
      const response = await this.client.get(
        `/v2.1/accounts/${this.accountId}/envelopes/${envelopeId}`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        }
      );

      // Get recipient status
      const recipientsResponse = await this.client.get(
        `/v2.1/accounts/${this.accountId}/envelopes/${envelopeId}/recipients`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        }
      );

      const signers = recipientsResponse.data.signers.map((signer: any) => ({
        name: signer.name,
        status: signer.status,
        signedDateTime: signer.signedDateTime,
      }));

      return {
        status: response.data.status,
        completedDateTime: response.data.completedDateTime,
        signers,
      };
    } catch (error: any) {
      logger.error('Failed to get envelope status', { error, envelopeId });
      throw new AppError(500, 'ENVELOPE_STATUS_FAILED', 'Failed to get envelope status');
    }
  }

  /**
   * Download signed document
   */
  async downloadSignedDocument(envelopeId: string): Promise<Buffer> {
    if (!this.client || !this.accessToken) {
      throw new AppError(500, 'DOCUSIGN_NOT_CONFIGURED', 'DocuSign not configured');
    }

    try {
      const response = await this.client.get(
        `/v2.1/accounts/${this.accountId}/envelopes/${envelopeId}/documents/combined`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
          responseType: 'arraybuffer',
        }
      );

      return Buffer.from(response.data);
    } catch (error: any) {
      logger.error('Failed to download signed document', { error, envelopeId });
      throw new AppError(
        500,
        'DOCUMENT_DOWNLOAD_FAILED',
        'Failed to download signed document'
      );
    }
  }

  /**
   * Void envelope
   */
  async voidEnvelope(envelopeId: string, reason: string): Promise<void> {
    if (!this.client || !this.accessToken) {
      throw new AppError(500, 'DOCUSIGN_NOT_CONFIGURED', 'DocuSign not configured');
    }

    try {
      await this.client.put(
        `/v2.1/accounts/${this.accountId}/envelopes/${envelopeId}`,
        {
          status: 'voided',
          voidedReason: reason,
        },
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        }
      );

      logger.info('Envelope voided', { envelopeId, reason });
    } catch (error: any) {
      logger.error('Failed to void envelope', { error, envelopeId });
      throw new AppError(500, 'ENVELOPE_VOID_FAILED', 'Failed to void envelope');
    }
  }

  /**
   * Handle DocuSign webhook
   */
  async handleWebhook(payload: any): Promise<void> {
    try {
      const envelopeId = payload.data.envelopeId;
      const status = payload.data.envelopeSummary.status;

      logger.info('DocuSign webhook received', { envelopeId, status });

      // Update document status in database
      await query(
        `UPDATE documents
         SET status = $1,
             metadata = jsonb_set(
               COALESCE(metadata, '{}'::jsonb),
               '{docusign,status}',
               $2::jsonb
             ),
             signed_at = CASE WHEN $1 = 'completed' THEN CURRENT_TIMESTAMP ELSE signed_at END,
             updated_at = CURRENT_TIMESTAMP
         WHERE metadata->'docusign'->>'envelopeId' = $3`,
        [
          status === 'completed' ? 'approved' : 'pending_review',
          JSON.stringify(status),
          envelopeId,
        ]
      );

      // Send notification to users if completed
      if (status === 'completed') {
        logger.info('Document signing completed', { envelopeId });
        // TODO: Send email notification
      }
    } catch (error: any) {
      logger.error('Failed to handle DocuSign webhook', { error, payload });
    }
  }

  /**
   * Get document as base64
   */
  private async getDocumentBase64(url: string): Promise<string> {
    // In production, fetch document from S3 or storage
    // For now, return empty base64
    return Buffer.from('').toString('base64');
  }

  /**
   * Create contract from template
   */
  async createContractFromTemplate(
    templateId: string,
    signers: Signer[],
    templateData: Record<string, string>
  ): Promise<DocuSignEnvelope> {
    if (!this.client || !this.accessToken) {
      throw new AppError(500, 'DOCUSIGN_NOT_CONFIGURED', 'DocuSign not configured');
    }

    try {
      const envelopeDefinition = {
        templateId,
        templateRoles: signers.map((signer) => ({
          email: signer.email,
          name: signer.name,
          roleName: `Signer${signer.recipientId}`,
          tabs: {
            textTabs: Object.entries(templateData).map(([key, value]) => ({
              tabLabel: key,
              value,
            })),
          },
        })),
        status: 'sent',
      };

      const response = await this.client.post(
        `/v2.1/accounts/${this.accountId}/envelopes`,
        envelopeDefinition,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        }
      );

      logger.info('Contract created from template', {
        envelopeId: response.data.envelopeId,
        templateId,
      });

      return {
        envelopeId: response.data.envelopeId,
        status: 'sent',
        documentsUrl: response.data.uri,
      };
    } catch (error: any) {
      logger.error('Failed to create contract from template', { error, templateId });
      throw new AppError(
        500,
        'TEMPLATE_CONTRACT_FAILED',
        'Failed to create contract from template'
      );
    }
  }
}

export const docuSignService = new DocuSignService();
