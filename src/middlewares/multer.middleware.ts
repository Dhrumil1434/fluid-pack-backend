import multer from 'multer';
import path from 'path';
import { Request, Response, NextFunction } from 'express';
import { FileFilterCallback } from 'multer';
import { v4 as uuidv4 } from 'uuid';
import cloudinaryConfig from '../config/cloudinary.config';
import { StorageEngine } from 'multer';

// File size limits from environment variables (in bytes)
// Defaults: 100MB for images, 50MB for documents, 20MB for QC files
const MAX_IMAGE_SIZE = parseInt(
  process.env['MAX_IMAGE_SIZE'] || '104857600',
  10,
); // 100MB default
const MAX_DOCUMENT_SIZE = parseInt(
  process.env['MAX_DOCUMENT_SIZE'] || '52428800',
  10,
); // 50MB default
const MAX_QC_FILE_SIZE = parseInt(
  process.env['MAX_QC_FILE_SIZE'] || '20971520',
  10,
); // 20MB default
const MAX_QC_APPROVAL_SIZE = parseInt(
  process.env['MAX_QC_APPROVAL_SIZE'] || '20971520',
  10,
); // 20MB default

// Extended Multer File interface to include Cloudinary result
interface CloudinaryFile extends Express.Multer.File {
  cloudinary?: {
    secure_url: string;
    public_id: string;
    url: string;
    format: string;
    bytes: number;
    resource_type: string;
  };
}

/**
 * Custom Cloudinary storage engine for Multer
 */
class CloudinaryStorage implements StorageEngine {
  private folder: string;
  private resourceType: 'image' | 'raw' | 'auto';

  constructor(folder: string, resourceType: 'image' | 'raw' | 'auto' = 'auto') {
    this.folder = folder;
    this.resourceType = resourceType;
  }

  _handleFile(
    req: Request,
    file: Express.Multer.File,
    cb: (error?: Error | null, info?: Partial<CloudinaryFile>) => void,
  ): void {
    const chunks: Buffer[] = [];

    file.stream.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    file.stream.on('end', async () => {
      try {
        const buffer = Buffer.concat(chunks);

        // For documents (raw), preserve original filename with extension
        // For images, use unique filename to avoid conflicts
        let publicId: string | undefined;
        let useOriginalFilename = false;

        if (this.resourceType === 'raw') {
          // For documents: use original filename with extension
          // Remove any path separators and special characters from filename
          const sanitizedFilename = file.originalname
            .replace(/[^a-zA-Z0-9._-]/g, '_')
            .replace(/_{2,}/g, '_');
          const extension = path.extname(sanitizedFilename);
          const nameWithoutExt = path.basename(sanitizedFilename, extension);
          // Add timestamp to ensure uniqueness while keeping original name
          const uniqueSuffix = `${Date.now()}-${uuidv4().substring(0, 8)}`;
          publicId = `${this.folder}/${nameWithoutExt}_${uniqueSuffix}${extension}`;
          useOriginalFilename = true;
        } else {
          // For images: use unique filename
          const uniqueSuffix = `${Date.now()}-${uuidv4()}`;
          const extension = path.extname(file.originalname);
          publicId = `${this.folder}/${uniqueSuffix}${extension}`;
        }

        const result = await cloudinaryConfig.uploadFile(
          buffer,
          this.folder,
          publicId,
          this.resourceType,
          useOriginalFilename,
        );

        // Log upload result for debugging (remove in production if needed)
        console.log(`✅ Uploaded ${this.resourceType}:`, {
          originalname: file.originalname,
          resource_type: result.resource_type,
          format: result.format,
          bytes: result.bytes,
          public_id: result.public_id,
          url: result.secure_url.substring(0, 100) + '...',
        });

        const cloudinaryFile: Partial<CloudinaryFile> = {
          fieldname: file.fieldname,
          originalname: file.originalname,
          encoding: file.encoding,
          mimetype: file.mimetype,
          size: result.bytes,
          filename: path.basename(result.public_id),
          path: result.secure_url, // Store Cloudinary URL in path
          cloudinary: result,
        };

        cb(null, cloudinaryFile);
      } catch (error: unknown) {
        // Handle Cloudinary-specific errors
        const err = error as { http_code?: number; message?: string };
        if (err?.http_code === 400 && err?.message?.includes('File size')) {
          const cloudinaryError = new Error(
            `File size exceeds Cloudinary account limit. ${err.message || 'Please upgrade your Cloudinary plan or reduce file size.'}`,
          );
          cloudinaryError.name = 'CLOUDINARY_FILE_SIZE_LIMIT';
          cb(cloudinaryError);
        } else {
          cb(error as Error);
        }
      }
    });

    file.stream.on('error', (error: Error) => {
      cb(error);
    });
  }

