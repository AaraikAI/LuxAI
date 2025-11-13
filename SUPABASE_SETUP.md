# Supabase Database Setup Guide

This guide will help you configure LuxAI Designer to use Supabase as your PostgreSQL database.

## Prerequisites

- A Supabase account (sign up at https://supabase.com)
- Node.js 20+ installed
- Your LuxAI project cloned locally

## Step 1: Create a Supabase Project

1. Go to https://supabase.com/dashboard
2. Click **"New Project"**
3. Fill in the project details:
   - **Name**: `luxai-designer` (or your preferred name)
   - **Database Password**: Choose a strong password (save this - you'll need it!)
   - **Region**: Choose the region closest to your users
   - **Pricing Plan**: Free tier is fine for development
4. Click **"Create new project"**
5. Wait for the project to finish setting up (1-2 minutes)

## Step 2: Get Your Database Connection String

1. In your Supabase project dashboard, go to **Settings** (gear icon in sidebar)
2. Click **"Database"** in the left menu
3. Scroll down to **"Connection String"** section
4. Select **"Transaction"** mode (this is important for connection pooling)
5. Click to reveal the connection string
6. Copy the connection string - it will look like:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.xxxxxxxxxxxxx.supabase.co:5432/postgres
   ```
7. Replace `[YOUR-PASSWORD]` with the database password you set in Step 1

## Step 3: Update Your Environment Variables

1. Open the `.env` file in the root of your LuxAI project
2. Update the `DATABASE_URL` with your Supabase connection string:
   ```bash
   DATABASE_URL=postgresql://postgres:your_actual_password@db.xxxxxxxxxxxxx.supabase.co:5432/postgres
   ```

**Important**: Make sure to replace both:
- `[YOUR-PASSWORD]` → Your actual database password
- `[YOUR-PROJECT-REF]` → Your project reference (the random string in the URL)

## Step 4: Run Database Migrations

Now that your database is connected, you need to set up the schema:

```bash
# Install dependencies (if not already done)
npm install

# Run the database migration
npm run migrate --workspace=@luxai/backend
```

This will create all the necessary tables and relationships in your Supabase database.

## Step 5: Verify the Connection

Start your backend server to verify everything is working:

```bash
npm run dev --workspace=@luxai/backend
```

You should see:
```
Database pool initialized
Server running on port 3000
```

If you see any connection errors, double-check your connection string.

## Step 6: View Your Database in Supabase

1. Go back to your Supabase dashboard
2. Click **"Table Editor"** in the sidebar
3. You should now see all your tables:
   - users
   - itineraries
   - vendors
   - approvals
   - And many more...

## Optional: Enable Row Level Security (RLS)

For production deployments, you should enable Row Level Security:

1. In Supabase dashboard, go to **"Authentication"** > **"Policies"**
2. For each table, you can create policies to restrict access
3. Example policy for `users` table:
   ```sql
   CREATE POLICY "Users can view own profile"
   ON users FOR SELECT
   USING (auth.uid() = id);
   ```

**Note**: The current application handles authentication via JWT tokens in the backend, so RLS is optional for now.

## Troubleshooting

### Connection Timeout
If you get connection timeout errors:
- Check that your IP is allowed in Supabase
- Go to **Settings** > **Database** > **Connection Pooling**
- Supabase allows connections from any IP by default

### SSL Certificate Errors
The application automatically detects Supabase connections and configures SSL. If you still have issues:
- Ensure your connection string includes `sslmode=require` parameter
- Check that you're using the "Transaction" mode connection string

### Too Many Connections
The application uses connection pooling with a max of 20 connections. If you hit limits:
- Reduce `maxConnections` in `packages/backend/src/config/index.ts`
- Or upgrade your Supabase plan for more connections

### Migration Errors
If migrations fail:
1. Check the Supabase logs: **Database** > **Logs**
2. Verify your database password is correct
3. Try running migrations manually:
   ```bash
   cd packages/backend
   npx ts-node src/db/migrate.ts
   ```

## Database Backups

Supabase automatically backs up your database daily. To access backups:
1. Go to **Settings** > **Database**
2. Scroll to **"Database Backups"**
3. Download or restore from available backups

## Next Steps

- Set up Supabase Auth (optional - currently using custom JWT auth)
- Configure Supabase Storage for file uploads (avatars, documents)
- Set up Supabase Edge Functions for serverless operations
- Enable Supabase Realtime for live data updates

## Connection String Reference

Your Supabase connection string contains:
- **Host**: `db.[project-ref].supabase.co`
- **Port**: `5432` (standard PostgreSQL)
- **Database**: `postgres` (default database)
- **User**: `postgres` (default superuser)
- **Password**: Your project password
- **SSL**: Automatically enabled

## Resources

- [Supabase Documentation](https://supabase.com/docs)
- [PostgreSQL Connection Pooling](https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler)
- [Supabase Dashboard](https://supabase.com/dashboard)
- [Supabase Status](https://status.supabase.com)

## Support

If you encounter issues:
1. Check the Supabase status page
2. Review the application logs
3. Check Supabase logs in the dashboard
4. Contact Supabase support (for Supabase-specific issues)
