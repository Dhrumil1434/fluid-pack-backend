// multer.middleware.ts
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request } from 'express';
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
  destination: function (req: Request, file, cb) {
    // Create machine-specific directory structure
    const baseDir = './public/uploads/machines';
    const tempDir = path.join(baseDir, 'temp');

    ensureDirectoryExists(tempDir);
    cb(null, tempDir);
  },
  filename: function (req: Request, file, cb) {
    // Generate unique filename with timestamp and UUID
    const uniqueSuffix = `${Date.now()}-${uuidv4()}`;
    const extension = path.extname(file.originalname);
    const filename = `machine-${uniqueSuffix}${extension}`;
    cb(null, filename);
  },
});

// Set storage engine for updating machine images (when machine ID is known)
const machineUpdateStorage = multer.diskStorage({
  destination: function (req: Request, file, cb) {
    const machineId = req.params['id'];
    if (!machineId) {
      return cb(new Error('Machine ID is required'), '');
    }
    const baseDir = './public/uploads/machines';
    const machineDir = path.join(baseDir, machineId);

    ensureDirectoryExists(machineDir);
    cb(null, machineDir);
  },
  filename: function (req: Request, file, cb) {
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

// Upload configuration for creating new machines
const uploadMachineImages = multer({
  storage: machineStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 5, // Maximum 5 files
  },
  fileFilter: (req, file, cb) => {
    checkFileType(file, cb);
  },
});

// Upload configuration for updating existing machines
const uploadMachineImagesUpdate = multer({
  storage: machineUpdateStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 5, // Maximum 5 files
  },
  fileFilter: (req, file, cb) => {
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

export {
  uploadMachineImages,
  uploadMachineImagesUpdate,
  moveFilesToMachineDirectory,
  deleteMachineImages,
  cleanupMachineDirectory,
};