  _removeFile(
    req: Request,
    file: Express.Multer.File,
    cb: (error?: Error | null) => void,
  ): void {
    // If file has Cloudinary info, delete from Cloudinary
    const cloudinaryFile = file as CloudinaryFile;
    if (cloudinaryFile.cloudinary?.public_id) {
      cloudinaryConfig
        .deleteFile(cloudinaryFile.cloudinary.public_id, this.resourceType)
        .then(() => cb(null))
        .catch((error) => cb(error));
    } else {
      cb(null);
    }
  }
}

// Check file type
const checkFileType = (
  file: Express.Multer.File,
  cb: FileFilterCallback,
): void => {
  // Allowed file extensions
  const filetypes = /jpeg|jpg|png|gif|webp/;

  // Check file extension
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

  // Check MIME type
  const mimetype = filetypes.test(file.mimetype);

  if (mimetype && extname) {
    cb(null, true);
  } else {
    cb(
      new Error(
        'Error: Only image files (JPEG, JPG, PNG, GIF, WebP) are allowed!',
      ),
    );
  }
};

// Check document file type
const checkDocumentType = (
  file: Express.Multer.File,
  cb: FileFilterCallback,
): void => {
  // Allowed file extensions for documents
  const filetypes = /pdf|doc|docx|xls|xlsx|txt|zip|rar/;

  // Check file extension
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

  // Check MIME type (simplified check as MIME types can vary)
  const allowedMimeTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'application/zip',
    'application/x-rar-compressed',
  ];

  if (extname && allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        'Error: Only document files (PDF, DOC, DOCX, XLS, XLSX, TXT, ZIP, RAR) are allowed!',
      ),
    );
  }
};

// Set storage engine for machine images
const machineStorage = new CloudinaryStorage('machines/images', 'image');

// Set storage engine for machine documents
// Use 'raw' for documents to prevent Cloudinary from treating them as images
// This ensures PDFs, DOCX, XLSX, etc. are not corrupted
const machineDocumentStorage = new CloudinaryStorage(
  'machines/documents',
  'raw',
);

// Set storage engine for updating machine images (when machine ID is known)
// This storage reads machineId from request params
class MachineUpdateStorage extends CloudinaryStorage {
  _handleFile(
    req: Request,
    file: Express.Multer.File,
    cb: (error?: Error | null, info?: Partial<CloudinaryFile>) => void,
  ): void {
    const machineId = req.params['id'];
    if (!machineId) {
      return cb(new Error('Machine ID is required'));
    }
    // Temporarily update folder for this request
    const originalFolder = this.folder;
    this.folder = `machines/${machineId}/images`;
    super._handleFile(req, file, (error, info) => {
      this.folder = originalFolder; // Restore original folder
      cb(error, info);
    });
  }
}

// Upload configuration for creating new machines
const uploadMachineImages = multer({
  storage: machineStorage,
  limits: {
    fileSize: MAX_IMAGE_SIZE, // Configurable from env
    files: 5, // Maximum 5 files
  },
  fileFilter: (_req, file, cb) => {
    checkFileType(file, cb);
  },
});

// Upload configuration for machine documents
const uploadMachineDocuments = multer({
  storage: machineDocumentStorage,
  limits: {
    fileSize: MAX_DOCUMENT_SIZE, // Configurable from env
    files: 10, // Maximum 10 document files
  },
  fileFilter: (_req, file, cb) => {
    checkDocumentType(file, cb);
  },
});

