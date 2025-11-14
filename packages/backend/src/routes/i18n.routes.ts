import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { i18nService } from '../services/i18n.service';
import { z } from 'zod';

const router = Router();

/**
 * GET /i18n/languages
 * Get all active languages (public)
 */
router.get('/languages', asyncHandler(async (req, res: Response) => {
  const languages = await i18nService.getLanguages();

  res.json({
    success: true,
    data: languages,
  });
}));

/**
 * GET /i18n/translations/:languageCode
 * Get translations for a language (public)
 */
router.get('/translations/:languageCode', asyncHandler(async (req, res: Response) => {
  const { languageCode } = req.params;
  const namespace = req.query.namespace as string;

  const translations = await i18nService.getTranslations(languageCode, namespace);

  res.json({
    success: true,
    data: translations,
  });
}));

/**
 * GET /i18n/export/:languageCode
 * Export translations as JSON (public)
 */
router.get('/export/:languageCode', asyncHandler(async (req, res: Response) => {
  const { languageCode } = req.params;

  const translations = await i18nService.exportTranslations(languageCode);

  res.json(translations);
}));

// Authenticated routes
router.use(authenticate);

/**
 * GET /i18n/user/language
 * Get user's preferred language
 */
router.get('/user/language', asyncHandler(async (req: AuthRequest, res: Response) => {
  const language = await i18nService.getUserLanguage(req.user!.id);

  res.json({
    success: true,
    data: language,
  });
}));

/**
 * PUT /i18n/user/language
 * Set user's preferred language
 */
const setLanguageSchema = z.object({
  language_code: z.string(),
});

router.put('/user/language', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { language_code } = setLanguageSchema.parse(req.body);

  await i18nService.setUserLanguage(req.user!.id, language_code);

  res.json({
    success: true,
    data: {
      message: 'Language preference updated',
    },
  });
}));

/**
 * GET /i18n/content/:entityType/:entityId
 * Get localized content for an entity
 */
router.get('/content/:entityType/:entityId', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { entityType, entityId } = req.params;
  const languageCode = (req.query.lang as string) || 'en';

  const content = await i18nService.getLocalizedContent(entityType, entityId, languageCode);

  res.json({
    success: true,
    data: content,
  });
}));

// Admin routes
const requireAdmin = (req: AuthRequest, _res: Response, next: any) => {
  if (req.user!.role !== 'admin') {
    throw new AppError(403, 'FORBIDDEN', 'Admin access required');
  }
  next();
};

router.use(requireAdmin);

/**
 * GET /i18n/admin/keys
 * Get all translation keys with translations (admin)
 */
router.get('/admin/keys', asyncHandler(async (req: AuthRequest, res: Response) => {
  const namespace = req.query.namespace as string;

  const keys = await i18nService.getTranslationKeys(namespace);

  res.json({
    success: true,
    data: keys,
  });
}));

/**
 * POST /i18n/admin/keys
 * Create translation key (admin)
 */
const createKeySchema = z.object({
  key_name: z.string(),
  namespace: z.string(),
  description: z.string().optional(),
  context: z.string().optional(),
});

router.post('/admin/keys', asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = createKeySchema.parse(req.body);

  const key = await i18nService.createTranslationKey(data);

  res.json({
    success: true,
    data: key,
  });
}));

/**
 * PUT /i18n/admin/translations
 * Update translation (admin)
 */
const updateTranslationSchema = z.object({
  key_name: z.string(),
  language_code: z.string(),
  value: z.string(),
});

router.put('/admin/translations', asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = updateTranslationSchema.parse(req.body);

  const translation = await i18nService.updateTranslation({
    ...data,
    translated_by: req.user!.id,
  });

  res.json({
    success: true,
    data: translation,
  });
}));

/**
 * POST /i18n/admin/translations/verify
 * Verify translation (admin)
 */
const verifyTranslationSchema = z.object({
  key_name: z.string(),
  language_code: z.string(),
});

router.post('/admin/translations/verify', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { key_name, language_code } = verifyTranslationSchema.parse(req.body);

  await i18nService.verifyTranslation(key_name, language_code, req.user!.id);

  res.json({
    success: true,
    data: {
      message: 'Translation verified',
    },
  });
}));

/**
 * PUT /i18n/admin/content
 * Set localized content (admin)
 */
const setContentSchema = z.object({
  entity_type: z.string(),
  entity_id: z.string(),
  language_code: z.string(),
  fields: z.record(z.string()),
});

router.put('/admin/content', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { entity_type, entity_id, language_code, fields } = setContentSchema.parse(req.body);

  await i18nService.setLocalizedContent(entity_type, entity_id, language_code, fields);

  res.json({
    success: true,
    data: {
      message: 'Localized content updated',
    },
  });
}));

/**
 * GET /i18n/admin/stats
 * Get translation coverage statistics (admin)
 */
router.get('/admin/stats', asyncHandler(async (req: AuthRequest, res: Response) => {
  const stats = await i18nService.getTranslationStats();

  res.json({
    success: true,
    data: stats,
  });
}));

export default router;
