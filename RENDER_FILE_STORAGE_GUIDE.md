# Render File Storage Guide

## ⚠️ Important: Ephemeral Filesystem on Render

**Render uses an ephemeral filesystem**, which means:
- Files uploaded to the local filesystem are **lost** when:
  - The server restarts
  - The application redeploys
  - The service is stopped and started
  - Render performs maintenance

## 🔍 Current Issue

Your files are being stored in `./public/uploads/` which:
1. ✅ Works temporarily (files are accessible immediately after upload)
2. ❌ Files are lost on server restart/redeploy
3. ❌ The `public/` directory is in `.gitignore`, so it's not deployed

## ✅ Solutions Implemented

### 1. Directory Initialization
- Created `src/utils/ensureUploadDirs.ts` to ensure all upload directories exist on startup
- Directories are automatically created when the server starts
- This ensures the file structure exists even if the `public/` folder is empty

### 2. Static File Serving
- Updated `src/app.ts` to use absolute paths for static file serving
- Added explicit `/uploads` route for better compatibility
- Files are now accessible via:
  - `https://your-domain.com/uploads/machines/{machineId}/filename.jpg`
  - `https://your-domain.com/uploads/machines/{machineId}/filename.jpg`

## 🚀 Recommended Solutions for Production

### Option 1: Cloud Storage (Recommended)

Use cloud storage services for persistent file storage:

#### AWS S3
```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

**Benefits:**
- ✅ Persistent storage (files never lost)
- ✅ Scalable and reliable
- ✅ CDN integration available
- ✅ Cost-effective for large files

#### Cloudinary
```bash
npm install cloudinary
```

**Benefits:**
- ✅ Image optimization and transformations
- ✅ Easy integration
- ✅ Free tier available
- ✅ Automatic CDN

#### Google Cloud Storage
```bash
npm install @google-cloud/storage
```

**Benefits:**
- ✅ Enterprise-grade reliability
- ✅ Global CDN
- ✅ Good integration with Google services

### Option 2: Render Disk (Limited)

Render offers persistent disk storage, but:
- ⚠️ Limited to specific plans
- ⚠️ Not recommended for production
- ⚠️ Still has limitations

### Option 3: External File Server

Deploy a separate file server (e.g., on DigitalOcean, AWS EC2):
- ✅ Full control
- ✅ Can use any storage solution
- ⚠️ Additional infrastructure to manage

## 📝 Implementation Steps for Cloud Storage

### Example: AWS S3 Integration

1. **Install dependencies:**
```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner multer-s3
```

2. **Update multer configuration:**
```typescript
import multerS3 from 'multer-s3';
import { S3Client } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const machineStorage = multerS3({
  s3: s3Client,
  bucket: process.env.AWS_S3_BUCKET_NAME!,
  key: (req, file, cb) => {
    const machineId = req.params.id || 'temp';
    const filename = `machines/${machineId}/${Date.now()}-${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, filename);
  },
});
```

3. **Update file paths in database:**
- Store S3 URLs instead of local paths
- Format: `https://{bucket}.s3.{region}.amazonaws.com/{key}`

4. **Environment variables:**
```env
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_S3_BUCKET_NAME=your-bucket-name
```

## 🔧 Current Workaround

For now, files will work temporarily but will be lost on restart. To minimize issues:

1. **Files are accessible immediately after upload**
2. **Directories are created automatically on startup**
3. **Static file serving is properly configured**

## 🎯 Next Steps

1. **Short-term:** Current setup works for testing, but files will be lost on restart
2. **Medium-term:** Implement cloud storage (AWS S3 recommended)
3. **Long-term:** Consider CDN for better performance

## 📚 Resources

- [Render Filesystem Documentation](https://render.com/docs/persistent-disks)
- [AWS S3 Node.js SDK](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/s3-examples.html)
- [Cloudinary Node.js SDK](https://cloudinary.com/documentation/node_integration)
- [Multer S3](https://github.com/badunk/multer-s3)

---

**Note:** The current implementation ensures directories exist and files are served correctly, but for production, cloud storage is essential.

