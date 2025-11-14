-- 017_social_tables.sql
-- Social Features: User Profiles, Follow System, Activity Feeds, Social Sharing

-- Public user profiles
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  display_name VARCHAR(255),
  bio TEXT,
  avatar_url VARCHAR(500),
  cover_photo_url VARCHAR(500),
  location VARCHAR(255),
  website VARCHAR(500),
  social_links JSONB DEFAULT '{}'::jsonb,
  is_public BOOLEAN DEFAULT false,
  is_verified BOOLEAN DEFAULT false,
  follower_count INT DEFAULT 0,
  following_count INT DEFAULT 0,
  post_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX idx_user_profiles_is_public ON user_profiles(is_public);
CREATE INDEX idx_user_profiles_display_name ON user_profiles(display_name);

-- Follow relationships
CREATE TABLE IF NOT EXISTS user_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(follower_id, following_id),
  CHECK (follower_id != following_id)
);

CREATE INDEX idx_user_follows_follower_id ON user_follows(follower_id);
CREATE INDEX idx_user_follows_following_id ON user_follows(following_id);

-- Activity feed posts
CREATE TABLE IF NOT EXISTS activity_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_type VARCHAR(50) NOT NULL, -- 'status', 'photo', 'itinerary_share', 'achievement'
  content TEXT,
  media_urls JSONB DEFAULT '[]'::jsonb,
  linked_entity_type VARCHAR(50), -- 'itinerary', 'booking', etc.
  linked_entity_id UUID,
  visibility VARCHAR(20) DEFAULT 'public', -- 'public', 'followers', 'private'
  like_count INT DEFAULT 0,
  comment_count INT DEFAULT 0,
  share_count INT DEFAULT 0,
  is_pinned BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_activity_posts_user_id ON activity_posts(user_id);
CREATE INDEX idx_activity_posts_post_type ON activity_posts(post_type);
CREATE INDEX idx_activity_posts_visibility ON activity_posts(visibility);
CREATE INDEX idx_activity_posts_created_at ON activity_posts(created_at DESC);
CREATE INDEX idx_activity_posts_linked_entity ON activity_posts(linked_entity_type, linked_entity_id);

-- Post likes
CREATE TABLE IF NOT EXISTS post_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES activity_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(post_id, user_id)
);

CREATE INDEX idx_post_likes_post_id ON post_likes(post_id);
CREATE INDEX idx_post_likes_user_id ON post_likes(user_id);

-- Post comments
CREATE TABLE IF NOT EXISTS post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES activity_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_comment_id UUID REFERENCES post_comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  like_count INT DEFAULT 0,
  is_edited BOOLEAN DEFAULT false,
  edited_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_post_comments_post_id ON post_comments(post_id);
CREATE INDEX idx_post_comments_user_id ON post_comments(user_id);
CREATE INDEX idx_post_comments_parent_id ON post_comments(parent_comment_id);

-- Social shares (tracking)
CREATE TABLE IF NOT EXISTS social_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entity_type VARCHAR(50) NOT NULL, -- 'itinerary', 'post', 'vendor', etc.
  entity_id UUID NOT NULL,
  platform VARCHAR(50) NOT NULL, -- 'facebook', 'twitter', 'linkedin', 'email', 'copy'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_social_shares_user_id ON social_shares(user_id);
CREATE INDEX idx_social_shares_entity ON social_shares(entity_type, entity_id);
CREATE INDEX idx_social_shares_platform ON social_shares(platform);

-- Activity feed (aggregated view)
CREATE TABLE IF NOT EXISTS activity_feed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity_type VARCHAR(50) NOT NULL, -- 'post', 'like', 'comment', 'follow', 'share', 'achievement'
  actor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type VARCHAR(50),
  target_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_activity_feed_user_id ON activity_feed(user_id);
CREATE INDEX idx_activity_feed_actor_id ON activity_feed(actor_id);
CREATE INDEX idx_activity_feed_created_at ON activity_feed(created_at DESC);

COMMENT ON TABLE user_profiles IS 'Public user profiles for social features';
COMMENT ON TABLE user_follows IS 'Follow relationships between users';
COMMENT ON TABLE activity_posts IS 'User activity feed posts';
COMMENT ON TABLE post_likes IS 'Likes on activity posts';
COMMENT ON TABLE post_comments IS 'Comments on activity posts';
COMMENT ON TABLE social_shares IS 'Social sharing tracking';
COMMENT ON TABLE activity_feed IS 'Aggregated activity feed for users';
