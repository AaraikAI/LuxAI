import { getPool } from './index';
import { logger } from '../utils/logger';
import bcrypt from 'bcrypt';

async function seed() {
  const pool = getPool();

  try {
    logger.info('Starting database seeding...');

    // Hash password for all demo users
    const hashedPassword = await bcrypt.hash('Demo123!', 10);

    // 1. Create demo users
    logger.info('Creating demo users...');

    const clientUser = await pool.query(`
      INSERT INTO users (email, password_hash, role, first_name, last_name, phone, kyc_status)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (email) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
      RETURNING id;
    `, ['client@luxai.com', hashedPassword, 'client', 'Alexander', 'Sterling', '+1-555-0101', 'verified']);

    const vendorUser = await pool.query(`
      INSERT INTO users (email, password_hash, role, first_name, last_name, phone, kyc_status)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (email) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
      RETURNING id;
    `, ['vendor@luxai.com', hashedPassword, 'vendor', 'Sophia', 'Laurent', '+1-555-0102', 'verified']);

    const designerUser = await pool.query(`
      INSERT INTO users (email, password_hash, role, first_name, last_name, phone, kyc_status)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (email) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
      RETURNING id;
    `, ['designer@luxai.com', hashedPassword, 'designer', 'Isabella', 'Chen', '+1-555-0103', 'verified']);

    const adminUser = await pool.query(`
      INSERT INTO users (email, password_hash, role, first_name, last_name, phone, kyc_status)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (email) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
      RETURNING id;
    `, ['admin@luxai.com', hashedPassword, 'admin', 'Marcus', 'Reynolds', '+1-555-0104', 'verified']);

    const clientId = clientUser.rows[0].id;
    const vendorUserId = vendorUser.rows[0].id;
    const designerId = designerUser.rows[0].id;
    const adminId = adminUser.rows[0].id;

    logger.info(`Created users: ${clientId}, ${vendorUserId}, ${designerId}, ${adminId}`);

    // 2. Create client profile
    await pool.query(`
      INSERT INTO clients (id, net_worth, preferences, live_updates_enabled)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (id) DO UPDATE SET updated_at = CURRENT_TIMESTAMP;
    `, [
      clientId,
      50000000,
      JSON.stringify({
        dietaryRestrictions: ['Vegetarian'],
        travelPreferences: ['Luxury', 'Private', 'Cultural'],
        accommodationPreferences: ['5-Star Hotels', 'Private Villas'],
        sustainabilityFocus: true
      }),
      true
    ]);

    // 3. Create vendor
    const vendor = await pool.query(`
      INSERT INTO vendors (user_id, business_name, legal_name, registration_number, category, capabilities, insurance_coverage, insurance_expires_at, kyb_status, rating, review_count)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (user_id) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
      RETURNING id;
    `, [
      vendorUserId,
      'Premier Aviation Services',
      'Premier Aviation Services LLC',
      'AVN-2024-001',
      'aviation',
      ['Private Jet Charter', 'Empty Legs', 'Helicopter Transfer'],
      10000000,
      new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
      'verified',
      4.8,
      142
    ]);

    const vendorId = vendor.rows[0].id;

    // 4. Create sample itinerary
    const itinerary = await pool.query(`
      INSERT INTO itineraries (client_id, designer_id, title, description, start_date, end_date, status, approval_status, ai_generated, total_budget, currency)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id;
    `, [
      clientId,
      designerId,
      'Mediterranean Grand Tour',
      'An exquisite 14-day journey through the French Riviera, Italian Coast, and Greek Islands, featuring Michelin-starred dining, private yacht excursions, and exclusive cultural experiences.',
      new Date('2025-06-15'),
      new Date('2025-06-29'),
      'approved',
      'approved_by_principal',
      true,
      250000,
      'USD'
    ]);

    const itineraryId = itinerary.rows[0].id;

    // 5. Create destinations for the itinerary
    await pool.query(`
      INSERT INTO destinations (itinerary_id, name, country, latitude, longitude, arrival_date, departure_date)
      VALUES
        ($1, 'Nice', 'France', 43.7102, 7.2620, '2025-06-15', '2025-06-18'),
        ($1, 'Portofino', 'Italy', 44.3027, 9.2096, '2025-06-18', '2025-06-22'),
        ($1, 'Santorini', 'Greece', 36.3932, 25.4615, '2025-06-22', '2025-06-26'),
        ($1, 'Mykonos', 'Greece', 37.4467, 25.3289, '2025-06-26', '2025-06-29');
    `, [itineraryId]);

    // 6. Create vault deals
    await pool.query(`
      INSERT INTO deals (vendor_id, title, description, category, subcategory, location, exclusivity_level, tags, min_price, max_price, currency, is_exclusive, is_off_market, is_available)
      VALUES
        ($1, 'Private Island Villa - Maldives', 'Exclusive 7-bedroom overwater villa on a private island in the Maldives. Includes personal chef, butler service, and private yacht.', 'accommodation', 'Private Villa', 'Maldives', 'invitation_only', ARRAY['Private Island', 'Ultra-Luxury', 'Overwater Villa'], 50000, 75000, 'USD', true, true, true),
        ($1, 'Château Wine Experience', 'Private tour and tasting at an exclusive French château with the vintner. Includes helicopter transfer and gourmet lunch.', 'experiences', 'Wine & Culinary', 'Bordeaux, France', 'limited_access', ARRAY['Wine', 'Culinary', 'Exclusive Access'], 5000, 8000, 'USD', true, true, true),
        ($1, 'Arctic Aurora Expedition', 'Private expedition to witness the Northern Lights aboard a luxury expedition yacht. 5 days in Norwegian fjords with expert naturalist guides.', 'experiences', 'Adventure', 'Norway', 'exclusive', ARRAY['Northern Lights', 'Yacht', 'Adventure'], 35000, 45000, 'USD', true, false, true);
    `, [vendorId]);

    // 7. Create forum posts
    await pool.query(`
      INSERT INTO forum_posts (author_id, pseudonym, title, content, category, tags, is_anonymous, upvotes, view_count)
      VALUES
        ($1, 'SophisticatedTraveler4729', 'Best Private Jet Operators in Europe?', 'Looking for recommendations for reliable private jet operators for regular travel between London and Geneva. Priority is safety record and consistency over price.', 'aviation', ARRAY['Private Jets', 'Europe', 'Recommendations'], true, 24, 342),
        ($2, NULL, 'Sustainable Luxury Travel Tips', 'After years of ultra-luxury travel, I''ve started focusing on sustainability. Here are my top tips for maintaining luxury while reducing environmental impact...', 'general', ARRAY['Sustainability', 'Tips', 'Luxury Travel'], false, 87, 1205);
    `, [clientId, designerId]);

    // 8. Create sample empty leg flights
    await pool.query(`
      INSERT INTO empty_legs (vendor_id, departure_airport, arrival_airport, departure_date, aircraft_type, passengers, price, currency, flexibility_days, radius_miles, available_until)
      VALUES
        ($1, 'TETERBORO', 'MIAMI', '2025-12-15 14:00:00', 'Gulfstream G650', 12, 28000, 'USD', 2, 100, '2025-12-14'),
        ($1, 'NICE', 'GENEVA', '2025-12-20 10:00:00', 'Bombardier Global 7500', 14, 15000, 'EUR', 1, 50, '2025-12-19');
    `, [vendorId]);

    // 9. Create sample aircraft
    await pool.query(`
      INSERT INTO aircraft (vendor_id, type, manufacturer, model, capacity, range_nm, speed_knots, safety_badges, hourly_rate)
      VALUES
        ($1, 'Large Cabin', 'Gulfstream', 'G650', 12, 7000, 516, ARRAY['ARGUS Platinum', 'Wyvern Wingman'], 8500),
        ($1, 'Ultra Long Range', 'Bombardier', 'Global 7500', 14, 7700, 516, ARRAY['ARGUS Gold', 'IS-BAO'], 9500);
    `, [vendorId]);

    logger.info('✅ Database seeding completed successfully!');
    logger.info('');
    logger.info('Demo accounts created:');
    logger.info('📧 Client:   client@luxai.com   | Password: Demo123!');
    logger.info('📧 Vendor:   vendor@luxai.com   | Password: Demo123!');
    logger.info('📧 Designer: designer@luxai.com | Password: Demo123!');
    logger.info('📧 Admin:    admin@luxai.com    | Password: Demo123!');
    logger.info('');
    logger.info('Sample data created:');
    logger.info('✈️  1 Mediterranean itinerary');
    logger.info('🏨 3 exclusive Vault deals');
    logger.info('💬 2 forum posts');
    logger.info('✈️  2 empty leg flights');
    logger.info('🛩️  2 aircraft');
    logger.info('');

    process.exit(0);
  } catch (error) {
    logger.error('Database seeding failed', error);
    console.error('Detailed error:', error);
    process.exit(1);
  }
}

seed();
