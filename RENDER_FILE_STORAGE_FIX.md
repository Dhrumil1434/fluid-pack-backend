# Render File Storage Issue - Fix Guide

## 🔴 Problem

Files uploaded to Render are not accessible because:

1. **Ephemeral Filesystem**: Render's filesystem is temporary - files are lost when the server restarts or redeploys
2. **Static File Serving**: Files saved to `./public/uploads/` may not be accessible via HTTP
3. **Path Resolution**: Relative paths might not resolve correctly in production

## ✅ Solutions

### Option 1: Use Cloud Storage (RECOMMENDED for Production)

For production deployments, use cloud storage services:

#### AWS S3

- Reliable and scalable
- Free tier: 5GB storage, 20,000 GET requests/month
- Setup required: AWS account, S3 bucket, IAM credentials

#### Cloudinary

- Easy to set up
- Free tier: 25GB storage, 25GB bandwidth/month
- Built-in image optimization

#### Other Options

- Google Cloud Storage
- Azure Blob Storage
- DigitalOcean Spaces

### Option 2: Fix Static File Serving (Temporary Fix)

If you need a quick fix for testing, ensure static files are served correctly:

1. **Verify static middleware is configured** (already done in `app.ts`):

   ```typescript
   this.app.use(express.static('public'));
   ```

2. **Use absolute paths** for file storage:

   ```typescript
   const baseDir = path.join(process.cwd(), 'public', 'uploads', 'machines');
   ```

3. **Ensure public directory exists** in your repository structure

### Option 3: Use Render Disk (Not Recommended)

Render offers persistent disk storage, but:

- Limited to 1GB on free tier
- Not scalable
- Still not ideal for production

## 🚀 Quick Fix Implementation

### Step 1: Update Static File Serving

The static middleware should already work, but verify the path:

```typescript
// In app.ts - already configured
this.app.use(express.static('public'));
```

This means files in `public/uploads/machines/...` should be accessible at `/uploads/machines/...`

### Step 2: Verify File Paths in Database

Check that stored paths start with `/uploads/` (not `./uploads/` or `public/uploads/`)

### Step 3: Test File Access

Test if files are accessible:

```bash
curl https://fluid-pack-backend.onrender.com/uploads/machines/692c93981427370fafcb2b1e/machine-1764529047463-fee477bf-532d-45a4-9b4c-d541860cf123.jpg
```

### Step 4: Check Render Logs

Check Render deployment logs for:

- File upload errors
- Static file serving errors
- Path resolution issues

## 🔧 Immediate Fix: Update File Path Resolution

Update `multer.middleware.ts` to use absolute paths:

```typescript
// Change from:
const baseDir = './public/uploads/machines';

// To:
const baseDir = path.join(process.cwd(), 'public', 'uploads', 'machines');
```

## 📝 Long-term Solution: Cloud Storage Integration

### Example: AWS S3 Integration

1. Install AWS SDK:

   ```bash
   npm install aws-sdk @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
   ```

2. Create S3 service:

   ```typescript
   // services/s3.service.ts
   import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

   const s3Client = new S3Client({
     region: process.env.AWS_REGION,
     credentials: {
       accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
       secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
     },
   });

   export async function uploadToS3(
     file: Buffer,
     key: string,
   ): Promise<string> {
     const command = new PutObjectCommand({
       Bucket: process.env.AWS_S3_BUCKET!,
       Key: key,
       Body: file,
       ContentType: 'image/jpeg',
     });

     await s3Client.send(command);
     return `https://${process.env.AWS_S3_BUCKET}.s3.amazonaws.com/${key}`;
   }
   ```

3. Update multer to use memory storage and upload to S3:

   ```typescript
   const storage = multer.memoryStorage();

   // After file upload, upload to S3
   const s3Url = await uploadToS3(
     file.buffer,
     `machines/${machineId}/${filename}`,
   );
   ```

## ⚠️ Important Notes

1. **Files are lost on restart**: Any files uploaded to Render's filesystem will be deleted when:

   - Server restarts
   - Code is redeployed
   - Server goes to sleep (free tier)

2. **Static file serving**: Works only if:

   - Files exist in the `public` directory
   - Server is running
   - Path is correctly configured

3. **Production recommendation**: Always use cloud storage for production deployments

## 🆘 Troubleshooting

### Issue: Files return 404

**Check:**

1. File exists in `public/uploads/` directory
2. Static middleware is configured correctly
3. Path in database matches the file location
4. File wasn't deleted on server restart

### Issue: Files upload but can't access

**Solution:**

1. Verify static file serving is working
2. Check file permissions
3. Use absolute paths instead of relative paths
4. Consider cloud storage

### Issue: Files disappear after restart

**This is expected on Render** - use cloud storage for persistence.

## 📚 Resources

- [Render Static Files](https://render.com/docs/static-sites)
- [AWS S3 Node.js SDK](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/s3-example-creating-buckets.html)
- [Cloudinary Node.js SDK](https://cloudinary.com/documentation/node_integration)