// Combined storage for machine files (handles both images and documents)
class CombinedMachineStorage implements StorageEngine {
  _handleFile(
    req: Request,
    file: Express.Multer.File,
    cb: (error?: Error | null, info?: Partial<CloudinaryFile>) => void,
  ): void {
    // Use appropriate storage based on fieldname
    const storage =
      file.fieldname === 'images'
        ? machineStorage
        : file.fieldname === 'documents'
          ? machineDocumentStorage
          : machineStorage; // Default to image storage

    storage._handleFile(req, file, cb);
  }

  _removeFile(
    req: Request,
    file: Express.Multer.File,
    cb: (error?: Error | null) => void,
  ): void {
    const storage =
      file.fieldname === 'images'
        ? machineStorage
        : file.fieldname === 'documents'
          ? machineDocumentStorage
          : machineStorage;

    storage._removeFile(req, file, cb);
  }
}

// Combined upload configuration for machine creation (images + documents)
// Uses the larger of the two limits to accommodate both images and documents
const uploadMachineFiles = multer({
  storage: new CombinedMachineStorage(),
  limits: {
    fileSize: Math.max(MAX_IMAGE_SIZE, MAX_DOCUMENT_SIZE), // Use the larger limit
    files: 15, // Maximum 15 files total (5 images + 10 documents)
  },
  fileFilter: (_req, file, cb) => {
    // Check if it's an image or document based on fieldname
    if (file.fieldname === 'images') {
      checkFileType(file, cb);
    } else if (file.fieldname === 'documents') {
      checkDocumentType(file, cb);
    } else {
      cb(null, false);
    }
  },
});

// Upload configuration for updating existing machines
const machineUpdateStorage = new MachineUpdateStorage('machines', 'image');

// Combined storage for machine updates (handles both images and documents)
class CombinedMachineUpdateStorage implements StorageEngine {
  private imageStorage: MachineUpdateStorage;
  private documentStorage: CloudinaryStorage;

  constructor() {
    this.imageStorage = new MachineUpdateStorage('machines', 'image');
    this.documentStorage = new CloudinaryStorage('machines/documents', 'raw');
  }

  _handleFile(
    req: Request,
    file: Express.Multer.File,
    cb: (error?: Error | null, info?: Partial<CloudinaryFile>) => void,
  ): void {
    // Use appropriate storage based on fieldname
    const storage =
      file.fieldname === 'images'
        ? this.imageStorage
        : file.fieldname === 'documents'
          ? this.documentStorage
          : this.imageStorage; // Default to image storage

    storage._handleFile(req, file, cb);
  }

  _removeFile(
    req: Request,
    file: Express.Multer.File,
    cb: (error?: Error | null) => void,
  ): void {
    const storage =
      file.fieldname === 'images'
        ? this.imageStorage
        : file.fieldname === 'documents'
          ? this.documentStorage
          : this.imageStorage;

    storage._removeFile(req, file, cb);
  }
}

const uploadMachineImagesUpdate = multer({
  storage: machineUpdateStorage,
  limits: {
    fileSize: MAX_IMAGE_SIZE, // Configurable from env
    files: 5, // Maximum 5 files
  },
  fileFilter: (_req, file, cb) => {
    checkFileType(file, cb);
  },
});

// Combined upload configuration for machine updates (images + documents)
const uploadMachineFilesUpdate = multer({
  storage: new CombinedMachineUpdateStorage(),
  limits: {
    fileSize: Math.max(MAX_IMAGE_SIZE, MAX_DOCUMENT_SIZE), // Use the larger limit
    files: 15, // Maximum 15 files total (5 images + 10 documents)
  },
  fileFilter: (_req, file, cb) => {
    // Check if it's an image or document based on fieldname
    if (file.fieldname === 'images') {
      checkFileType(file, cb);
    } else if (file.fieldname === 'documents') {
      checkDocumentType(file, cb);
    } else {
      cb(
        new Error(
          `Unexpected file field name: ${file.fieldname}. Use "images" for images or "documents" for documents.`,
        ),
        false,
      );
    }
  },
});

