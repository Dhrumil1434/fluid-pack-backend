import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request, Response, NextFunction } from 'express';
import { FileFilterCallback } from 'multer';
import { v4 as uuidv4 } from 'uuid';

// Create directory if it doesn't exist
const ensureDirectoryExists = (dirPath: string): void => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

// Set storage engine for machine images
const machineStorage = multer.diskStorage({
  destination: function (_req: Request, _file, cb) {
    // Create machine-specific directory structure
    const baseDir = './public/uploads/machines';
    const tempDir = path.join(baseDir, 'temp');

    ensureDirectoryExists(tempDir);
    cb(null, tempDir);
  },
  filename: function (_req: Request, file, cb) {
    // Generate unique filename with timestamp and UUID
    const uniqueSuffix = `${Date.now()}-${uuidv4()}`;
    const extension = path.extname(file.originalname);
    const filename = `machine-${uniqueSuffix}${extension}`;
    cb(null, filename);
  },
});

// Set storage engine for machine documents
const machineDocumentStorage = multer.diskStorage({
  destination: function (_req: Request, _file, cb) {
    // Create document-specific directory structure
    const baseDir = './public/uploads/machines/documents';
    const tempDir = path.join(baseDir, 'temp');

    ensureDirectoryExists(tempDir);
    cb(null, tempDir);
  },
  filename: function (_req: Request, file, cb) {
    // Generate unique filename with timestamp and UUID
    const uniqueSuffix = `${Date.now()}-${uuidv4()}`;
    const extension = path.extname(file.originalname);
    const filename = `document-${uniqueSuffix}${extension}`;
    cb(null, filename);
  },
});

// Set storage engine for updating machine images (when machine ID is known)
const machineUpdateStorage = multer.diskStorage({
  destination: function (req: Request, _file, cb) {
    const machineId = req.params['id'];
    if (!machineId) {
      return cb(new Error('Machine ID is required'), '');
    }
    const baseDir = './public/uploads/machines';
    const machineDir = path.join(baseDir, machineId);

    ensureDirectoryExists(machineDir);
    cb(null, machineDir);
  },
  filename: function (_req: Request, file, cb) {
    const uniqueSuffix = `${Date.now()}-${uuidv4()}`;
    const extension = path.extname(file.originalname);
    const filename = `machine-image-${uniqueSuffix}${extension}`;
    cb(null, filename);
  },
});

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

// Upload configuration for creating new machines
const uploadMachineImages = multer({
  storage: machineStorage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB per file
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
    fileSize: 20 * 1024 * 1024, // 20MB max file size for documents
    files: 10, // Maximum 10 document files
  },
  fileFilter: (_req, file, cb) => {
    checkDocumentType(file, cb);
  },
});

