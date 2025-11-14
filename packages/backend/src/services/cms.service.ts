import { query } from '../db';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

export class CMSService {
  // CMS Pages
  async getPages(status?: string): Promise<any[]> {
    let sql = 'SELECT * FROM cms_pages';
    const params: any[] = [];

    if (status) {
      sql += ' WHERE status = $1';
      params.push(status);
    }

    sql += ' ORDER BY published_at DESC NULLS LAST';

    const result = await query(sql, params);
    return result.rows;
  }

  async getPageBySlug(slug: string): Promise<any> {
    const result = await query(
      'SELECT * FROM cms_pages WHERE slug = $1 AND status = $2',
      [slug, 'published']
    );

    if (result.rows.length === 0) {
      throw new AppError(404, 'NOT_FOUND', 'Page not found');
    }

    // Increment view count
    await query('UPDATE cms_pages SET view_count = view_count + 1 WHERE id = $1', [result.rows[0].id]);

    return result.rows[0];
  }

  async createPage(data: any): Promise<any> {
    const result = await query(
      `INSERT INTO cms_pages
       (slug, title, content, excerpt, meta_title, meta_description, featured_image_url,
        page_type, status, author_id, published_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [data.slug, data.title, data.content, data.excerpt, data.meta_title, data.meta_description,
       data.featured_image_url, data.page_type || 'page', data.status || 'draft',
       data.author_id, data.status === 'published' ? new Date() : null]
    );

    logger.info('CMS page created', { pageId: result.rows[0].id, slug: data.slug });
    return result.rows[0];
  }

  // Blog
  async getBlogPosts(filters: any = {}): Promise<any[]> {
    let sql = 'SELECT bp.*, u.email as author_email FROM blog_posts bp LEFT JOIN users u ON bp.author_id = u.id';
    const params: any[] = [];
    const conditions: string[] = [];
    let paramIndex = 1;

    if (filters.status) {
      conditions.push(`bp.status = $${paramIndex++}`);
      params.push(filters.status);
    } else {
      conditions.push(`bp.status = $${paramIndex++}`);
      params.push('published');
    }

    if (filters.category) {
      conditions.push(`bp.category = $${paramIndex++}`);
      params.push(filters.category);
    }

    if (filters.tag) {
      conditions.push(`$${paramIndex++} = ANY(bp.tags)`);
      params.push(filters.tag);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY bp.published_at DESC NULLS LAST LIMIT $' + paramIndex++;
    params.push(filters.limit || 50);

    sql += ' OFFSET $' + paramIndex;
    params.push(filters.offset || 0);

    const result = await query(sql, params);
    return result.rows.map(row => ({ ...row, tags: row.tags || [] }));
  }

  async getBlogPostBySlug(slug: string): Promise<any> {
    const result = await query(
      `SELECT bp.*, u.email as author_email, u.full_name as author_name
       FROM blog_posts bp
       LEFT JOIN users u ON bp.author_id = u.id
       WHERE bp.slug = $1 AND bp.status = $2`,
      [slug, 'published']
    );

    if (result.rows.length === 0) {
      throw new AppError(404, 'NOT_FOUND', 'Blog post not found');
    }

    await query('UPDATE blog_posts SET view_count = view_count + 1 WHERE id = $1', [result.rows[0].id]);

    return { ...result.rows[0], tags: result.rows[0].tags || [] };
  }

  async createBlogPost(data: any): Promise<any> {
    const result = await query(
      `INSERT INTO blog_posts
       (slug, title, content, excerpt, featured_image_url, category, tags, author_id,
        status, meta_title, meta_description, read_time_minutes, published_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [data.slug, data.title, data.content, data.excerpt, data.featured_image_url,
       data.category, data.tags || [], data.author_id, data.status || 'draft',
       data.meta_title, data.meta_description, data.read_time_minutes,
       data.status === 'published' ? new Date() : null]
    );

    logger.info('Blog post created', { postId: result.rows[0].id, slug: data.slug });
    return { ...result.rows[0], tags: result.rows[0].tags || [] };
  }

  async addBlogComment(postId: string, userId: string, content: string, parentId?: string): Promise<any> {
    const result = await query(
      `INSERT INTO blog_comments (post_id, user_id, content, parent_comment_id)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [postId, userId, content, parentId]
    );

    await query('UPDATE blog_posts SET comment_count = comment_count + 1 WHERE id = $1', [postId]);

    return result.rows[0];
  }

  // Help Center
  async getHelpCategories(): Promise<any[]> {
    const result = await query(
      'SELECT * FROM help_categories WHERE is_active = true ORDER BY display_order ASC, name ASC'
    );
    return result.rows;
  }

  async getHelpArticles(categoryId?: string): Promise<any[]> {
    let sql = 'SELECT * FROM help_articles WHERE status = $1';
    const params: any[] = ['published'];

    if (categoryId) {
      sql += ' AND category_id = $2';
      params.push(categoryId);
    }

    sql += ' ORDER BY is_featured DESC, display_order ASC, title ASC';

    const result = await query(sql, params);
    return result.rows.map(row => ({ ...row, keywords: row.keywords || [] }));
  }

  async getHelpArticleBySlug(slug: string): Promise<any> {
    const result = await query(
      `SELECT ha.*, hc.name as category_name
       FROM help_articles ha
       INNER JOIN help_categories hc ON ha.category_id = hc.id
       WHERE ha.slug = $1 AND ha.status = $2`,
      [slug, 'published']
    );

    if (result.rows.length === 0) {
      throw new AppError(404, 'NOT_FOUND', 'Article not found');
    }

    await query('UPDATE help_articles SET view_count = view_count + 1 WHERE id = $1', [result.rows[0].id]);

    return { ...result.rows[0], keywords: result.rows[0].keywords || [] };
  }

  async createHelpArticle(data: any): Promise<any> {
    const result = await query(
      `INSERT INTO help_articles
       (category_id, title, slug, content, summary, keywords, is_featured, display_order, author_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [data.category_id, data.title, data.slug, data.content, data.summary,
       data.keywords || [], data.is_featured || false, data.display_order || 0, data.author_id]
    );

    logger.info('Help article created', { articleId: result.rows[0].id, slug: data.slug });
    return { ...result.rows[0], keywords: result.rows[0].keywords || [] };
  }

  async submitHelpFeedback(articleId: string, isHelpful: boolean, userId?: string, comment?: string): Promise<void> {
    await query(
      'INSERT INTO help_feedback (article_id, user_id, is_helpful, comment) VALUES ($1, $2, $3, $4)',
      [articleId, userId, isHelpful, comment]
    );

    const field = isHelpful ? 'helpful_count' : 'not_helpful_count';
    await query(`UPDATE help_articles SET ${field} = ${field} + 1 WHERE id = $1`, [articleId]);

    logger.info('Help feedback submitted', { articleId, isHelpful });
  }

  async searchHelp(searchQuery: string): Promise<any[]> {
    const result = await query(
      `SELECT * FROM help_articles
       WHERE status = 'published'
         AND (title ILIKE $1 OR content ILIKE $1 OR summary ILIKE $1)
       ORDER BY view_count DESC LIMIT 20`,
      [`%${searchQuery}%`]
    );

    return result.rows.map(row => ({ ...row, keywords: row.keywords || [] }));
  }

  // FAQ
  async getFAQs(category?: string): Promise<any[]> {
    let sql = 'SELECT * FROM faq_items WHERE is_active = true';
    const params: any[] = [];

    if (category) {
      sql += ' AND category = $1';
      params.push(category);
    }

    sql += ' ORDER BY category, display_order ASC, question ASC';

    const result = await query(sql, params);
    return result.rows.map(row => ({ ...row, keywords: row.keywords || [] }));
  }

  async createFAQ(data: any): Promise<any> {
    const result = await query(
      `INSERT INTO faq_items (category, question, answer, display_order, keywords)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [data.category, data.question, data.answer, data.display_order || 0, data.keywords || []]
    );

    logger.info('FAQ created', { faqId: result.rows[0].id });
    return { ...result.rows[0], keywords: result.rows[0].keywords || [] };
  }

  async searchFAQs(searchQuery: string): Promise<any[]> {
    const result = await query(
      `SELECT * FROM faq_items
       WHERE is_active = true
         AND (question ILIKE $1 OR answer ILIKE $1)
       ORDER BY helpful_count DESC LIMIT 20`,
      [`%${searchQuery}%`]
    );

    return result.rows.map(row => ({ ...row, keywords: row.keywords || [] }));
  }
}

export const cmsService = new CMSService();