// Utility function to extract Cloudinary URLs from uploaded files
const extractCloudinaryUrls = (
  files: Express.Multer.File[] | { [fieldname: string]: Express.Multer.File[] },
): string[] => {
  const urls: string[] = [];

  if (Array.isArray(files)) {
    files.forEach((file) => {
      const cloudinaryFile = file as CloudinaryFile;
      if (cloudinaryFile.cloudinary?.secure_url) {
        urls.push(cloudinaryFile.cloudinary.secure_url);
      } else if (
        cloudinaryFile.path &&
        cloudinaryFile.path.startsWith('http')
      ) {
        // Fallback: use path if it's a URL
        urls.push(cloudinaryFile.path);
      }
    });
  } else {
    // Handle fields object
    Object.values(files).forEach((fileArray) => {
      if (Array.isArray(fileArray)) {
        fileArray.forEach((file) => {
          const cloudinaryFile = file as CloudinaryFile;
          if (cloudinaryFile.cloudinary?.secure_url) {
            urls.push(cloudinaryFile.cloudinary.secure_url);
          } else if (
            cloudinaryFile.path &&
            cloudinaryFile.path.startsWith('http')
          ) {
            urls.push(cloudinaryFile.path);
          }
        });
      }
    });
  }

  return urls;
};

// Utility function to move files from temp to machine-specific directory
// Now returns Cloudinary URLs directly (no moving needed)
const moveFilesToMachineDirectory = async (
  files: Express.Multer.File[],
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _machineId: string, // Prefixed with _ to indicate intentionally unused
): Promise<string[]> => {
  // With Cloudinary, files are already uploaded to the correct folder
  // Just extract the URLs
  return extractCloudinaryUrls(files);
};

// Utility function to move document files from temp to machine-specific directory
// Now returns Cloudinary URLs directly (no moving needed)
const moveDocumentFilesToMachineDirectory = async (
  files: Express.Multer.File[],
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _machineId: string, // Prefixed with _ to indicate intentionally unused
): Promise<string[]> => {
  // With Cloudinary, files are already uploaded to the correct folder
  // Just extract the URLs
  return extractCloudinaryUrls(files);
};

// Utility function to delete machine images from Cloudinary
// Can be called without await for cleanup operations
const deleteMachineImages = async (imageUrls: string[]): Promise<void> => {
  if (!imageUrls || imageUrls.length === 0) {
    return;
  }

  const publicIds: string[] = [];

  // Extract public IDs from Cloudinary URLs
  imageUrls.forEach((url) => {
    if (url && cloudinaryConfig.isCloudinaryUrl(url)) {
      const publicId = cloudinaryConfig.extractPublicId(url);
      if (publicId) {
        publicIds.push(publicId);
      }
    }
  });

  // Delete from Cloudinary
  if (publicIds.length > 0) {
    try {
      await cloudinaryConfig.deleteFiles(publicIds, 'image');
    } catch (error) {
      console.error('Error deleting images from Cloudinary:', error);
      // Don't throw - this is a cleanup operation
    }
  }
};

// Utility function to delete machine documents from Cloudinary
// Can be called without await for cleanup operations
const deleteMachineDocuments = async (
  documentUrls: string[],
): Promise<void> => {
  if (!documentUrls || documentUrls.length === 0) {
    return;
  }

  const publicIds: string[] = [];

  // Extract public IDs from Cloudinary URLs
  documentUrls.forEach((url) => {
    if (url && cloudinaryConfig.isCloudinaryUrl(url)) {
      const publicId = cloudinaryConfig.extractPublicId(url);
      if (publicId) {
        publicIds.push(publicId);
      }
    }
  });

  // Delete from Cloudinary (documents use 'raw' resource type)
  if (publicIds.length > 0) {
    try {
      await cloudinaryConfig.deleteFiles(publicIds, 'raw');
    } catch (error) {
      console.error('Error deleting documents from Cloudinary:', error);
      // Don't throw - this is a cleanup operation
    }
  }
};

// Utility function to clean up machine directory (no-op for Cloudinary)
const cleanupMachineDirectory = (machineId: string): void => {
  // No local directory cleanup needed with Cloudinary
  // Files are organized by folder in Cloudinary
  console.log(
    `Machine directory cleanup for ${machineId} - handled by Cloudinary`,
  );
};

