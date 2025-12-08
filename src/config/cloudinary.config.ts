import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';
import path from 'path';

/**
 * Cloudinary Configuration
 * Initializes and verifies Cloudinary connection
 */
class CloudinaryConfig {
  private initialized: boolean = false;

  /**
   * Initialize Cloudinary with environment variables
   */
  public initialize(): void {
    try {
      // Check if CLOUDINARY_URL is provided (takes precedence)
      // Cloudinary SDK automatically parses CLOUDINARY_URL if it's set
      if (process.env['CLOUDINARY_URL']) {
        // Cloudinary SDK will automatically use CLOUDINARY_URL if set
        // Just verify it's set correctly
        console.log('✅ Cloudinary initialized using CLOUDINARY_URL');
      } else {
        // Use individual environment variables
        const cloudName = process.env['CLOUDINARY_CLOUD_NAME'];
        const apiKey = process.env['CLOUDINARY_API_KEY'];
        const apiSecret = process.env['CLOUDINARY_API_SECRET'];

        if (!cloudName || !apiKey || !apiSecret) {
          throw new Error(
            'Cloudinary configuration missing. Please provide either CLOUDINARY_URL or CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET',
          );
        }

        cloudinary.config({
          cloud_name: cloudName,
          api_key: apiKey,
          api_secret: apiSecret,
          secure: true, // Use HTTPS
        });

        console.log(`✅ Cloudinary initialized with cloud name: ${cloudName}`);
      }

      this.initialized = true;
    } catch (error) {
      console.error('❌ Failed to initialize Cloudinary:', error);
      throw error;
    }
  }

  /**
   * Verify Cloudinary connection by making a test API call
   */
  public async verifyConnection(): Promise<boolean> {
    if (!this.initialized) {
      throw new Error('Cloudinary not initialized. Call initialize() first.');
    }

    try {
      // Make a simple API call to verify credentials
      await cloudinary.api.ping();
      console.log('✅ Cloudinary connection verified successfully');
      return true;
    } catch (error) {
      console.error('❌ Cloudinary connection verification failed:', error);
      return false;
    }
  }

  /**
   * Get Cloudinary instance
   */
  public getInstance(): typeof cloudinary {
    if (!this.initialized) {
      throw new Error('Cloudinary not initialized. Call initialize() first.');
    }
    return cloudinary;
  }

  /**
   * Upload a file buffer to Cloudinary
   * Properly handles both images and documents (PDF, DOCX, etc.)
   *
   * @param buffer - File buffer to upload
   * @param folder - Cloudinary folder path
   * @param publicId - Public ID (filename) with extension. For documents, MUST include extension!
   * @param resourceType - 'raw' for documents, 'image' for images
   * @param useOriginalFilename - If true, preserves original filename (for documents)
   */
  public async uploadFile(
    buffer: Buffer,
    folder: string,
    publicId?: string,
    resourceType: 'image' | 'raw' | 'auto' = 'auto',
    useOriginalFilename: boolean = false,
  ): Promise<{
    secure_url: string;
    public_id: string;
    url: string;
    format: string;
    bytes: number;
    resource_type: string;
  }> {
    if (!this.initialized) {
      throw new Error('Cloudinary not initialized. Call initialize() first.');
    }

    return new Promise((resolve, reject) => {
      // IMPORTANT: Use 'raw' for documents to prevent Cloudinary from treating them as images
      // If documents are uploaded as 'image' or 'auto', Cloudinary will corrupt PDFs/DOCs
      // 'raw' ensures documents are delivered correctly via /raw/upload/ URLs
      const finalResourceType =
        resourceType === 'raw'
          ? 'raw'
          : resourceType === 'image'
            ? 'image'
            : 'raw'; // Default to 'raw' instead of 'auto' to prevent corruption

      const uploadOptions: {
        folder: string;
        resource_type: string;
        overwrite: boolean;
        use_filename: boolean;
        unique_filename: boolean;
        public_id?: string;
      } = {
        folder: folder,
        resource_type: finalResourceType,
        overwrite: false,
        // For documents: preserve filename with extension
        // For images: use unique filename
        use_filename: useOriginalFilename,
        unique_filename: !useOriginalFilename,
        // IMPORTANT: Do NOT apply any transformations to raw files
        // Transformations (resize, crop, etc.) only work for images/videos, not raw files
      };

      // CRITICAL: For documents (raw), public_id MUST include the file extension
      // Without extension, Cloudinary may lose format metadata and corrupt the file
      if (publicId) {
        uploadOptions.public_id = publicId;

        // Verify extension is present for raw files
        if (finalResourceType === 'raw' && !path.extname(publicId)) {
          console.warn(
            `⚠️ Warning: Document public_id "${publicId}" missing extension. This may cause corruption.`,
          );
        }
      }

      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) {
            console.error('❌ Cloudinary upload error:', {
              error: error.message,
              http_code: error.http_code,
              resource_type: finalResourceType,
              public_id: publicId,
            });
            reject(error);
          } else if (result) {
            // Verify the URL uses the correct resource type path
            let secureUrl = result.secure_url;
            const actualResourceType =
              result.resource_type || finalResourceType;

            // Ensure documents use /raw/upload/ and images use /image/upload/
            if (
              actualResourceType === 'raw' &&
              secureUrl.includes('/image/upload/')
            ) {
              console.warn(
                `⚠️ URL correction: Replacing /image/upload/ with /raw/upload/ for document`,
              );
              secureUrl = secureUrl.replace('/image/upload/', '/raw/upload/');
            } else if (
              actualResourceType === 'image' &&
              secureUrl.includes('/raw/upload/')
            ) {
              console.warn(
                `⚠️ URL correction: Replacing /raw/upload/ with /image/upload/ for image`,
              );
              secureUrl = secureUrl.replace('/raw/upload/', '/image/upload/');
            }

            // Verify public_id has extension for raw files
            if (
              actualResourceType === 'raw' &&
              result.public_id &&
              !path.extname(result.public_id)
            ) {
              console.warn(
                `⚠️ WARNING: Document public_id "${result.public_id}" is missing file extension! This may cause corruption.`,
              );
            }

            const uploadResult = {
              secure_url: secureUrl,
              public_id: result.public_id,
              url: result.url,
              format: result.format || '',
              bytes: result.bytes || 0,
              resource_type: actualResourceType,
            };

            // Log successful upload details for debugging
            console.log(`✅ Cloudinary upload successful:`, {
              resource_type: uploadResult.resource_type,
              format: uploadResult.format,
              bytes: uploadResult.bytes,
              public_id: uploadResult.public_id,
              url_path: uploadResult.secure_url.includes('/raw/upload/')
                ? '/raw/upload/'
                : uploadResult.secure_url.includes('/image/upload/')
                  ? '/image/upload/'
                  : 'unknown',
            });

            resolve(uploadResult);
          } else {
            reject(new Error('Upload failed: No result returned'));
          }
        },
      );

