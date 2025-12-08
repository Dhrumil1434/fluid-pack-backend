import { Router } from 'express';
import { verifyJWT } from '../middlewares/auth.middleware';
import { AuthRole } from '../middlewares/auth-role.middleware';
import ExportController from '../modules/export/export.controller';

const router = Router();

/**
 * Export Routes
 * All routes require admin authentication
 */

// Export to Excel - GET /api/admin/export/:pageId/excel
router.get(
  '/:pageId/excel',
  verifyJWT,
  AuthRole('admin'),
  ExportController.exportToExcel,
);

// Export individual record to PDF - GET /api/admin/export/:pageId/:recordId/pdf
router.get(
  '/:pageId/:recordId/pdf',
  verifyJWT,
  AuthRole('admin'),
  ExportController.exportToPdf,
);

export default router;