// Smart storage for QA machine files - detects file type and uses appropriate resource_type
// This class handles the file upload directly to ensure proper filename handling
class SmartQAMachineStorage implements StorageEngine {
  _handleFile(
    req: Request,
    file: Express.Multer.File,
    cb: (error?: Error | null, info?: Partial<CloudinaryFile>) => void,
  ): void {
    const chunks: Buffer[] = [];

    file.stream.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    file.stream.on('end', async () => {
      try {
        const buffer = Buffer.concat(chunks);

        // Determine resource type based on file MIME type
        // Images: use 'image', Documents: use 'raw'
        const isImage = file.mimetype.startsWith('image/');
        const resourceType = isImage ? 'image' : 'raw';
        const folder = 'qa-machines';

        // For documents: preserve original filename with extension
        // For images: use unique filename
        let publicId: string | undefined;
        let useOriginalFilename = false;

        if (resourceType === 'raw') {
          // For documents: use original filename with extension
          const sanitizedFilename = file.originalname
            .replace(/[^a-zA-Z0-9._-]/g, '_')
            .replace(/_{2,}/g, '_');
          const extension = path.extname(sanitizedFilename);
          const nameWithoutExt = path.basename(sanitizedFilename, extension);
          const uniqueSuffix = `${Date.now()}-${uuidv4().substring(0, 8)}`;
          publicId = `${folder}/${nameWithoutExt}_${uniqueSuffix}${extension}`;
          useOriginalFilename = true;
        } else {
          // For images: use unique filename
          const uniqueSuffix = `${Date.now()}-${uuidv4()}`;
          const extension = path.extname(file.originalname);
          publicId = `${folder}/${uniqueSuffix}${extension}`;
        }

        const result = await cloudinaryConfig.uploadFile(
          buffer,
          folder,
          publicId,
          resourceType,
          useOriginalFilename,
        );

        console.log(`✅ Uploaded QA ${resourceType}:`, {
          originalname: file.originalname,
          resource_type: result.resource_type,
          format: result.format,
          bytes: result.bytes,
          public_id: result.public_id,
        });

        const cloudinaryFile: Partial<CloudinaryFile> = {
          fieldname: file.fieldname,
          originalname: file.originalname,
          encoding: file.encoding,
          mimetype: file.mimetype,
          size: result.bytes,
          filename: path.basename(result.public_id),
          path: result.secure_url,
          cloudinary: result,
        };

        cb(null, cloudinaryFile);
      } catch (error: unknown) {
        const err = error as { http_code?: number; message?: string };
        if (err?.http_code === 400 && err?.message?.includes('File size')) {
          const cloudinaryError = new Error(
            `File size exceeds Cloudinary account limit. ${err.message || 'Please upgrade your Cloudinary plan or reduce file size.'}`,
          );
          cloudinaryError.name = 'CLOUDINARY_FILE_SIZE_LIMIT';
          cb(cloudinaryError);
        } else {
          cb(error as Error);
        }
      }
    });

    file.stream.on('error', (error: Error) => {
      cb(error);
    });
  }

  _removeFile(
    req: Request,
    file: Express.Multer.File,
    cb: (error?: Error | null) => void,
  ): void {
    const isImage = file.mimetype.startsWith('image/');
    const resourceType = isImage ? 'image' : 'raw';
    const cloudinaryFile = file as CloudinaryFile;
    if (cloudinaryFile.cloudinary?.public_id) {
      cloudinaryConfig
        .deleteFile(cloudinaryFile.cloudinary.public_id, resourceType)
        .then(() => cb(null))
        .catch((error) => cb(error));
    } else {
      cb(null);
    }
  }
}

// Set storage engine for QA machine files
// Uses smart storage that detects file type (images vs documents)
const qaMachineStorage = new SmartQAMachineStorage();

