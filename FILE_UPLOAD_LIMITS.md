# File Upload Limits Configuration

## Environment Variables

All file upload size limits are now configurable via environment variables. Set these in your `.env` file:

### Available Environment Variables

- `MAX_IMAGE_SIZE` - Maximum file size for images (in bytes)

  - Default: `104857600` (100MB)
  - Example: `MAX_IMAGE_SIZE=104857600` for 100MB

- `MAX_DOCUMENT_SIZE` - Maximum file size for documents (in bytes)

  - Default: `52428800` (50MB)
  - Example: `MAX_DOCUMENT_SIZE=52428800` for 50MB

- `MAX_QC_FILE_SIZE` - Maximum file size for QC machine files (in bytes)

  - Default: `20971520` (20MB)
  - Example: `MAX_QC_FILE_SIZE=20971520` for 20MB

- `MAX_QC_APPROVAL_SIZE` - Maximum file size for QC approval documents (in bytes)
  - Default: `20971520` (20MB)
  - Example: `MAX_QC_APPROVAL_SIZE=20971520` for 20MB

### Example .env Configuration

```env
# File Upload Size Limits (in bytes)
MAX_IMAGE_SIZE=104857600        # 100MB
MAX_DOCUMENT_SIZE=52428800      # 50MB
MAX_QC_FILE_SIZE=20971520       # 20MB
MAX_QC_APPROVAL_SIZE=20971520   # 20MB
```

### Quick Reference (Common Sizes)

- 10MB = `10485760`
- 20MB = `20971520`
- 50MB = `52428800`
- 100MB = `104857600`
- 200MB = `209715200`

## Cloudinary Account Limits

**Important:** Cloudinary has account-level file size limits that cannot be changed via code:

- **Free Tier**: 10MB per file
- **Paid Plans**: Higher limits (varies by plan)

If you encounter an error like:

```
File size too large. Got 12705998. Maximum is 10485760.
```

This means your Cloudinary account has a 10MB limit. You need to either:

1. **Upgrade your Cloudinary plan** to get higher file size limits
2. **Reduce the file size** before uploading
3. **Compress the file** before upload

The multer limits we set will prevent files from being processed if they exceed the configured limit, but if a file passes multer validation and your Cloudinary account has a lower limit, Cloudinary will reject it.

## File Type Limits by Upload Type

### Machine Images

- Uses: `MAX_IMAGE_SIZE`
- Allowed types: JPEG, JPG, PNG, GIF, WebP
- Max files: 5

### Machine Documents

- Uses: `MAX_DOCUMENT_SIZE`
- Allowed types: PDF, DOC, DOCX, XLS, XLSX, TXT, ZIP, RAR
- Max files: 10

### Combined Machine Upload (Images + Documents)

- Uses: `Math.max(MAX_IMAGE_SIZE, MAX_DOCUMENT_SIZE)` (the larger of the two)
- Max files: 15 total (5 images + 10 documents)

### QA Machine Files

- Uses: `MAX_QC_FILE_SIZE`
- Allowed types: Images (JPEG, JPG, PNG, GIF, WebP) and Documents (PDF, DOC, DOCX, XLS, XLSX, TXT, CSV)
- Max files: 10

### QC Approval Documents

- Uses: `MAX_QC_APPROVAL_SIZE`
- Allowed types: PDF, DOC, DOCX, JPG, PNG, XLS, XLSX
- Max files: 10

## Troubleshooting

### Error: "File size too large"

1. Check your environment variables are set correctly
2. Verify the file size is within the configured limit
3. Check your Cloudinary account plan limits
4. If using Cloudinary free tier, consider upgrading or compressing files

### Error: "CLOUDINARY_FILE_SIZE_LIMIT"

This means the file passed multer validation but was rejected by Cloudinary due to account limits. You need to upgrade your Cloudinary plan.

## Notes

- All limits are in **bytes**
- The system will use the larger limit when multiple file types are uploaded together
- Error messages will display the configured limits in MB for better readability
- Cloudinary account limits take precedence over configured multer limits
