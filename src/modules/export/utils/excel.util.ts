import ExcelJS from 'exceljs';
import { Response } from 'express';
import path from 'path';
import fs from 'fs/promises';

/**
 * Excel Export Utility
 * Handles Excel file generation with images, hyperlinks, and styling
 */

export interface ExcelColumn {
  header: string;
  key: string;
  width?: number;
  section?: string; // Optional section identifier for color coding
}

export interface ExcelStyle {
  font?: { bold?: boolean; size?: number; color?: { argb: string } };
  fill?: { type: string; pattern: string; fgColor?: { argb: string } };
  alignment?: { horizontal?: string; vertical?: string };
  border?: {
    top?: { style: string; color?: { argb: string } };
    bottom?: { style: string; color?: { argb: string } };
    left?: { style: string; color?: { argb: string } };
    right?: { style: string; color?: { argb: string } };
  };
}

export class ExcelUtil {
  private workbook: ExcelJS.Workbook;
  private worksheet: ExcelJS.Worksheet;

  constructor(sheetName: string = 'Data') {
    this.workbook = new ExcelJS.Workbook();
    this.worksheet = this.workbook.addWorksheet(sheetName);
  }

  /**
   * Add filter and sort summary header to the worksheet
   * This creates a beautiful header section showing applied filters and sorting
   * @param columnCount Optional column count for merging cells (defaults to 20)
   */
  addFilterSortHeader(
    filters: Record<string, unknown>,
    sortBy?: string,
    sortOrder?: string,
    totalRecords?: number,
    columnCount?: number,
  ): number {
    let currentRow = 1;

    // Get column count - use provided count or estimate from worksheet
    const lastCol = columnCount || this.worksheet.columns?.length || 20;

    // Title section with beautiful gradient-like background
    const titleRow = this.worksheet.addRow(['Export Summary']);
    titleRow.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
    titleRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E40AF' }, // Deeper blue
    };
    titleRow.height = 35;
    titleRow.alignment = { horizontal: 'center', vertical: 'middle' };
    titleRow.border = {
      top: { style: 'thin', color: { argb: 'FF1E3A8A' } },
      bottom: { style: 'thin', color: { argb: 'FF1E3A8A' } },
      left: { style: 'thin', color: { argb: 'FF1E3A8A' } },
      right: { style: 'thin', color: { argb: 'FF1E3A8A' } },
    };
    this.worksheet.mergeCells(1, 1, 1, lastCol);
    currentRow++;

    // Info row with export date and total records - styled section
    const infoRow = this.worksheet.addRow([]);
    infoRow.height = 25;