// Combined upload configuration for machine creation (images + documents)
const uploadMachineFiles = multer({
  storage: machineStorage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB per file
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
const uploadMachineImagesUpdate = multer({
  storage: machineUpdateStorage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB per file
    files: 5, // Maximum 5 files
  },
  fileFilter: (_req, file, cb) => {
    checkFileType(file, cb);
  },
});

// Utility function to move files from temp to machine-specific directory
const moveFilesToMachineDirectory = async (
  files: Express.Multer.File[],
  machineId: string,
): Promise<string[]> => {
  const baseDir = './public/uploads/machines';
  const machineDir = path.join(baseDir, machineId);
  const imagePaths: string[] = [];

  ensureDirectoryExists(machineDir);

  for (const file of files) {
    const oldPath = file.path;
    const newPath = path.join(machineDir, file.filename);

    try {
      // Move file from temp to machine directory
      fs.renameSync(oldPath, newPath);

      // Store relative path for database
      const relativePath = `/uploads/machines/${machineId}/${file.filename}`;
      imagePaths.push(relativePath);
    } catch (error) {
      console.error(`Error moving file ${file.filename}:`, error);
      // Clean up file if move failed
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }
  }

  return imagePaths;
};

// Utility function to move document files from temp to machine-specific directory
const moveDocumentFilesToMachineDirectory = async (
  files: Express.Multer.File[],
  machineId: string,
): Promise<string[]> => {
  const baseDir = './public/uploads/machines';
  const machineDir = path.join(baseDir, machineId);
  const documentPaths: string[] = [];

  ensureDirectoryExists(machineDir);

  for (const file of files) {
    const oldPath = file.path;
    const newPath = path.join(machineDir, file.filename);

    try {
      // Move file from temp to machine directory
      fs.renameSync(oldPath, newPath);

      // Store relative path for database
      const relativePath = `/uploads/machines/${machineId}/${file.filename}`;
      documentPaths.push(relativePath);
    } catch (error) {
      console.error(`Error moving document file ${file.filename}:`, error);
      // Clean up file if move failed
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }
  }

  return documentPaths;
};

// Utility function to delete machine images
const deleteMachineImages = (imagePaths: string[]): void => {
  imagePaths.forEach((imagePath) => {
    const fullPath = path.join('./public', imagePath);
    if (fs.existsSync(fullPath)) {
      try {
        fs.unlinkSync(fullPath);
      } catch (error) {
        console.error(`Error deleting file ${fullPath}:`, error);
      }
    }
  });
};

// Utility function to clean up machine directory
const cleanupMachineDirectory = (machineId: string): void => {
  const machineDir = path.join('./public/uploads/machines', machineId);
  if (fs.existsSync(machineDir)) {
    try {
      fs.rmSync(machineDir, { recursive: true, force: true });
    } catch (error) {
      console.error(
        `Error cleaning up machine directory ${machineDir}:`,
        error,
      );
    }
  }
};

// Set storage engine for QA machine files
const qaMachineStorage = multer.diskStorage({
  destination: function (_req: Request, _file, cb) {
    // Create QA-specific directory structure
    const baseDir = './public/uploads/qa-machines';
    const tempDir = path.join(baseDir, 'temp');

    ensureDirectoryExists(tempDir);
    cb(null, tempDir);
  },
  filename: function (_req: Request, file, cb) {
    // Generate unique filename with timestamp and UUID
    const uniqueSuffix = `${Date.now()}-${uuidv4()}`;
    const extension = path.extname(file.originalname);
    const filename = `qa-file-${uniqueSuffix}${extension}`;
    cb(null, filename);
  },
});

// Set storage engine for updating QA machine files (when QA entry ID is known)
const qaMachineUpdateStorage = multer.diskStorage({
  destination: function (req: Request, _file, cb) {
    const qaEntryId = req.params['id'];
    if (!qaEntryId) {
      return cb(new Error('QA Entry ID is required'), '');
    }
    const baseDir = './public/uploads/qa-machines';
    const qaEntryDir = path.join(baseDir, qaEntryId);

    ensureDirectoryExists(qaEntryDir);
    cb(null, qaEntryDir);
  },
  filename: function (_req: Request, file, cb) {
    const uniqueSuffix = `${Date.now()}-${uuidv4()}`;
    const extension = path.extname(file.originalname);
    const filename = `qa-file-${uniqueSuffix}${extension}`;
    cb(null, filename);
  },
});

// Check file type for QA documents (allow more file types)
const checkQADocumentType = (
  file: Express.Multer.File,
  cb: FileFilterCallback,
): void => {
  // Allowed file extensions for QA documents
  const filetypes = /jpeg|jpg|png|gif|webp|pdf|doc|docx|xls|xlsx|txt|csv/;

  // Check file extension
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

  // Check MIME type
  const mimetype = filetypes.test(file.mimetype);

  if (mimetype && extname) {
    cb(null, true);
  } else {
    cb(
      new Error(
        'Error: Only image files (JPEG, JPG, PNG, GIF, WebP) and document files (PDF, DOC, DOCX, XLS, XLSX, TXT, CSV) are allowed!',
      ),
    );
  }
};

// Upload configuration for creating new QC machine entries
const uploadQAMachineFiles = multer({
  storage: qaMachineStorage,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB per file (larger for documents)
    files: 10, // Maximum 10 files
  },
  fileFilter: (_req, file, cb) => {
    checkQADocumentType(file, cb);
  },
});