// Set storage engine for updating QA machine files (when QA entry ID is known)
// This storage reads qaEntryId from request params and detects file type
class QAMachineUpdateStorage implements StorageEngine {
  _handleFile(
    req: Request,
    file: Express.Multer.File,
    cb: (error?: Error | null, info?: Partial<CloudinaryFile>) => void,
  ): void {
    const qaEntryId = req.params['id'];
    if (!qaEntryId) {
      return cb(new Error('QA Entry ID is required'));
    }

    const chunks: Buffer[] = [];

    file.stream.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    file.stream.on('end', async () => {
      try {
        const buffer = Buffer.concat(chunks);

        // Determine resource type based on file MIME type
        // Images: use 'image', Documents: use 'raw'
        const isImage = file.mimetype.startsWith('image/');
        const resourceType = isImage ? 'image' : 'raw';
        const folder = `qa-machines/${qaEntryId}`;

        // For documents: preserve original filename with extension
        // For images: use unique filename
        let publicId: string | undefined;
        let useOriginalFilename = false;

        if (resourceType === 'raw') {
          // For documents: use original filename with extension
          const sanitizedFilename = file.originalname
            .replace(/[^a-zA-Z0-9._-]/g, '_')
            .replace(/_{2,}/g, '_');
          const extension = path.extname(sanitizedFilename);
          const nameWithoutExt = path.basename(sanitizedFilename, extension);
          const uniqueSuffix = `${Date.now()}-${uuidv4().substring(0, 8)}`;
          publicId = `${folder}/${nameWithoutExt}_${uniqueSuffix}${extension}`;
          useOriginalFilename = true;
        } else {
          // For images: use unique filename
          const uniqueSuffix = `${Date.now()}-${uuidv4()}`;
          const extension = path.extname(file.originalname);
          publicId = `${folder}/${uniqueSuffix}${extension}`;
        }

        const result = await cloudinaryConfig.uploadFile(
          buffer,
          folder,
          publicId,
          resourceType,
          useOriginalFilename,
        );

        console.log(`✅ Uploaded QA Update ${resourceType}:`, {
          originalname: file.originalname,
          resource_type: result.resource_type,
          format: result.format,
          bytes: result.bytes,
          public_id: result.public_id,
        });

        const cloudinaryFile: Partial<CloudinaryFile> = {
          fieldname: file.fieldname,
          originalname: file.originalname,
          encoding: file.encoding,
          mimetype: file.mimetype,
          size: result.bytes,
          filename: path.basename(result.public_id),
          path: result.secure_url,
          cloudinary: result,
        };

        cb(null, cloudinaryFile);
      } catch (error: unknown) {
        const err = error as { http_code?: number; message?: string };
        if (err?.http_code === 400 && err?.message?.includes('File size')) {
          const cloudinaryError = new Error(
            `File size exceeds Cloudinary account limit. ${err.message || 'Please upgrade your Cloudinary plan or reduce file size.'}`,
          );
          cloudinaryError.name = 'CLOUDINARY_FILE_SIZE_LIMIT';
          cb(cloudinaryError);
        } else {
          cb(error as Error);
        }
      }
    });

    file.stream.on('error', (error: Error) => {
      cb(error);
    });
  }

  _removeFile(
    req: Request,
    file: Express.Multer.File,
    cb: (error?: Error | null) => void,
  ): void {
    const isImage = file.mimetype.startsWith('image/');
    const resourceType = isImage ? 'image' : 'raw';
    const cloudinaryFile = file as CloudinaryFile;
    if (cloudinaryFile.cloudinary?.public_id) {
      cloudinaryConfig
        .deleteFile(cloudinaryFile.cloudinary.public_id, resourceType)
        .then(() => cb(null))
        .catch((error) => cb(error));
    } else {
      cb(null);
    }
  }
}