    // Export date cell
    const dateCell = infoRow.getCell(1);
    dateCell.value = `📅 Exported At: ${new Date().toLocaleString()}`;
    dateCell.font = { bold: true, size: 11, color: { argb: 'FF1F2937' } };
    dateCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE5E7EB' },
    };
    dateCell.border = {
      top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    };
    dateCell.alignment = {
      horizontal: 'left',
      vertical: 'middle',
      wrapText: false,
    };

    if (totalRecords !== undefined) {
      const totalCell = infoRow.getCell(Math.floor(lastCol / 2) + 1);
      totalCell.value = `📊 Total Records: ${totalRecords}`;
      totalCell.font = { bold: true, size: 11, color: { argb: 'FF1F2937' } };
      totalCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE5E7EB' },
      };
      totalCell.border = {
        top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      };
      totalCell.alignment = { horizontal: 'right', vertical: 'middle' };
      this.worksheet.mergeCells(
        currentRow,
        Math.floor(lastCol / 2) + 1,
        currentRow,
        lastCol,
      );
    }
    currentRow++;

    // Filters and Sorting section with beautiful styling
    const hasFilters = Object.keys(filters).some(
      (key) =>
        filters[key] !== null &&
        filters[key] !== undefined &&
        filters[key] !== '',
    );

    if (hasFilters || sortBy) {
      // Section header row
      const sectionHeaderRow = this.worksheet.addRow([
        'Filter & Sort Information',
      ]);
      sectionHeaderRow.height = 25;
      sectionHeaderRow.font = {
        bold: true,
        size: 12,
        color: { argb: 'FFFFFFFF' },
      };
      sectionHeaderRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4F46E5' }, // Indigo
      };
      sectionHeaderRow.alignment = { horizontal: 'center', vertical: 'middle' };
      sectionHeaderRow.border = {
        top: { style: 'medium', color: { argb: 'FF4338CA' } },
        bottom: { style: 'medium', color: { argb: 'FF4338CA' } },
        left: { style: 'medium', color: { argb: 'FF4338CA' } },
        right: { style: 'medium', color: { argb: 'FF4338CA' } },
      };
      this.worksheet.mergeCells(currentRow, 1, currentRow, lastCol);
      currentRow++;

      // Filters subsection
      if (hasFilters) {
        const filterRow = this.worksheet.addRow([]);
        filterRow.height = 30;

        const filterLabelCell = this.worksheet.getCell(currentRow, 1);
        filterLabelCell.value = '🔍 Applied Filters:';
        filterLabelCell.font = {
          bold: true,
          size: 11,
          color: { argb: 'FFFFFFFF' },
        };
        filterLabelCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF6366F1' }, // Lighter indigo
        };
        filterLabelCell.border = {
          top: { style: 'thin', color: { argb: 'FF4F46E5' } },
          bottom: { style: 'thin', color: { argb: 'FF4F46E5' } },
          left: { style: 'thin', color: { argb: 'FF4F46E5' } },
          right: { style: 'thin', color: { argb: 'FF4F46E5' } },
        };
        filterLabelCell.alignment = { horizontal: 'left', vertical: 'middle' };
        filterLabelCell.width = 20;

        let filterText = '';
        const filterEntries: string[] = [];
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== null && value !== undefined && value !== '') {
            filterEntries.push(
              `${this.formatFilterKey(key)}: ${this.formatFilterValue(value)}`,
            );
          }
        });
        filterText = filterEntries.join(' | ');

        if (filterText) {
          const filterValueCell = this.worksheet.getCell(currentRow, 2);
          filterValueCell.value = filterText;
          filterValueCell.font = { size: 10, color: { argb: 'FF1F2937' } };
          filterValueCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF9FAFB' },
          };
          filterValueCell.border = {
            top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          };
          filterValueCell.alignment = {
            wrapText: true,
            vertical: 'middle',
            horizontal: 'left',
          };
          // Merge from column 2 to end
          this.worksheet.mergeCells(currentRow, 2, currentRow, lastCol);
        }
        currentRow++;
      }

      // Sorting subsection
      if (sortBy) {
        const sortRow = this.worksheet.addRow([]);
        sortRow.height = 30;

        const sortLabelCell = this.worksheet.getCell(currentRow, 1);
        sortLabelCell.value = '🔄 Sorting:';
        sortLabelCell.font = {
          bold: true,
          size: 11,
          color: { argb: 'FFFFFFFF' },
        };
        sortLabelCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF6366F1' }, // Lighter indigo
        };
        sortLabelCell.border = {
          top: { style: 'thin', color: { argb: 'FF4F46E5' } },
          bottom: { style: 'thin', color: { argb: 'FF4F46E5' } },
          left: { style: 'thin', color: { argb: 'FF4F46E5' } },
          right: { style: 'thin', color: { argb: 'FF4F46E5' } },
        };
        sortLabelCell.alignment = { horizontal: 'left', vertical: 'middle' };
        sortLabelCell.width = 20;

        const sortText = `${this.formatSortKey(sortBy)} (${sortOrder?.toUpperCase() || 'ASC'})`;
        const sortValueCell = this.worksheet.getCell(currentRow, 2);
        sortValueCell.value = sortText;
        sortValueCell.font = { size: 10, color: { argb: 'FF1F2937' } };
        sortValueCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF9FAFB' },
        };
        sortValueCell.border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        };
        sortValueCell.alignment = { horizontal: 'left', vertical: 'middle' };
        // Merge from column 2 to end
        this.worksheet.mergeCells(currentRow, 2, currentRow, lastCol);
        currentRow++;
      }

      // Empty row before data for spacing
      this.worksheet.addRow([]);
      currentRow++;
    }

    return currentRow; // Return the row number where data should start
  }

  /**
   * Define column headers
   * @param headerRowNumber Optional row number to place headers (defaults to 1)
   */
  setColumns(columns: ExcelColumn[], headerRowNumber?: number): void {
    // Set up column structure (keys and widths)
    this.worksheet.columns = columns.map((col) => ({
      header: col.header,
      key: col.key,
      width: col.width || 15,
    }));

    // If headerRowNumber is specified, place headers at that row
    // Otherwise, headers will be at row 1 (default ExcelJS behavior)
    const targetRow = headerRowNumber || 1;
    const headerRow = this.worksheet.getRow(targetRow);

    columns.forEach((col, index) => {
      const cell = headerRow.getCell(index + 1);
      cell.value = col.header;
      cell.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF3B82F6' },
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } },
      };
    });
    headerRow.height = 25;

    // Clear the default header row if we're placing headers elsewhere
    if (headerRowNumber && headerRowNumber > 1) {
      const defaultHeaderRow = this.worksheet.getRow(1);
      // Only clear if it contains header values
      const firstCell = defaultHeaderRow.getCell(1);
      if (
        firstCell.value &&
        typeof firstCell.value === 'string' &&
        columns.some((col) => col.header === firstCell.value)
      ) {
        columns.forEach((_, index) => {
          const cell = defaultHeaderRow.getCell(index + 1);
          if (cell.value) {
            cell.value = null;
            cell.style = {};
          }
        });
      }
    }
  }

  /**
   * Apply header style
   * @param headerRowNumber The row number of the header (defaults to row 1, but can be adjusted if filter header is added)
   */
  styleHeader(headerRowNumber: number = 1): void {
    const headerRow = this.worksheet.getRow(headerRowNumber);
    headerRow.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF3B82F6' },
    };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow.border = {
      top: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'thin', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FF000000' } },
      right: { style: 'thin', color: { argb: 'FF000000' } },
    };
    headerRow.height = 25;
  }

  /**
   * Add data row
   */
  addRow(data: Record<string, unknown>): number {
    const row = this.worksheet.addRow(data);
    row.font = { size: 11 };
    row.alignment = { vertical: 'middle' };
    row.border = {
      bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
    };
    return row.number; // Return the row number
  }

  /**
   * Add hyperlink to cell
   */
  addHyperlink(
    rowNumber: number,
    columnKey: string,
    text: string,
    link: string,
  ): void {
    // Get the row first, then access the cell by key
    const row = this.worksheet.getRow(rowNumber);
    if (!row) {
      console.warn(`Row ${rowNumber} not found`);
      return;
    }

    const cell = row.getCell(columnKey);
    if (!cell) {
      console.warn(`Cell ${columnKey} not found in row ${rowNumber}`);
      return;
    }

    cell.value = { text, hyperlink: link };
    cell.font = { color: { argb: 'FF0563C1' }, underline: true };
  }

  /**
   * Add image to cell
   */
  async addImage(
    rowNumber: number,
    columnKey: string,
    imagePath: string,
    options?: { width?: number; height?: number },
  ): Promise<void> {
    try {
      const imageBuffer = await this.loadImage(imagePath);
      if (!imageBuffer) {
        // Fallback: show image path as text
        const row = this.worksheet.getRow(rowNumber);
        if (row) {
          const cell = row.getCell(columnKey);
          if (cell) {
            cell.value = imagePath;
          }
        }
        return;
      }

      const width = options?.width || 100;
      const height = options?.height || 100;

      const imageId = this.workbook.addImage({
        buffer: imageBuffer,
        extension: this.getImageExtension(imagePath),
      });

      const colIndex = this.worksheet.getColumn(columnKey).number - 1;
      const rowIndex = rowNumber - 1;

      this.worksheet.addImage(imageId, {
        tl: { col: colIndex, row: rowIndex },
        ext: { width, height },
      });

      // Adjust row height
      const row = this.worksheet.getRow(rowNumber);
      row.height = Math.max(row.height || 20, height + 4);

      // Adjust column width
      const column = this.worksheet.getColumn(columnKey);
      column.width = Math.max(column.width || 10, width / 7 + 2);
    } catch (error) {
      console.error(`Error adding image ${imagePath}:`, error);
      // Fallback: show image path as text
      const row = this.worksheet.getRow(rowNumber);
      if (row) {
        const cell = row.getCell(columnKey);
        if (cell) {
          cell.value = imagePath || '-';
        }
      }
    }
  }

  /**
   * Apply status badge style
   */
  applyStatusStyle(rowNumber: number, columnKey: string, status: string): void {
    // Get the row first, then access the cell by key
    const row = this.worksheet.getRow(rowNumber);
    if (!row) {
      console.warn(`Row ${rowNumber} not found`);
      return;
    }

    const cell = row.getCell(columnKey);
    if (!cell) {
      console.warn(`Cell ${columnKey} not found in row ${rowNumber}`);
      return;
    }

    const statusMap: Record<string, { fill: string; text: string }> = {
      approved: { fill: 'FF10B981', text: 'FFFFFFFF' },
      pending: { fill: 'FFF59E0B', text: 'FFFFFFFF' },
      rejected: { fill: 'FFEF4444', text: 'FFFFFFFF' },
      active: { fill: 'FF10B981', text: 'FFFFFFFF' },
      inactive: { fill: 'FF6B7280', text: 'FFFFFFFF' },
    };

    const statusConfig = statusMap[status.toLowerCase()] || {
      fill: 'FFE5E7EB',
      text: 'FF000000',
    };

    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: statusConfig.fill },
    };
    cell.font = { color: { argb: statusConfig.text }, bold: true };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  }

  /**
   * Apply text wrapping to cells for better display of multiple values
   */
  applyTextWrapping(rowNumber: number, columnKeys: string[]): void {
    columnKeys.forEach((key) => {
      const column = this.worksheet.getColumn(key);
      if (column) {
        const cell = this.worksheet.getCell(rowNumber, column.number);
        cell.alignment = {
          ...cell.alignment,
          wrapText: true,
          vertical: 'top',
        };
      }
    });
  }

  /**
   * Freeze header row
   */
  freezeHeader(): void {
    this.worksheet.views = [{ state: 'frozen', ySplit: 1 }];
  }

  /**
   * Auto-size columns
   */
  autoSizeColumns(): void {
    this.worksheet.columns.forEach((column) => {
      if (column.width && column.width < 50) {
        // Only auto-size if not already set to a large width
        let maxLength = 10;
        column.eachCell({ includeEmpty: false }, (cell) => {
          const cellValue = cell.value?.toString() || '';
          maxLength = Math.max(maxLength, cellValue.length);
        });
        column.width = Math.min(maxLength + 2, 50);
      }
    });
  }

  /**
   * Generate and send Excel file
   */
  async generateAndSend(
    res: Response,
    filename: string = 'export.xlsx',
  ): Promise<void> {
    this.freezeHeader();
    this.autoSizeColumns();

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await this.workbook.xlsx.write(res);
    res.end();
  }

  /**
   * Generate Excel buffer
   */
  async generateBuffer(): Promise<Buffer> {
    this.freezeHeader();
    this.autoSizeColumns();
    return (await this.workbook.xlsx.writeBuffer()) as Buffer;
  }

  /**
   * Add export information sheet with filters and sort details
   */
  addExportInfoSheet(
    filters: Record<string, unknown>,
    sortBy?: string,
    sortOrder?: string,
    totalRecords?: number,
  ): void {
    const infoSheet = this.workbook.addWorksheet('Export Info');

    // Title
    const titleRow = infoSheet.addRow(['Export Information']);
    titleRow.font = { bold: true, size: 14, color: { argb: 'FF3B82F6' } };
    titleRow.height = 25;
    infoSheet.mergeCells('A1:B1');

    infoSheet.addRow([]); // Empty row

    // Export Date
    const exportDateRow = infoSheet.addRow([
      'Exported At:',
      new Date().toLocaleString(),
    ]);
    exportDateRow.getCell(1).font = { bold: true };

    // Total Records
    if (totalRecords !== undefined) {
      const totalRow = infoSheet.addRow([
        'Total Records Exported:',
        totalRecords.toString(),
      ]);
      totalRow.getCell(1).font = { bold: true };
    }

    infoSheet.addRow([]); // Empty row

    // Filters Section
    const hasFilters = Object.keys(filters).some(
      (key) =>
        filters[key] !== null &&
        filters[key] !== undefined &&
        filters[key] !== '',
    );

    if (hasFilters) {
      const filterTitleRow = infoSheet.addRow(['Applied Filters']);
      filterTitleRow.font = {
        bold: true,
        size: 12,
        color: { argb: 'FF374151' },
      };
      filterTitleRow.height = 20;
      infoSheet.mergeCells(
        `A${filterTitleRow.number}:B${filterTitleRow.number}`,
      );

      Object.entries(filters).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          const filterRow = infoSheet.addRow([
            this.formatFilterKey(key),
            this.formatFilterValue(value),
          ]);
          filterRow.getCell(1).font = { bold: true };
        }
      });
    } else {
      const noFiltersRow = infoSheet.addRow(['Applied Filters: None']);
      noFiltersRow.font = { italic: true, color: { argb: 'FF6B7280' } };
      infoSheet.mergeCells(`A${noFiltersRow.number}:B${noFiltersRow.number}`);
    }

    infoSheet.addRow([]); // Empty row

    // Sorting Section
    if (sortBy) {
      const sortTitleRow = infoSheet.addRow(['Sorting']);
      sortTitleRow.font = { bold: true, size: 12, color: { argb: 'FF374151' } };
      sortTitleRow.height = 20;
      infoSheet.mergeCells(`A${sortTitleRow.number}:B${sortTitleRow.number}`);

      const sortByRow = infoSheet.addRow([
        'Sort By:',
        this.formatSortKey(sortBy),
      ]);
      sortByRow.getCell(1).font = { bold: true };

      if (sortOrder) {
        const sortOrderRow = infoSheet.addRow([
          'Sort Order:',
          sortOrder.toUpperCase(),
        ]);
        sortOrderRow.getCell(1).font = { bold: true };
      }
    } else {
      const noSortRow = infoSheet.addRow([
        'Sorting: Default (by creation date)',
      ]);
      noSortRow.font = { italic: true, color: { argb: 'FF6B7280' } };
      infoSheet.mergeCells(`A${noSortRow.number}:B${noSortRow.number}`);
    }

    infoSheet.addRow([]); // Empty row

    // Note
    const noteRow = infoSheet.addRow([
      'Note:',
      'This export includes ALL records matching the applied filters, not just the current page.',
    ]);
    noteRow.getCell(1).font = { bold: true, italic: true };
    noteRow.getCell(2).font = { italic: true, color: { argb: 'FF6B7280' } };
    infoSheet.mergeCells(`A${noteRow.number}:B${noteRow.number}`);

    // Auto-size columns
    infoSheet.columns = [{ width: 25 }, { width: 40 }];
  }

  /**
   * Format filter key for display
   */
  private formatFilterKey(key: string): string {
    const keyMap: Record<string, string> = {
      search: 'Search Term',
      role: 'Role',
      department: 'Department',
      isApproved: 'Approval Status',
      status: 'Status',
      category_id: 'Category',
      is_approved: 'Approval Status',
      has_sequence: 'Has Sequence',
      metadata_key: 'Metadata Key',
      metadata_value: 'Metadata Value',
      dispatch_date_from: 'Dispatch Date From',
      dispatch_date_to: 'Dispatch Date To',
      party_name: 'Party Name',
      machine_sequence: 'Machine Sequence',
      location: 'Location',
      mobile_number: 'Mobile Number',
      dateFrom: 'Date From',
      dateTo: 'Date To',
      approvalType: 'Approval Type',
      requestedBy: 'Requested By',
      createdBy: 'Created By',
      machineName: 'Machine Name',
      level: 'Category Level',
      includeInactive: 'Include Inactive',
      resource: 'Resource',
      action: 'Action',
    };
    return (
      keyMap[key] ||
      key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
    );
  }

  /**
   * Format filter value for display
   */
  private formatFilterValue(value: unknown): string {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (value instanceof Date) return value.toLocaleString();
    return String(value);
  }

  /**
   * Format sort key for display
   */
  private formatSortKey(key: string): string {
    const keyMap: Record<string, string> = {
      createdAt: 'Created Date',
      updatedAt: 'Updated Date',
      username: 'Username',
      email: 'Email',
      name: 'Name',
      category: 'Category',
      dispatch_date: 'Dispatch Date',
      party_name: 'Party Name',
      machine_sequence: 'Machine Sequence',
      location: 'Location',
      mobile_number: 'Mobile Number',
      created_by: 'Created By',
      resource: 'Resource',
      action: 'Action',
    };
    return (
      keyMap[key] ||
      key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
    );
  }

  /**
   * Load image from path or URL
   */
  private async loadImage(imagePath: string): Promise<Buffer | null> {
    try {
      // Check if it's a URL
      if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
        const response = await fetch(imagePath);
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          return Buffer.from(arrayBuffer);
        }
        return null;
      }

      // Check if it's an absolute path
      if (path.isAbsolute(imagePath)) {
        const exists = await fs
          .access(imagePath)
          .then(() => true)
          .catch(() => false);
        if (exists) {
          return await fs.readFile(imagePath);
        }
      }

      // Try relative path from public directory
      const publicPath = path.join(process.cwd(), 'public', imagePath);
      const exists = await fs
        .access(publicPath)
        .then(() => true)
        .catch(() => false);
      if (exists) {
        return await fs.readFile(publicPath);
      }

      // Try uploads directory
      const uploadsPath = path.join(
        process.cwd(),
        'public',
        'uploads',
        imagePath,
      );
      const uploadsExists = await fs
        .access(uploadsPath)
        .then(() => true)
        .catch(() => false);
      if (uploadsExists) {
        return await fs.readFile(uploadsPath);
      }

      return null;
    } catch (error) {
      console.error(`Error loading image ${imagePath}:`, error);
      return null;
    }
  }

  /**
   * Get image extension from path
   */
  private getImageExtension(imagePath: string): 'png' | 'jpeg' | 'gif' {
    const ext = path.extname(imagePath).toLowerCase();
    if (ext === '.png') return 'png';
    if (ext === '.jpg' || ext === '.jpeg') return 'jpeg';
    if (ext === '.gif') return 'gif';
    return 'png'; // default
  }
}
