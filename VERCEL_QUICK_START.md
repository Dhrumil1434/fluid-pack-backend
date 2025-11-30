# Vercel Deployment - Quick Start

## 🚀 Quick Deployment Steps

### 1. Install Dependencies
```bash
cd back-end
npm install
```

### 2. Prepare Environment Variables

Create these in Vercel Dashboard (Settings → Environment Variables):

```env
MONGO_URI=your_mongodb_atlas_connection_string
ACCESS_TOKEN_SECRET=generate_secure_random_string
REFRESH_TOKEN_SECRET=generate_secure_random_string
ACCESS_TOKEN_EXPIRY=1d
REFRESH_TOKEN_EXPIRY=7d
ENCRYPTION_KEY=generate_secure_random_string
NODE_ENV=production
ALLOWED_ORIGINS=https://your-frontend-domain.vercel.app
```

**Generate secure strings:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Deploy to Vercel

**Option A: Via Dashboard**
1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Click "Add New Project"
3. Import your Git repository
4. Set Root Directory: `back-end`
5. Build Command: `npm run build`
6. Add all environment variables
7. Click "Deploy"

**Option B: Via CLI**
```bash
npm install -g vercel
cd back-end
vercel login
vercel
# Follow prompts, then:
vercel --prod
```

### 4. Test Your Deployment

After deployment, test your API:
```bash
curl https://your-project.vercel.app/api/categories
```

## 📁 Files Created

- ✅ `vercel.json` - Vercel configuration
- ✅ `api/index.ts` - Serverless function handler
- ✅ `VERCEL_DEPLOYMENT_GUIDE.md` - Complete deployment guide

## ⚠️ Important Notes

1. **Socket.IO Limitations**: Socket.IO may not work on Vercel serverless. Consider alternatives for real-time features.

2. **MongoDB Atlas**: 
   - Add `0.0.0.0/0` to Network Access (or Vercel IP ranges)
   - Use connection string format: `mongodb+srv://user:pass@cluster.mongodb.net/db?retryWrites=true&w=majority`

3. **CORS**: Update `ALLOWED_ORIGINS` with your production frontend URL

## 📚 Full Documentation

See `VERCEL_DEPLOYMENT_GUIDE.md` for:
- Detailed step-by-step instructions
- Troubleshooting guide
- Security best practices
- Monitoring setup
- Custom domain configuration

## 🆘 Need Help?

1. Check Vercel function logs in dashboard
2. Verify all environment variables are set
3. Test MongoDB Atlas connection
4. Review `VERCEL_DEPLOYMENT_GUIDE.md` troubleshooting section

