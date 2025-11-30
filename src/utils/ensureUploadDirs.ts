/**
 * Utility to ensure all upload directories exist on startup
 * This is critical for cloud deployments where directories may not exist
 */
import fs from 'fs';
import path from 'path';

const ensureDirectoryExists = (dirPath: string): void => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`✅ Created directory: ${dirPath}`);
  }
};

/**
 * Initialize all required upload directories
 */
export const ensureUploadDirectories = (): void => {
  const baseDir = path.join(process.cwd(), 'public');

  // Base directories
  const directories = [
    // Machine uploads
    path.join(baseDir, 'uploads', 'machines'),
    path.join(baseDir, 'uploads', 'machines', 'temp'),
    path.join(baseDir, 'uploads', 'machines', 'documents'),
    path.join(baseDir, 'uploads', 'machines', 'documents', 'temp'),

    // QA Machine uploads
    path.join(baseDir, 'uploads', 'qa-machines'),
    path.join(baseDir, 'uploads', 'qa-machines', 'temp'),

    // QC Machine uploads
    path.join(baseDir, 'uploads', 'qc-machines'),
    path.join(baseDir, 'uploads', 'qc-machines', 'temp'),
  ];

  directories.forEach((dir) => {
    ensureDirectoryExists(dir);
  });

  console.log('✅ All upload directories initialized');
};
