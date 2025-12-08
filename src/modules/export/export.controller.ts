import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ExportService } from './services/export.service';
import { ApiError } from '../../utils/ApiError';
import { StatusCodes } from 'http-status-codes';

/**
 * Export Controller
 * Handles export requests for admin dashboard pages
 */

interface AuthenticatedRequest extends Request {
  user?: {
    _id: string;
    username: string;
    email: string;
    role: string;
  };
}

class ExportController {
  /**
   * Export data to Excel
   * GET /api/admin/export/:pageId/excel
   */
  static exportToExcel = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { pageId } = req.params;
      const filters = req.query;

      switch (pageId) {
        case 'user_management':
          await ExportService.exportUsersToExcel(res, filters);
          break;
        case 'machine_management':
          await ExportService.exportMachinesToExcel(res, filters);
          break;
        case 'category_management':
          await ExportService.exportCategoriesToExcel(res, filters);
          break;
        case 'qc_entries':
          await ExportService.exportQCEntriesToExcel(res, filters);
          break;
        case 'machine_approvals':
          await ExportService.exportMachineApprovalsToExcel(res, filters);
          break;
        case 'role_management':
          await ExportService.exportRolesToExcel(res, filters);
          break;
        case 'permission_management':
          await ExportService.exportPermissionsToExcel(res, filters);
          break;
        case 'sequence_management':
          await ExportService.exportSequenceConfigsToExcel(res, filters);
          break;
        case 'approval_management':
          // Check which tab to export
          if (filters.tab === 'users') {
            await ExportService.exportUserApprovalsToExcel(res, filters);
          } else if (filters.tab === 'machines') {
            await ExportService.exportMachineApprovalsForApprovalPageToExcel(
              res,
              filters,
            );
          } else {
            // Default to users tab
            await ExportService.exportUserApprovalsToExcel(res, filters);
          }
          break;
        default:
          throw new ApiError(
            'EXPORT_EXCEL',
            StatusCodes.BAD_REQUEST,
            'INVALID_PAGE_ID',
            `Export not supported for page: ${pageId}`,
          );
      }
    },
  );

  /**
   * Export individual record to PDF
   * GET /api/admin/export/:pageId/:recordId/pdf
   */
  static exportToPdf = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { pageId, recordId } = req.params;

      switch (pageId) {
        case 'user_management':
          await ExportService.exportUserToPdf(res, recordId);
          break;
        case 'machine_management':
          await ExportService.exportMachineToPdf(res, recordId);
          break;
        case 'machine_approvals':
          await ExportService.exportMachineApprovalToPdf(res, recordId);
          break;
        case 'category_management':
          await ExportService.exportCategoryToPdf(res, recordId);
          break;
        case 'qc_entries':
          await ExportService.exportQCEntryToPdf(res, recordId);
          break;
        case 'permission_management':
          await ExportService.exportPermissionToPdf(res, recordId);
          break;
        case 'sequence_management':
          await ExportService.exportSequenceConfigToPdf(res, recordId);
          break;
        default:
          throw new ApiError(
            'EXPORT_PDF',
            StatusCodes.BAD_REQUEST,
            'INVALID_PAGE_ID',
            `PDF export not supported for page: ${pageId}`,
          );
      }
    },
  );
}

export default ExportController;
