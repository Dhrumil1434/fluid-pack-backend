# Cloudinary Document Upload Fix

## Problem
Documents (PDFs, DOCX, XLSX, etc.) were being uploaded to Cloudinary but appeared corrupted/truncated in the dashboard. When downloaded, they showed as unformatted "chunk files" instead of proper documents.

## Root Cause
1. **Missing file extension in public_id**: Cloudinary requires the file extension in the `public_id` for raw files to maintain proper format metadata
2. **Incorrect resource_type**: Documents were sometimes uploaded with `resource_type: "auto"` which could be detected as "image", corrupting the file
3. **Wrong URL path**: Documents were being delivered via `/image/upload/` instead of `/raw/upload/`
4. **Filename not preserved**: Original filenames were not being preserved, making it hard to identify files

## Solution Implemented

### 1. Preserve Original Filename with Extension
- For documents (`resource_type: "raw"`): Original filename is preserved with extension
- Format: `{original_name}_{timestamp}_{uuid}.{extension}`
- Example: `invoice_1234567890_abc12345.pdf`

### 2. Proper Resource Type Handling
- Documents: Always use `resource_type: "raw"`
- Images: Always use `resource_type: "image"`
- QA files: Auto-detect based on MIME type (images → 'image', documents → 'raw')

### 3. Cloudinary Upload Options
```typescript
{
  resource_type: "raw",           // CRITICAL for documents
  use_filename: true,             // Preserve original filename
  unique_filename: false,          // Don't generate random names
  public_id: "folder/filename.pdf" // MUST include extension
}
```

### 4. URL Verification
- Automatically verifies URLs use correct path:
  - Documents: `/raw/upload/`
  - Images: `/image/upload/`
- Fixes incorrect URLs automatically

### 5. Enhanced Logging
- Logs upload details for debugging:
  - Resource type
  - File format
  - File size
  - Public ID
  - URL path verification

## Changes Made

### `back-end/src/config/cloudinary.config.ts`
- Added `useOriginalFilename` parameter
- Added extension verification for raw files
- Added URL path correction
- Enhanced error logging
- Added upload success logging

### `back-end/src/middlewares/multer.middleware.ts`
- **Machine documents**: Now preserve original filename with extension
- **QA machine files**: Smart storage that detects file type and uses appropriate resource_type
- **QC approvals**: Use `resource_type: "raw"` with original filename
- All document uploads now include file extension in public_id

## Verification Steps

### 1. Check Upload Logs
After uploading a document, check server logs for:
```
✅ Uploaded raw: {
  originalname: "invoice.pdf",
  resource_type: "raw",
  format: "pdf",
  bytes: 12345,
  public_id: "machines/documents/invoice_1234567890_abc12345.pdf",
  url_path: "/raw/upload/"
}
```

### 2. Verify in Cloudinary Dashboard
- Go to Cloudinary Media Library
- Check the uploaded document:
  - ✅ **Resource Type**: Should show "Raw" (not "Image")
  - ✅ **Format**: Should show correct format (pdf, docx, xlsx, etc.)
  - ✅ **File Size**: Should match original file size
  - ✅ **Public ID**: Should include file extension (e.g., `.pdf`)

### 3. Check the URL
The `secure_url` should look like:
```
https://res.cloudinary.com/yourcloud/raw/upload/v1234567890/machines/documents/invoice_1234567890_abc12345.pdf
```

**NOT** like:
```
https://res.cloudinary.com/yourcloud/image/upload/v1234567890/machines/documents/invoice_1234567890_abc12345.pdf
```

### 4. Test Download
- Download the file from Cloudinary dashboard
- Compare file size with original
- Open the file - it should open correctly (PDF opens in PDF viewer, DOCX opens in Word, etc.)

## Common Issues and Fixes

### Issue: File still shows as corrupted
**Check:**
1. Is `resource_type: "raw"` in the upload options?
2. Does `public_id` include the file extension?
3. Is the URL using `/raw/upload/` path?

### Issue: File size is 0 KB or much smaller
**Cause:** File was uploaded as image and got corrupted
**Fix:** Re-upload with `resource_type: "raw"` and proper extension

### Issue: File downloads but won't open
**Check:**
1. Verify file extension in public_id matches actual file type
2. Check if file was transformed (transformations corrupt raw files)
3. Verify URL uses `/raw/upload/` not `/image/upload/`

## Best Practices

1. **Always include extension in public_id for documents**
   ```typescript
   public_id: `folder/${filename}.${extension}`
   ```

2. **Use resource_type: "raw" for all non-image files**
   - PDFs, DOCX, XLSX, TXT, ZIP, etc. → `"raw"`
   - JPEG, PNG, GIF, WebP → `"image"`

3. **Never apply transformations to raw files**
   - Transformations (resize, crop, etc.) only work for images/videos
   - Applying transformations to raw files will corrupt them

4. **Preserve original filename when possible**
   - Makes files easier to identify
   - Helps with debugging
   - Better user experience

## Testing

After implementing these fixes:

1. Upload a PDF document
2. Check Cloudinary dashboard - should show as "Raw" type
3. Download from dashboard - should open correctly
4. Check server logs - should show correct resource_type and format
5. Verify URL - should use `/raw/upload/` path

## Additional Notes

- Old corrupted files in Cloudinary need to be re-uploaded
- The fix only applies to new uploads
- Consider migrating existing corrupted files if needed
- Logs are enabled for debugging - can be disabled in production if needed