// Check file type for QA documents (allow more file types)
const checkQADocumentType = (
  file: Express.Multer.File,
  cb: FileFilterCallback,
): void => {
  // Allowed file extensions for QA documents
  const allowedExtensions = [
    'jpeg',
    'jpg',
    'png',
    'gif',
    'webp', // Images
    'pdf',
    'doc',
    'docx',
    'xls',
    'xlsx',
    'txt',
    'csv', // Documents
    'ppt',
    'pptx',
    'zip',
    'rar',
    '7z', // Additional document types
  ];

  // Allowed MIME types for QA documents
  const allowedMimeTypes = [
    // Images
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    // Documents
    'application/pdf',
    'application/msword', // .doc
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/vnd.ms-excel', // .xls
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'text/plain', // .txt
    'text/csv', // .csv
    'application/csv',
    // Additional document types
    'application/vnd.ms-powerpoint', // .ppt
    'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
    'application/zip', // .zip
    'application/x-rar-compressed', // .rar
    'application/x-7z-compressed', // .7z
    // Generic document types
    'application/octet-stream', // Fallback for some document types
    'application/x-zip-compressed',
  ];

  // Get file extension (without dot)
  const fileExtension = path
    .extname(file.originalname)
    .toLowerCase()
    .replace('.', '');

  // Check file extension
  const hasValidExtension = allowedExtensions.includes(fileExtension);

  // Check MIME type
  const hasValidMimeType =
    allowedMimeTypes.includes(file.mimetype.toLowerCase()) ||
    file.mimetype.toLowerCase().startsWith('image/') ||
    file.mimetype.toLowerCase().startsWith('text/');

  // Allow if either extension or MIME type is valid (more lenient)
  // This handles cases where MIME type might not be detected correctly
  if (hasValidExtension || hasValidMimeType) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `Error: File type not allowed. Allowed types: Images (JPEG, JPG, PNG, GIF, WebP) and Documents (PDF, DOC, DOCX, XLS, XLSX, TXT, CSV, PPT, PPTX, ZIP, RAR, 7Z). Your file: ${file.originalname} (${file.mimetype})`,
      ),
    );
  }
};

// Upload configuration for creating new QC machine entries
const uploadQAMachineFiles = multer({
  storage: qaMachineStorage,
  limits: {
    fileSize: MAX_QC_FILE_SIZE, // Configurable from env
    files: 10, // Maximum 10 files
  },
  fileFilter: (_req, file, cb) => {
    checkQADocumentType(file, cb);
  },
});

// Upload configuration for updating existing QC machine entries
const qaMachineUpdateStorage = new QAMachineUpdateStorage();

const uploadQAMachineFilesUpdate = multer({
  storage: qaMachineUpdateStorage,
  limits: {
    fileSize: MAX_QC_FILE_SIZE, // Configurable from env
    files: 10, // Maximum 10 files
  },
  fileFilter: (_req, file, cb) => {
    checkQADocumentType(file, cb);
  },
});

// Utility function to move QC files from temp to QC entry-specific directory
// Now returns Cloudinary URLs directly (no moving needed)
const moveQAFilesToEntryDirectory = async (
  files: Express.Multer.File[],
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _qaEntryId: string, // Prefixed with _ to indicate intentionally unused
): Promise<string[]> => {
  // With Cloudinary, files are already uploaded to the correct folder
  // Just extract the URLs
  return extractCloudinaryUrls(files);
};

// Utility function to delete QC files from Cloudinary
// Can be called without await for cleanup operations
const deleteQAFiles = async (fileUrls: string[]): Promise<void> => {
  if (!fileUrls || fileUrls.length === 0) {
    return;
  }

  const publicIds: string[] = [];

  // Extract public IDs from Cloudinary URLs
  fileUrls.forEach((url) => {
    if (url && cloudinaryConfig.isCloudinaryUrl(url)) {
      const publicId = cloudinaryConfig.extractPublicId(url);
      if (publicId) {
        publicIds.push(publicId);
      }
    }
  });

  // Delete from Cloudinary
  if (publicIds.length > 0) {
    try {
      await cloudinaryConfig.deleteFiles(publicIds, 'auto');
    } catch (error) {
      console.error('Error deleting files from Cloudinary:', error);
      // Don't throw - this is a cleanup operation
    }
  }
};

// Utility function to clean up QC entry directory (no-op for Cloudinary)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const cleanupQAEntryDirectory = (_qaEntryId: string): void => {
  // No local directory cleanup needed with Cloudinary
  // Files are organized by folder in Cloudinary
  // Parameter kept for API compatibility but not used
};

