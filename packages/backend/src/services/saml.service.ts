import { Strategy as SamlStrategy, Profile, VerifiedCallback } from '@node-saml/passport-saml';
import { query } from '../db';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import crypto from 'crypto';

export interface SAMLProvider {
  id: string;
  name: string;
  entity_id: string;
  sso_url: string;
  sso_logout_url?: string;
  certificate: string;
  is_active: boolean;
  auto_provision: boolean;
  default_role: string;
  attribute_mapping: {
    email: string;
    firstName: string;
    lastName: string;
    displayName?: string;
  };
}

export interface SAMLUser {
  nameID: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName?: string;
  attributes?: Record<string, any>;
}

export class SAMLService {
  /**
   * Get SAML provider by ID
   */
  async getProvider(providerId: string): Promise<SAMLProvider | null> {
    try {
      const result = await query(
        `SELECT id, name, entity_id, sso_url, sso_logout_url, certificate,
                is_active, auto_provision, default_role, attribute_mapping
         FROM saml_providers
         WHERE id = $1 AND is_active = true`,
        [providerId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0];
    } catch (error) {
      logger.error('Failed to get SAML provider', { error, providerId });
      throw error;
    }
  }

  /**
   * Get SAML provider by entity ID
   */
  async getProviderByEntityId(entityId: string): Promise<SAMLProvider | null> {
    try {
      const result = await query(
        `SELECT id, name, entity_id, sso_url, sso_logout_url, certificate,
                is_active, auto_provision, default_role, attribute_mapping
         FROM saml_providers
         WHERE entity_id = $1 AND is_active = true`,
        [entityId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0];
    } catch (error) {
      logger.error('Failed to get SAML provider by entity ID', { error, entityId });
      throw error;
    }
  }

  /**
   * Get all active SAML providers
   */
  async getActiveProviders(): Promise<SAMLProvider[]> {
    try {
      const result = await query(
        `SELECT id, name, entity_id, sso_url, sso_logout_url, certificate,
                is_active, auto_provision, default_role, attribute_mapping
         FROM saml_providers
         WHERE is_active = true
         ORDER BY name ASC`
      );

      return result.rows;
    } catch (error) {
      logger.error('Failed to get active SAML providers', { error });
      throw error;
    }
  }

  /**
   * Create SAML strategy for passport
   */
  createStrategy(provider: SAMLProvider, callbackUrl: string): SamlStrategy {
    return new SamlStrategy(
      {
        callbackUrl: callbackUrl,
        entryPoint: provider.sso_url,
        issuer: provider.entity_id,
        cert: provider.certificate,
        // signatureAlgorithm: 'sha256',
        identifierFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
      },
      async (profile: Profile, done: VerifiedCallback) => {
        try {
          const samlUser = this.extractUserFromProfile(profile, provider);
          done(null, samlUser);
        } catch (error) {
          logger.error('Failed to process SAML profile', { error, profile });
          done(error as Error);
        }
      }
    );
  }

  /**
   * Extract user information from SAML profile
   */
  private extractUserFromProfile(profile: Profile, provider: SAMLProvider): SAMLUser {
    const mapping = provider.attribute_mapping;

    const email = this.getAttributeValue(profile, mapping.email) || profile.email;
    const firstName = this.getAttributeValue(profile, mapping.firstName);
    const lastName = this.getAttributeValue(profile, mapping.lastName);
    const displayName =
      mapping.displayName ? this.getAttributeValue(profile, mapping.displayName) : undefined;

    if (!email) {
      throw new AppError(400, 'INVALID_SAML_RESPONSE', 'Email not found in SAML response');
    }

    return {
      nameID: profile.nameID || email,
      email,
      firstName: firstName || '',
      lastName: lastName || '',
      displayName,
      attributes: profile as any,
    };
  }

  /**
   * Get attribute value from SAML profile
   */
  private getAttributeValue(profile: any, attributeName: string): string | undefined {
    if (!attributeName) return undefined;

    // Check direct property
    if (profile[attributeName]) {
      return Array.isArray(profile[attributeName])
        ? profile[attributeName][0]
        : profile[attributeName];
    }

    // Check in attributes object
    if (profile.attributes && profile.attributes[attributeName]) {
      const value = profile.attributes[attributeName];
      return Array.isArray(value) ? value[0] : value;
    }

    return undefined;
  }

  /**
   * Find or create user from SAML profile
   */
  async findOrCreateUser(
    samlUser: SAMLUser,
    provider: SAMLProvider
  ): Promise<{ user: any; isNew: boolean }> {
    try {
      // Check if user exists with this SAML identity
      let result = await query(
        `SELECT u.*, sm.provider_id, sm.name_id
         FROM users u
         INNER JOIN saml_mappings sm ON u.id = sm.user_id
         WHERE sm.provider_id = $1 AND sm.name_id = $2`,
        [provider.id, samlUser.nameID]
      );

      if (result.rows.length > 0) {
        logger.info('Existing SAML user found', {
          userId: result.rows[0].id,
          email: samlUser.email,
          providerId: provider.id,
        });
        return { user: result.rows[0], isNew: false };
      }

      // Check if user exists by email
      result = await query('SELECT * FROM users WHERE email = $1', [samlUser.email]);

      if (result.rows.length > 0) {
        // Link existing user to SAML provider
        const user = result.rows[0];
        await this.createSAMLMapping(user.id, provider.id, samlUser.nameID, samlUser.attributes);

        logger.info('Linked existing user to SAML provider', {
          userId: user.id,
          email: samlUser.email,
          providerId: provider.id,
        });

        return { user, isNew: false };
      }

      // Auto-provision new user if enabled
      if (!provider.auto_provision) {
        throw new AppError(
          403,
          'AUTO_PROVISION_DISABLED',
          'User does not exist and auto-provisioning is disabled'
        );
      }

      // Create new user
      const newUser = await query(
        `INSERT INTO users (email, first_name, last_name, role, email_verified, created_via)
         VALUES ($1, $2, $3, $4, true, 'saml')
         RETURNING *`,
        [samlUser.email, samlUser.firstName, samlUser.lastName, provider.default_role || 'client']
      );

      const user = newUser.rows[0];

      // Create SAML mapping
      await this.createSAMLMapping(user.id, provider.id, samlUser.nameID, samlUser.attributes);

      logger.info('Auto-provisioned new SAML user', {
        userId: user.id,
        email: samlUser.email,
        providerId: provider.id,
      });

      return { user, isNew: true };
    } catch (error) {
      logger.error('Failed to find or create SAML user', { error, samlUser, provider });
      throw error;
    }
  }

  /**
   * Create SAML mapping between user and provider
   */
  private async createSAMLMapping(
    userId: string,
    providerId: string,
    nameId: string,
    attributes?: any
  ): Promise<void> {
    await query(
      `INSERT INTO saml_mappings (user_id, provider_id, name_id, attributes)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, provider_id)
       DO UPDATE SET name_id = $3, attributes = $4, updated_at = NOW()`,
      [userId, providerId, nameId, JSON.stringify(attributes || {})]
    );
  }

  /**
   * Generate SAML metadata XML
   */
  generateMetadata(config: {
    entityId: string;
    callbackUrl: string;
    logoutUrl?: string;
  }): string {
    const metadata = `<?xml version="1.0"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata"
                     xmlns:ds="http://www.w3.org/2000/09/xmldsig#"
                     entityID="${config.entityId}">
  <md:SPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <md:NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</md:NameIDFormat>
    <md:AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
                                 Location="${config.callbackUrl}"
                                 index="1" />
    ${
      config.logoutUrl
        ? `<md:SingleLogoutService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
                                 Location="${config.logoutUrl}" />`
        : ''
    }
  </md:SPSSODescriptor>
</md:EntityDescriptor>`;

    return metadata;
  }

  // ============================================
  // ADMIN METHODS
  // ============================================

  /**
   * Get all SAML providers (admin)
   */
  async getAllProviders(): Promise<SAMLProvider[]> {
    try {
      const result = await query(
        `SELECT id, name, entity_id, sso_url, sso_logout_url, certificate,
                is_active, auto_provision, default_role, attribute_mapping, created_at
         FROM saml_providers
         ORDER BY created_at DESC`
      );

      return result.rows;
    } catch (error) {
      logger.error('Failed to get all SAML providers', { error });
      throw error;
    }
  }

  /**
   * Create SAML provider (admin)
   */
  async createProvider(data: {
    name: string;
    entity_id: string;
    sso_url: string;
    sso_logout_url?: string;
    certificate: string;
    auto_provision: boolean;
    default_role: string;
    attribute_mapping: any;
  }): Promise<SAMLProvider> {
    try {
      const result = await query(
        `INSERT INTO saml_providers (name, entity_id, sso_url, sso_logout_url, certificate,
                                      auto_provision, default_role, attribute_mapping, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
         RETURNING *`,
        [
          data.name,
          data.entity_id,
          data.sso_url,
          data.sso_logout_url,
          data.certificate,
          data.auto_provision,
          data.default_role,
          JSON.stringify(data.attribute_mapping),
        ]
      );

      logger.info('SAML provider created', { providerId: result.rows[0].id, name: data.name });

      return result.rows[0];
    } catch (error) {
      logger.error('Failed to create SAML provider', { error, data });
      throw error;
    }
  }

  /**
   * Update SAML provider (admin)
   */
  async updateProvider(providerId: string, data: Partial<SAMLProvider>): Promise<void> {
    try {
      const updates: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (data.name !== undefined) {
        updates.push(`name = $${paramIndex++}`);
        params.push(data.name);
      }
      if (data.sso_url !== undefined) {
        updates.push(`sso_url = $${paramIndex++}`);
        params.push(data.sso_url);
      }
      if (data.sso_logout_url !== undefined) {
        updates.push(`sso_logout_url = $${paramIndex++}`);
        params.push(data.sso_logout_url);
      }
      if (data.certificate !== undefined) {
        updates.push(`certificate = $${paramIndex++}`);
        params.push(data.certificate);
      }
      if (data.is_active !== undefined) {
        updates.push(`is_active = $${paramIndex++}`);
        params.push(data.is_active);
      }
      if (data.auto_provision !== undefined) {
        updates.push(`auto_provision = $${paramIndex++}`);
        params.push(data.auto_provision);
      }
      if (data.default_role !== undefined) {
        updates.push(`default_role = $${paramIndex++}`);
        params.push(data.default_role);
      }
      if (data.attribute_mapping !== undefined) {
        updates.push(`attribute_mapping = $${paramIndex++}`);
        params.push(JSON.stringify(data.attribute_mapping));
      }

      if (updates.length === 0) {
        return;
      }

      params.push(providerId);

      await query(
        `UPDATE saml_providers SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${paramIndex}`,
        params
      );

      logger.info('SAML provider updated', { providerId });
    } catch (error) {
      logger.error('Failed to update SAML provider', { error, providerId, data });
      throw error;
    }
  }

  /**
   * Delete SAML provider (admin)
   */
  async deleteProvider(providerId: string): Promise<void> {
    try {
      await query('DELETE FROM saml_providers WHERE id = $1', [providerId]);

      logger.info('SAML provider deleted', { providerId });
    } catch (error) {
      logger.error('Failed to delete SAML provider', { error, providerId });
      throw error;
    }
  }
}

export const samlService = new SAMLService();
