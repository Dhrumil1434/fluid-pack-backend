# Vercel Deployment Guide for Fluid Pack Backend

This guide will walk you through deploying your Express.js backend to Vercel with MongoDB Atlas connection.

## 📋 Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com) (free tier available)
2. **MongoDB Atlas**: Your database should already be set up and accessible
3. **GitHub/GitLab/Bitbucket**: Your code should be in a Git repository
4. **Node.js**: Version 18.x or higher (Vercel supports this automatically)

## 🏗️ Project Structure

Your backend is configured with:

- **Express.js** with TypeScript
- **MongoDB Atlas** connection via Mongoose
- **Socket.IO** for real-time notifications (see limitations below)
- **JWT Authentication**
- **File uploads** with Multer

## ⚠️ Important Limitations

### Socket.IO on Vercel

**Socket.IO has limitations on Vercel** because Vercel uses serverless functions:

- Serverless functions are stateless and short-lived
- WebSocket connections require persistent connections
- Socket.IO real-time features may not work as expected

**Solutions:**

1. **Option A (Recommended)**: Use polling for notifications instead of WebSocket
2. **Option B**: Deploy Socket.IO server separately (e.g., Railway, Render, or a dedicated server)
3. **Option C**: Use Vercel's Edge Functions with alternative real-time solutions

For now, the API endpoints will work, but Socket.IO connections will be limited.

## 🚀 Step-by-Step Deployment

### Step 1: Install Vercel CLI (Optional but Recommended)

```bash
npm install -g vercel
```

### Step 2: Prepare Your Environment Variables

Create a list of all environment variables you need. Based on your codebase, you'll need:

```env
# Database
MONGO_URI=your_mongodb_atlas_connection_string

# JWT Authentication
ACCESS_TOKEN_SECRET=your_secure_random_string_here
REFRESH_TOKEN_SECRET=your_secure_random_string_here
ACCESS_TOKEN_EXPIRY=1d
REFRESH_TOKEN_EXPIRY=7d

# Encryption
ENCRYPTION_KEY=your_encryption_key_here

# Server Configuration
PORT=5000
NODE_ENV=production

# CORS Configuration - Add your frontend production URL
ALLOWED_ORIGINS=https://your-frontend-domain.vercel.app,https://your-custom-domain.com
```

**Important Notes:**

- Replace `MONGO_URI` with your actual MongoDB Atlas connection string
- Generate secure random strings for `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`, and `ENCRYPTION_KEY`
- Add your frontend production URLs to `ALLOWED_ORIGINS` (comma-separated, no spaces)

### Step 3: Deploy via Vercel Dashboard

#### 3.1. Import Your Project

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Click **"Add New..."** → **"Project"**
3. Import your Git repository (GitHub/GitLab/Bitbucket)
4. Select your repository and click **"Import"**

#### 3.2. Configure Project Settings

In the project configuration:

1. **Framework Preset**: Select **"Other"** or **"Node.js"**
2. **Root Directory**: Set to `back-end` (if your repo has both frontend and backend)
3. **Build Command**: `npm run build` or `tsc`
4. **Output Directory**: Leave empty (Vercel will handle this)
5. **Install Command**: `npm install`

#### 3.3. Add Environment Variables

1. Scroll down to **"Environment Variables"** section
2. Add each environment variable from Step 2:
   - Click **"Add"** for each variable
   - Enter the **Name** and **Value**
   - Select environments: **Production**, **Preview**, and **Development** (as needed)
3. Click **"Deploy"**

### Step 4: Deploy via Vercel CLI (Alternative Method)

If you prefer using the CLI:

```bash
# Navigate to your back-end directory
cd back-end

# Login to Vercel
vercel login

# Deploy (first time - will ask questions)
vercel

# Set environment variables
vercel env add MONGO_URI
vercel env add ACCESS_TOKEN_SECRET
vercel env add REFRESH_TOKEN_SECRET
vercel env add ACCESS_TOKEN_EXPIRY
vercel env add REFRESH_TOKEN_EXPIRY
vercel env add ENCRYPTION_KEY
vercel env add NODE_ENV
vercel env add ALLOWED_ORIGINS

# Deploy to production
vercel --prod
```

### Step 5: Verify Deployment

1. After deployment, Vercel will provide you with a URL like:

   ```
   https://your-project-name.vercel.app
   ```

2. Test your API endpoints:

   ```bash
   # Health check (if you have one)
   curl https://your-project-name.vercel.app/api/health

   # Test a public endpoint
   curl https://your-project-name.vercel.app/api/categories
   ```

3. Check Vercel logs:
   - Go to your project dashboard
   - Click on **"Deployments"**
   - Click on the latest deployment
   - Check **"Functions"** tab for any errors

## 🔧 Configuration Files

### vercel.json

**⚠️ Important**: This configuration uses the `builds` system only. Vercel does not allow mixing `builds` and `functions` blocks in the same configuration file.

The `vercel.json` file is already created in your project root. It configures:

- Serverless function routing using the `builds` system
- API route handling
- All routes are directed to the Express app via `/api/index.ts`

**Note**: This configuration uses the `builds` system (not `functions`). Function settings like `maxDuration` should be configured in the Vercel Dashboard under Project Settings → Functions.

### api/index.ts

The `api/index.ts` file is the Vercel serverless function entry point that:

- Wraps your Express app
- Handles database connections
- Manages CORS preflight requests

## 🔐 Security Best Practices

1. **Never commit `.env` files** - Already in `.gitignore` ✅
2. **Use strong secrets**:
   ```bash
   # Generate secure random strings
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
3. **Restrict CORS origins** in production:
   - Only add your production frontend URLs
   - Remove localhost URLs from production environment
4. **MongoDB Atlas Security**:
   - Use IP whitelist (add Vercel's IP ranges or `0.0.0.0/0` for serverless)
   - Use strong database user credentials
   - Enable MongoDB Atlas network access rules

## 📝 MongoDB Atlas Configuration for Vercel

### Network Access

1. Go to MongoDB Atlas Dashboard
2. Navigate to **"Network Access"**
3. Add IP Address:
   - Option A: Add `0.0.0.0/0` (allows all IPs - less secure but works with serverless)
   - Option B: Add Vercel's IP ranges (more secure, but may need updates)

### Connection String

Your `MONGO_URI` should look like:

```
mongodb+srv://username:password@cluster-name.mongodb.net/database-name?retryWrites=true&w=majority
```

Make sure:

- Replace `username` and `password` with your database user credentials
- Replace `cluster-name` with your cluster name
- Replace `database-name` with your database name
- Add `?retryWrites=true&w=majority` for better connection handling

## 🐛 Troubleshooting

### Issue: "Module not found" errors

**Solution**: Ensure all dependencies are in `package.json` and run `npm install` locally to verify.

### Issue: Database connection fails

**Solutions**:

1. Check MongoDB Atlas network access settings
2. Verify `MONGO_URI` environment variable is set correctly
3. Check Vercel function logs for connection errors
4. Ensure MongoDB Atlas cluster is running

### Issue: CORS errors in production

**Solutions**:

1. Verify `ALLOWED_ORIGINS` includes your frontend production URL
2. Check that URLs in `ALLOWED_ORIGINS` match exactly (including `https://`)
3. Ensure no trailing slashes in URLs
4. Check Vercel logs for CORS debug messages

### Issue: Function timeout

**Solutions**:

1. Configure `maxDuration` in Vercel Dashboard:
   - Go to Project Settings → Functions
   - Set maximum duration (max 60s on Pro plan, 10s on Hobby plan)
   - **Note**: Cannot be set in `vercel.json` when using `builds` system
2. Optimize slow database queries
3. Add caching where possible
4. Consider upgrading Vercel plan for longer timeouts

### Issue: Socket.IO not working

**Expected**: Socket.IO has limitations on serverless platforms.

**Solutions**:

1. Use HTTP polling for notifications instead
2. Deploy Socket.IO server separately (Railway, Render, etc.)
3. Use alternative real-time solutions compatible with serverless

### Issue: File uploads not working

**Solutions**:

1. Check Multer configuration
2. Verify file size limits in `app.ts` match Vercel's limits
3. Consider using Vercel Blob Storage or AWS S3 for file storage
4. Check Vercel function payload size limits (4.5MB on Hobby plan)

## 📊 Monitoring and Logs

### View Logs

1. Go to Vercel Dashboard
2. Select your project
3. Click **"Deployments"**
4. Click on a deployment
5. Click **"Functions"** tab to see function logs
6. Click **"Runtime Logs"** for real-time logs

### Set Up Alerts

1. Go to project settings
2. Navigate to **"Notifications"**
3. Configure email/Slack alerts for:
   - Deployment failures
   - Function errors
   - High error rates

## 🔄 Continuous Deployment

Vercel automatically deploys when you push to your Git repository:

1. **Production**: Deploys from `main` or `master` branch
2. **Preview**: Creates preview deployments for other branches and PRs

### Custom Domain

1. Go to project settings
2. Navigate to **"Domains"**
3. Add your custom domain
4. Follow DNS configuration instructions

## 📦 Build Optimization

### Reduce Bundle Size

1. Ensure `node_modules` is in `.gitignore` ✅
2. Use `npm ci` instead of `npm install` in production
3. Consider using `package.json` `engines` field:
   ```json
   "engines": {
     "node": "18.x"
   }
   ```

### TypeScript Compilation

The build process compiles TypeScript to JavaScript:

- Source: `src/**/*.ts`
- Output: `dist/**/*.js`
- Vercel automatically handles this via `vercel-build` script

## 🎯 Next Steps

1. ✅ Deploy to Vercel
2. ✅ Test all API endpoints
3. ✅ Configure frontend to use production API URL
4. ⚠️ Address Socket.IO limitations (if needed)
5. ✅ Set up custom domain (optional)
6. ✅ Configure monitoring and alerts
7. ✅ Set up CI/CD workflows

## 📚 Additional Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Vercel Serverless Functions](https://vercel.com/docs/functions)
- [MongoDB Atlas Documentation](https://docs.atlas.mongodb.com/)
- [Express.js on Vercel](https://vercel.com/guides/express-js-on-vercel)

## 🆘 Support

If you encounter issues:

1. Check Vercel function logs
2. Review MongoDB Atlas connection logs
3. Verify all environment variables are set
4. Test endpoints using Postman or curl
5. Check Vercel status page: [status.vercel.com](https://status.vercel.com)

---

**Last Updated**: Based on current codebase structure
**Maintained By**: Development Team