// Error handling middleware for file uploads
const handleFileUploadError = (
  error: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const err = error as multer.MulterError & { message?: string };
  // Clean up any uploaded files on error
  if (req.files) {
    const files = Array.isArray(req.files)
      ? req.files
      : Object.values(req.files).flat();

    // Delete uploaded files from Cloudinary on error
    const urls = extractCloudinaryUrls(files as Express.Multer.File[]);
    if (urls.length > 0) {
      // Determine resource type based on route
      const resourceType =
        req.path.includes('/qc-machines') || req.path.includes('/qc-approvals')
          ? 'auto'
          : 'image';

      urls.forEach((url) => {
        if (cloudinaryConfig.isCloudinaryUrl(url)) {
          const publicId = cloudinaryConfig.extractPublicId(url);
          if (publicId) {
            cloudinaryConfig
              .deleteFile(publicId, resourceType)
              .catch((error) =>
                console.error('Error cleaning up file on error:', error),
              );
          }
        }
      });
    }
  }

  // Handle multer-specific errors
  if (err instanceof multer.MulterError) {
    switch (err.code) {
      case 'LIMIT_FILE_SIZE':
        res.status(400).json({
          success: false,
          message: `File too large. Maximum file size is ${Math.round(MAX_IMAGE_SIZE / 1024 / 1024)}MB for images, ${Math.round(MAX_DOCUMENT_SIZE / 1024 / 1024)}MB for documents, and ${Math.round(MAX_QC_FILE_SIZE / 1024 / 1024)}MB for QC files.`,
          error: 'FILE_SIZE_LIMIT_EXCEEDED',
        });
        return;
      case 'LIMIT_FILE_COUNT':
        res.status(400).json({
          success: false,
          message: 'Too many files. Maximum 10 files allowed.',
          error: 'FILE_COUNT_LIMIT_EXCEEDED',
        });
        return;
      case 'LIMIT_UNEXPECTED_FILE':
        res.status(400).json({
          success: false,
          message:
            'Unexpected file field name. Use "images" for machines or "files" for QC entries.',
          error: 'UNEXPECTED_FILE_FIELD',
        });
        return;
      default:
        res.status(400).json({
          success: false,
          message: 'File upload error',
          error: err.message,
        });
        return;
    }
  }

  // Handle Cloudinary file size errors
  if (
    (error as { name?: string; message?: string }).name ===
    'CLOUDINARY_FILE_SIZE_LIMIT'
  ) {
    res.status(400).json({
      success: false,
      message:
        (error as { message?: string }).message ||
        'File size exceeds Cloudinary account limit. Please upgrade your Cloudinary plan or reduce file size.',
      error: 'CLOUDINARY_FILE_SIZE_LIMIT',
    });
    return;
  }

  // Handle other file-related errors
  if (
    typeof (error as { message?: string }).message === 'string' &&
    (error as { message?: string }).message!.includes('Only image files')
  ) {
    res.status(400).json({
      success: false,
      message: (error as { message?: string }).message,
      error: 'INVALID_FILE_TYPE',
    });
    return;
  }

  // Pass other errors to the next error handler
  next(error as Error);
};

// Generic upload for QC approvals
// Use 'raw' for documents to prevent Cloudinary from treating them as images
const upload = multer({
  storage: new CloudinaryStorage('qc-approvals', 'raw'),
  fileFilter: function (_req: Request, file, cb) {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error('Only PDF, DOC, DOCX, JPG, PNG, XLS, XLSX files are allowed'),
      );
    }
  },
  limits: {
    fileSize: MAX_QC_APPROVAL_SIZE, // Configurable from env
  },
});

export {
  uploadMachineImages,
  uploadMachineImagesUpdate,
  uploadMachineFilesUpdate,
  uploadMachineDocuments,
  uploadMachineFiles,
  uploadQAMachineFiles,
  uploadQAMachineFilesUpdate,
  moveFilesToMachineDirectory,
  moveDocumentFilesToMachineDirectory,
  moveQAFilesToEntryDirectory,
  deleteMachineImages,
  deleteMachineDocuments,
  deleteQAFiles,
  cleanupMachineDirectory,
  cleanupQAEntryDirectory,
  handleFileUploadError,
  upload,
  extractCloudinaryUrls,
};
