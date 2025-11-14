import { query } from '../db';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

export interface Language {
  id: string;
  code: string;
  name: string;
  native_name: string;
  is_active: boolean;
  is_default: boolean;
  direction: 'ltr' | 'rtl';
  created_at: Date;
  updated_at: Date;
}

export interface TranslationKey {
  id: string;
  key_name: string;
  namespace: string;
  description?: string;
  context?: string;
  created_at: Date;
  updated_at: Date;
}

export interface Translation {
  id: string;
  key_id: string;
  language_id: string;
  value: string;
  is_verified: boolean;
  translated_by?: string;
  verified_by?: string;
  created_at: Date;
  updated_at: Date;
}

export class I18nService {
  /**
   * Get all active languages
   */
  async getLanguages(): Promise<Language[]> {
    try {
      const result = await query(
        'SELECT * FROM languages WHERE is_active = true ORDER BY is_default DESC, name ASC'
      );

      return result.rows;
    } catch (error) {
      logger.error('Failed to get languages', { error });
      throw error;
    }
  }

  /**
   * Get language by code
   */
  async getLanguageByCode(code: string): Promise<Language> {
    try {
      const result = await query('SELECT * FROM languages WHERE code = $1', [code]);

      if (result.rows.length === 0) {
        throw new AppError(404, 'NOT_FOUND', 'Language not found');
      }

      return result.rows[0];
    } catch (error) {
      logger.error('Failed to get language', { error, code });
      throw error;
    }
  }

  /**
   * Get default language
   */
  async getDefaultLanguage(): Promise<Language> {
    try {
      const result = await query('SELECT * FROM languages WHERE is_default = true LIMIT 1');

      if (result.rows.length === 0) {
        throw new AppError(500, 'CONFIGURATION_ERROR', 'No default language configured');
      }

      return result.rows[0];
    } catch (error) {
      logger.error('Failed to get default language', { error });
      throw error;
    }
  }

  /**
   * Get user's preferred language
   */
  async getUserLanguage(userId: string): Promise<Language> {
    try {
      const result = await query(
        `SELECT l.* FROM languages l
         INNER JOIN user_language_preferences ulp ON l.id = ulp.language_id
         WHERE ulp.user_id = $1`,
        [userId]
      );

      if (result.rows.length === 0) {
        return this.getDefaultLanguage();
      }

      return result.rows[0];
    } catch (error) {
      logger.error('Failed to get user language', { error, userId });
      return this.getDefaultLanguage();
    }
  }

  /**
   * Set user's preferred language
   */
  async setUserLanguage(userId: string, languageCode: string): Promise<void> {
    try {
      const language = await this.getLanguageByCode(languageCode);

      await query(
        `INSERT INTO user_language_preferences (user_id, language_id)
         VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE SET language_id = $2, updated_at = NOW()`,
        [userId, language.id]
      );

      logger.info('User language preference updated', { userId, languageCode });
    } catch (error) {
      logger.error('Failed to set user language', { error, userId, languageCode });
      throw error;
    }
  }

  /**
   * Get translations for a language
   */
  async getTranslations(languageCode: string, namespace?: string): Promise<Record<string, string>> {
    try {
      const language = await this.getLanguageByCode(languageCode);

      let sql = `
        SELECT tk.key_name, t.value
        FROM translation_keys tk
        INNER JOIN translations t ON tk.id = t.key_id
        WHERE t.language_id = $1
      `;
      const params: any[] = [language.id];

      if (namespace) {
        sql += ' AND tk.namespace = $2';
        params.push(namespace);
      }

      const result = await query(sql, params);

      const translations: Record<string, string> = {};
      result.rows.forEach((row) => {
        translations[row.key_name] = row.value;
      });

      return translations;
    } catch (error) {
      logger.error('Failed to get translations', { error, languageCode, namespace });
      throw error;
    }
  }

  /**
   * Get translation keys with all their translations
   */
  async getTranslationKeys(namespace?: string): Promise<any[]> {
    try {
      let sql = `
        SELECT tk.id, tk.key_name, tk.namespace, tk.description, tk.context,
               json_agg(json_build_object(
                 'language_code', l.code,
                 'language_name', l.name,
                 'value', t.value,
                 'is_verified', t.is_verified
               )) as translations
        FROM translation_keys tk
        LEFT JOIN translations t ON tk.id = t.key_id
        LEFT JOIN languages l ON t.language_id = l.id
      `;
      const params: any[] = [];

      if (namespace) {
        sql += ' WHERE tk.namespace = $1';
        params.push(namespace);
      }

      sql += ' GROUP BY tk.id ORDER BY tk.namespace, tk.key_name';

      const result = await query(sql, params);

      return result.rows.map((row) => ({
        ...row,
        translations: row.translations.filter((t: any) => t.language_code !== null),
      }));
    } catch (error) {
      logger.error('Failed to get translation keys', { error, namespace });
      throw error;
    }
  }