// Upload configuration for updating existing QC machine entries
const uploadQAMachineFilesUpdate = multer({
  storage: qaMachineUpdateStorage,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB per file
    files: 10, // Maximum 10 files
  },
  fileFilter: (_req, file, cb) => {
    checkQADocumentType(file, cb);
  },
});

// Utility function to move QC files from temp to QC entry-specific directory
const moveQAFilesToEntryDirectory = async (
  files: Express.Multer.File[],
  qaEntryId: string,
): Promise<string[]> => {
  const baseDir = './public/uploads/qc-machines';
  const qaEntryDir = path.join(baseDir, qaEntryId);
  const filePaths: string[] = [];

  ensureDirectoryExists(qaEntryDir);

  for (const file of files) {
    const oldPath = file.path;
    const newPath = path.join(qaEntryDir, file.filename);

    try {
      // Move file from temp to QC entry directory
      fs.renameSync(oldPath, newPath);

      // Store relative path for database
      const relativePath = `/uploads/qc-machines/${qaEntryId}/${file.filename}`;
      filePaths.push(relativePath);
    } catch (error) {
      console.error(`Error moving QC file ${file.filename}:`, error);
      // Clean up file if move failed
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }
  }

  return filePaths;
};

// Utility function to delete QC files
const deleteQAFiles = (filePaths: string[]): void => {
  filePaths.forEach((filePath) => {
    const fullPath = path.join('./public', filePath);
    if (fs.existsSync(fullPath)) {
      try {
        fs.unlinkSync(fullPath);
      } catch (error) {
        console.error(`Error deleting QC file ${fullPath}:`, error);
      }
    }
  });
};

// Utility function to clean up QC entry directory
const cleanupQAEntryDirectory = (qaEntryId: string): void => {
  const qaEntryDir = path.join('./public/uploads/qc-machines', qaEntryId);
  if (fs.existsSync(qaEntryDir)) {
    try {
      fs.rmSync(qaEntryDir, { recursive: true, force: true });
    } catch (error) {
      console.error(
        `Error cleaning up QC entry directory ${qaEntryDir}:`,
        error,
      );
    }
  }
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
  if (req.files && Array.isArray(req.files)) {
    const filePaths = (req.files as Express.Multer.File[]).map(
      (file) => file.path,
    );

    // Determine which cleanup function to use based on the route
    if (req.path.includes('/qc-machines')) {
      deleteQAFiles(filePaths);
    } else if (req.path.includes('/machines')) {
      deleteMachineImages(filePaths);
    }
  }

  // Handle multer-specific errors
  if (err instanceof multer.MulterError) {
    switch (err.code) {
      case 'LIMIT_FILE_SIZE':
        res.status(400).json({
          success: false,
          message:
            'File too large. Maximum file size is 20MB for QC files and 50MB for machine images.',
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
const upload = multer({
  storage: multer.diskStorage({
    destination: function (_req: Request, _file, cb) {
      const baseDir = './public/uploads/qc-approvals';
      ensureDirectoryExists(baseDir);
      cb(null, baseDir);
    },
    filename: function (_req: Request, file, cb) {
      const uniqueSuffix = uuidv4();
      const ext = path.extname(file.originalname);
      cb(null, `${uniqueSuffix}${ext}`);
    },
  }),
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
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

export {
  uploadMachineImages,
  uploadMachineImagesUpdate,
  uploadMachineDocuments,
  uploadMachineFiles,
  uploadQAMachineFiles,
  uploadQAMachineFilesUpdate,
  moveFilesToMachineDirectory,
  moveDocumentFilesToMachineDirectory,
  moveQAFilesToEntryDirectory,
  deleteMachineImages,
  deleteQAFiles,
  cleanupMachineDirectory,
  cleanupQAEntryDirectory,
  handleFileUploadError,
  upload,
};
