import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { cmsService } from '../services/cms.service';
import { z } from 'zod';

const router = Router();

// Public routes
router.get('/pages/:slug', asyncHandler(async (req, res: Response) => {
  const { slug } = req.params;
  const page = await cmsService.getPageBySlug(slug);
  res.json({ success: true, data: page });
}));

router.get('/blog', asyncHandler(async (req, res: Response) => {
  const filters = {
    status: 'published',
    category: req.query.category as string,
    tag: req.query.tag as string,
    limit: parseInt(req.query.limit as string) || 20,
    offset: parseInt(req.query.offset as string) || 0,
  };
  const posts = await cmsService.getBlogPosts(filters);
  res.json({ success: true, data: posts });
}));

router.get('/blog/:slug', asyncHandler(async (req, res: Response) => {
  const { slug } = req.params;
  const post = await cmsService.getBlogPostBySlug(slug);
  res.json({ success: true, data: post });
}));

router.get('/help/categories', asyncHandler(async (req, res: Response) => {
  const categories = await cmsService.getHelpCategories();
  res.json({ success: true, data: categories });
}));

router.get('/help/articles', asyncHandler(async (req, res: Response) => {
  const categoryId = req.query.category_id as string;
  const articles = await cmsService.getHelpArticles(categoryId);
  res.json({ success: true, data: articles });
}));

router.get('/help/articles/:slug', asyncHandler(async (req, res: Response) => {
  const { slug } = req.params;
  const article = await cmsService.getHelpArticleBySlug(slug);
  res.json({ success: true, data: article });
}));

router.get('/help/search', asyncHandler(async (req, res: Response) => {
  const query = req.query.q as string;
  const articles = await cmsService.searchHelp(query);
  res.json({ success: true, data: articles });
}));

router.get('/faq', asyncHandler(async (req, res: Response) => {
  const category = req.query.category as string;
  const faqs = await cmsService.getFAQs(category);
  res.json({ success: true, data: faqs });
}));

router.get('/faq/search', asyncHandler(async (req, res: Response) => {
  const query = req.query.q as string;
  const faqs = await cmsService.searchFAQs(query);
  res.json({ success: true, data: faqs });
}));

// Authenticated routes
router.use(authenticate);

const addCommentSchema = z.object({
  content: z.string(),
  parent_id: z.string().optional(),
});

router.post('/blog/:postId/comments', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { postId } = req.params;
  const { content, parent_id } = addCommentSchema.parse(req.body);
  const comment = await cmsService.addBlogComment(postId, req.user!.id, content, parent_id);
  res.json({ success: true, data: comment });
}));

const submitFeedbackSchema = z.object({
  is_helpful: z.boolean(),
  comment: z.string().optional(),
});

router.post('/help/articles/:articleId/feedback', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { articleId } = req.params;
  const { is_helpful, comment } = submitFeedbackSchema.parse(req.body);
  await cmsService.submitHelpFeedback(articleId, is_helpful, req.user!.id, comment);
  res.json({ success: true, data: { message: 'Feedback submitted' } });
}));

// Admin routes
const requireAdmin = (req: AuthRequest, _res: Response, next: any) => {
  if (req.user!.role !== 'admin') {
    throw new AppError(403, 'FORBIDDEN', 'Admin access required');
  }
  next();
};

router.use('/admin', requireAdmin);

const createPageSchema = z.object({
  slug: z.string(),
  title: z.string(),
  content: z.string(),
  excerpt: z.string().optional(),
  meta_title: z.string().optional(),
  meta_description: z.string().optional(),
  featured_image_url: z.string().optional(),
  page_type: z.string().optional(),
  status: z.enum(['draft', 'published', 'archived']),
});

router.post('/admin/pages', asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = createPageSchema.parse(req.body);
  const page = await cmsService.createPage({ ...data, author_id: req.user!.id });
  res.json({ success: true, data: page });
}));

const createBlogPostSchema = z.object({
  slug: z.string(),
  title: z.string(),
  content: z.string(),
  excerpt: z.string().optional(),
  featured_image_url: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  status: z.enum(['draft', 'published']),
  meta_title: z.string().optional(),
  meta_description: z.string().optional(),
  read_time_minutes: z.number().optional(),
});

router.post('/admin/blog', asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = createBlogPostSchema.parse(req.body);
  const post = await cmsService.createBlogPost({ ...data, author_id: req.user!.id });
  res.json({ success: true, data: post });
}));

const createHelpArticleSchema = z.object({
  category_id: z.string(),
  title: z.string(),
  slug: z.string(),
  content: z.string(),
  summary: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  is_featured: z.boolean().optional(),
  display_order: z.number().optional(),
});

router.post('/admin/help/articles', asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = createHelpArticleSchema.parse(req.body);
  const article = await cmsService.createHelpArticle({ ...data, author_id: req.user!.id });
  res.json({ success: true, data: article });
}));

const createFAQSchema = z.object({
  category: z.string().optional(),
  question: z.string(),
  answer: z.string(),
  display_order: z.number().optional(),
  keywords: z.array(z.string()).optional(),
});

router.post('/admin/faq', asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = createFAQSchema.parse(req.body);
  const faq = await cmsService.createFAQ(data);
  res.json({ success: true, data: faq });
}));

export default router;