  /**
   * Create translation key
   */
  async createTranslationKey(data: {
    key_name: string;
    namespace: string;
    description?: string;
    context?: string;
  }): Promise<TranslationKey> {
    try {
      const result = await query(
        `INSERT INTO translation_keys (key_name, namespace, description, context)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [data.key_name, data.namespace, data.description, data.context]
      );

      logger.info('Translation key created', { keyName: data.key_name });

      return result.rows[0];
    } catch (error) {
      logger.error('Failed to create translation key', { error, data });
      throw error;
    }
  }

  /**
   * Update translation
   */
  async updateTranslation(data: {
    key_name: string;
    language_code: string;
    value: string;
    translated_by?: string;
  }): Promise<Translation> {
    try {
      const language = await this.getLanguageByCode(data.language_code);

      // Get key ID
      const keyResult = await query(
        'SELECT id FROM translation_keys WHERE key_name = $1',
        [data.key_name]
      );

      if (keyResult.rows.length === 0) {
        throw new AppError(404, 'NOT_FOUND', 'Translation key not found');
      }

      const keyId = keyResult.rows[0].id;

      // Insert or update translation
      const result = await query(
        `INSERT INTO translations (key_id, language_id, value, translated_by)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (key_id, language_id)
         DO UPDATE SET value = $3, translated_by = $4, updated_at = NOW()
         RETURNING *`,
        [keyId, language.id, data.value, data.translated_by]
      );

      logger.info('Translation updated', {
        keyName: data.key_name,
        languageCode: data.language_code,
      });

      return result.rows[0];
    } catch (error) {
      logger.error('Failed to update translation', { error, data });
      throw error;
    }
  }

  /**
   * Verify translation
   */
  async verifyTranslation(
    keyName: string,
    languageCode: string,
    verifiedBy: string
  ): Promise<void> {
    try {
      const language = await this.getLanguageByCode(languageCode);

      await query(
        `UPDATE translations t
         SET is_verified = true, verified_by = $1, updated_at = NOW()
         FROM translation_keys tk
         WHERE t.key_id = tk.id
           AND tk.key_name = $2
           AND t.language_id = $3`,
        [verifiedBy, keyName, language.id]
      );

      logger.info('Translation verified', { keyName, languageCode, verifiedBy });
    } catch (error) {
      logger.error('Failed to verify translation', { error, keyName, languageCode });
      throw error;
    }
  }

  /**
   * Get localized content
   */
  async getLocalizedContent(
    entityType: string,
    entityId: string,
    languageCode: string
  ): Promise<Record<string, string>> {
    try {
      const language = await this.getLanguageByCode(languageCode);

      const result = await query(
        `SELECT field_name, field_value
         FROM localized_content
         WHERE entity_type = $1 AND entity_id = $2 AND language_id = $3`,
        [entityType, entityId, language.id]
      );

      const content: Record<string, string> = {};
      result.rows.forEach((row) => {
        content[row.field_name] = row.field_value;
      });

      return content;
    } catch (error) {
      logger.error('Failed to get localized content', { error, entityType, entityId, languageCode });
      return {};
    }
  }

  /**
   * Set localized content
   */
  async setLocalizedContent(
    entityType: string,
    entityId: string,
    languageCode: string,
    fields: Record<string, string>
  ): Promise<void> {
    try {
      const language = await this.getLanguageByCode(languageCode);

      for (const [fieldName, fieldValue] of Object.entries(fields)) {
        await query(
          `INSERT INTO localized_content (entity_type, entity_id, language_id, field_name, field_value)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (entity_type, entity_id, language_id, field_name)
           DO UPDATE SET field_value = $5, updated_at = NOW()`,
          [entityType, entityId, language.id, fieldName, fieldValue]
        );
      }

      logger.info('Localized content updated', { entityType, entityId, languageCode });
    } catch (error) {
      logger.error('Failed to set localized content', { error, entityType, entityId, languageCode });
      throw error;
    }
  }

  /**
   * Get translation coverage statistics
   */
  async getTranslationStats(): Promise<any> {
    try {
      const result = await query(`
        SELECT
          l.code,
          l.name,
          COUNT(DISTINCT t.key_id) as translated_keys,
          COUNT(DISTINCT tk.id) as total_keys,
          ROUND(COUNT(DISTINCT t.key_id)::numeric / NULLIF(COUNT(DISTINCT tk.id), 0) * 100, 2) as coverage_percentage,
          COUNT(DISTINCT CASE WHEN t.is_verified THEN t.key_id END) as verified_keys
        FROM languages l
        CROSS JOIN translation_keys tk
        LEFT JOIN translations t ON tk.id = t.key_id AND l.id = t.language_id
        WHERE l.is_active = true
        GROUP BY l.id, l.code, l.name
        ORDER BY coverage_percentage DESC
      `);

      return result.rows;
    } catch (error) {
      logger.error('Failed to get translation stats', { error });
      throw error;
    }
  }

  /**
   * Export translations to JSON
   */
  async exportTranslations(languageCode: string): Promise<Record<string, any>> {
    try {
      const translations = await this.getTranslations(languageCode);

      // Group by namespace
      const grouped: Record<string, Record<string, string>> = {};

      Object.entries(translations).forEach(([key, value]) => {
        const [namespace, ...rest] = key.split('.');
        const subKey = rest.join('.');

        if (!grouped[namespace]) {
          grouped[namespace] = {};
        }

        grouped[namespace][subKey] = value;
      });

      return grouped;
    } catch (error) {
      logger.error('Failed to export translations', { error, languageCode });
      throw error;
    }
  }
}

export const i18nService = new I18nService();