      // Properly convert buffer to stream for binary data
      // This ensures documents (PDFs, DOCX, etc.) are not corrupted
      // Use objectMode: false to handle binary data correctly
      const readable = new Readable({
        objectMode: false,
        read() {
          // No-op, we'll push all data at once
        },
      });

      // Push the buffer and end the stream
      // Important: Don't convert to string, keep as Buffer for binary files
      readable.push(buffer);
      readable.push(null);

      // Pipe to upload stream
      readable.pipe(uploadStream);

      // Handle stream errors
      readable.on('error', (err) => {
        reject(err);
      });

      uploadStream.on('error', (err) => {
        reject(err);
      });
    });
  }

  /**
   * Delete a file from Cloudinary
   */
  public async deleteFile(
    publicId: string,
    resourceType: 'image' | 'raw' | 'auto' = 'image',
  ): Promise<void> {
    if (!this.initialized) {
      throw new Error('Cloudinary not initialized. Call initialize() first.');
    }

    try {
      await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType,
      });
    } catch (error) {
      console.error(`Error deleting file ${publicId} from Cloudinary:`, error);
      throw error;
    }
  }

  /**
   * Delete multiple files from Cloudinary
   */
  public async deleteFiles(
    publicIds: string[],
    resourceType: 'image' | 'raw' | 'auto' = 'image',
  ): Promise<void> {
    if (!this.initialized) {
      throw new Error('Cloudinary not initialized. Call initialize() first.');
    }

    if (publicIds.length === 0) {
      return;
    }

    try {
      // Cloudinary supports bulk deletion
      await cloudinary.api.delete_resources(publicIds, {
        resource_type: resourceType,
      });
    } catch (error) {
      console.error(`Error deleting files from Cloudinary:`, error);
      throw error;
    }
  }

  /**
   * Extract public_id from Cloudinary URL
   */
  public extractPublicId(url: string): string | null {
    try {
      // Cloudinary URL format: https://res.cloudinary.com/{cloud_name}/{resource_type}/upload/{version}/{public_id}.{format}
      const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[^.]+)?$/);
      if (match && match[1]) {
        // Remove folder prefix if present
        return match[1];
      }
      return null;
    } catch (error) {
      console.error(`Error extracting public_id from URL ${url}:`, error);
      return null;
    }
  }

  /**
   * Check if a URL is a Cloudinary URL
   */
  public isCloudinaryUrl(url: string): boolean {
    return url.includes('cloudinary.com') || url.includes('res.cloudinary.com');
  }

  /**
   * Ensure document URLs use /raw/upload/ instead of /image/upload/
   * This fixes corrupted document downloads
   */
  public ensureRawUrl(
    url: string,
    resourceType: 'image' | 'raw' | 'auto' = 'raw',
  ): string {
    if (!this.isCloudinaryUrl(url)) {
      return url;
    }

    // If it's a document (raw), ensure it uses /raw/upload/
    if (resourceType === 'raw' && url.includes('/image/upload/')) {
      return url.replace('/image/upload/', '/raw/upload/');
    }

    // If it's an image, ensure it uses /image/upload/
    if (resourceType === 'image' && url.includes('/raw/upload/')) {
      return url.replace('/raw/upload/', '/image/upload/');
    }

    return url;
  }

  /**
   * Verify that a Cloudinary URL has the correct resource type path
   * Returns true if URL matches expected resource type
   */
  public verifyResourceType(
    url: string,
    expectedType: 'image' | 'raw',
  ): boolean {
    if (!this.isCloudinaryUrl(url)) {
      return true; // Not a Cloudinary URL, skip verification
    }

    if (expectedType === 'raw') {
      return url.includes('/raw/upload/');
    } else if (expectedType === 'image') {
      return url.includes('/image/upload/');
    }

    return true;
  }
}

// Export singleton instance
export default new CloudinaryConfig();
