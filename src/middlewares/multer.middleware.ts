import multer from 'multer';
import path from 'path';
import { FileFilterCallback } from 'multer';

// Set storage engine
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './public/temp');
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});

// Initialize upload
const upload = multer({
  storage: storage,
  limits: { fileSize: 5000000 }, // Limit file size to 5MB
  fileFilter: (req, file, cb) => {
    checkFileType(file, cb);
  },
});

// Check file type
const checkFileType = (
  file: Express.Multer.File,
  cb: FileFilterCallback,
): void => {
  // Allowed file extensions
  const filetypes = /jpeg|jpg|png|gif/;

  // Check file extension
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

  // Check MIME type
  const mimetype = filetypes.test(file.mimetype);

  if (mimetype && extname) {
    // Accept the file
    cb(null, true);
  } else {
    // Reject the file with an error message
    cb(new Error('Error: Images Only!'));
  }
};
export { upload };
