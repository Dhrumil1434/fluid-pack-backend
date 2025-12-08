import PdfPrinter from 'pdfmake';
import { Response } from 'express';
import path from 'path';
import fs from 'fs/promises';
import { TDocumentDefinitions } from 'pdfmake/interfaces';
import { existsSync } from 'fs';

/**
 * PDF Export Utility
 * Handles PDF file generation with images, links, and styling
 */

export interface PdfStyle {
  header?: Record<string, unknown>;
  subheader?: Record<string, unknown>;
  label?: Record<string, unknown>;
  value?: Record<string, unknown>;
  tableHeader?: Record<string, unknown>;
  tableCell?: Record<string, unknown>;
  statusApproved?: Record<string, unknown>;
  statusPending?: Record<string, unknown>;
  statusRejected?: Record<string, unknown>;
}

export class PdfUtil {
  private fonts: Record<string, unknown>;
  private printer: PdfPrinter;
  private images: Record<string, string> = {};

  constructor() {
    // Use custom fonts from src/fonts directory
    // pdfmake does NOT ship fonts for Node.js backend - we must provide them
    const fontsDir = path.join(process.cwd(), 'src', 'fonts');

    // Define font paths
    const fontPaths = {
      normal: path.join(fontsDir, 'Roboto-Regular.ttf'),
      bold: path.join(fontsDir, 'Roboto-Bold.ttf'),
      italics: path.join(fontsDir, 'Roboto-Italic.ttf'),
      bolditalics: path.join(fontsDir, 'Roboto-Medium.ttf'),
    };

    // Verify fonts exist
    const missingFonts: string[] = [];
    Object.entries(fontPaths).forEach(([key, fontPath]) => {
      if (!existsSync(fontPath)) {
        missingFonts.push(`${key}: ${fontPath}`);
      }
    });

    if (missingFonts.length > 0) {
      console.error(
        '❌ Missing PDF fonts. Please download Roboto fonts to src/fonts/',
      );
      console.error('Missing fonts:', missingFonts);
      console.error('Download from: https://fonts.google.com/specimen/Roboto');
      throw new Error(
        `PDF fonts not found. Please download Roboto fonts to ${fontsDir}. See src/fonts/README.md for instructions.`,
      );
    }

    this.fonts = {
      Roboto: {
        normal: fontPaths.normal,
        bold: fontPaths.bold,
        italics: fontPaths.italics,
        bolditalics: fontPaths.bolditalics,
      },
    };

    this.printer = new PdfPrinter(this.fonts);
    console.log('✅ PDF fonts loaded successfully');
  }

  /**
   * Get default styles
   */
  getDefaultStyles(): PdfStyle {
    return {
      header: {
        fontSize: 24,
        bold: true,
        color: '#1E40AF',
        margin: [0, 0, 0, 20],
      },
      subheader: {
        fontSize: 16,
        bold: true,
        color: '#374151',
        margin: [0, 10, 0, 10],
      },
      label: {
        fontSize: 11,
        bold: true,
        color: '#6B7280',
        margin: [0, 5, 0, 2],
      },
      value: {
        fontSize: 12,
        color: '#111827',
        margin: [0, 0, 0, 10],
      },
      tableHeader: {
        bold: true,
        fontSize: 11,
        color: '#FFFFFF',
        fillColor: '#3B82F6',
        alignment: 'center',
      },
      tableCell: {
        fontSize: 10,
        color: '#111827',
      },
      statusApproved: {
        color: '#FFFFFF',
        fillColor: '#10B981',
        bold: true,
      },
      statusPending: {
        color: '#FFFFFF',
        fillColor: '#F59E0B',
        bold: true,
      },
      statusRejected: {
        color: '#FFFFFF',
        fillColor: '#EF4444',
        bold: true,
      },
    };
  }

  /**
   * Load image and convert to base64
   */
  async loadImage(imagePath: string): Promise<string | null> {
    try {
      // Check if already loaded
      if (this.images[imagePath]) {
        return this.images[imagePath];
      }

      let imageBuffer: Buffer | null = null;

      // Check if it's a URL
      if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
        const response = await fetch(imagePath);
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          imageBuffer = Buffer.from(arrayBuffer);
        }
      } else {
        // Try absolute path
        if (path.isAbsolute(imagePath)) {
          const exists = await fs
            .access(imagePath)
            .then(() => true)
            .catch(() => false);
          if (exists) {
            imageBuffer = await fs.readFile(imagePath);
          }
        }

        // Try relative path from public directory
        if (!imageBuffer) {
          const publicPath = path.join(process.cwd(), 'public', imagePath);
          const exists = await fs
            .access(publicPath)
            .then(() => true)
            .catch(() => false);
          if (exists) {
            imageBuffer = await fs.readFile(publicPath);
          }
        }

        // Try uploads directory
        if (!imageBuffer) {
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
            imageBuffer = await fs.readFile(uploadsPath);
          }
        }
      }

      if (imageBuffer) {
        const base64 = imageBuffer.toString('base64');
        const ext = path.extname(imagePath).toLowerCase();
        const mimeType =
          ext === '.png'
            ? 'image/png'
            : ext === '.jpg' || ext === '.jpeg'
              ? 'image/jpeg'
              : 'image/png';
        const dataUri = `data:${mimeType};base64,${base64}`;
        this.images[imagePath] = dataUri;
        return dataUri;
      }

      return null;
    } catch (error) {
      console.error(`Error loading image ${imagePath}:`, error);
      return null;
    }
  }

  /**
   * Format status badge
   */
  formatStatusBadge(status: string): Record<string, unknown> {
    const statusMap: Record<string, Record<string, unknown>> = {
      approved: { text: 'Approved', style: 'statusApproved' },
      pending: { text: 'Pending', style: 'statusPending' },
      rejected: { text: 'Rejected', style: 'statusRejected' },
      active: { text: 'Active', style: 'statusApproved' },
      inactive: { text: 'Inactive', style: 'statusPending' },
      allowed: { text: 'Allowed', style: 'statusApproved' },
      requires_approval: { text: 'Requires Approval', style: 'statusPending' },
      denied: { text: 'Denied', style: 'statusRejected' },
    };

    const statusLower = status.toLowerCase();
    const statusConfig = statusMap[statusLower] || {
      text: status,
      style: 'value',
    };

    return {
      text: statusConfig.text,
      style: statusConfig.style,
      margin: [0, 2, 0, 2],
    };
  }

  /**
   * Format date
   */
  formatDate(dateValue: Date | string | null | undefined): string {
    if (!dateValue) return 'N/A';
    const date = new Date(dateValue);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  /**
   * Extract nested value from object
   */
  extractNestedValue(obj: unknown, path: string): string {
    if (!obj || !path) return 'N/A';
    const keys = path.split('.');
    let value = obj;
    for (const key of keys) {
      if (value && typeof value === 'object') {
        value = value[key];
      } else {
        return 'N/A';
      }
    }
    return value?.toString() || 'N/A';
  }

  /**
   * Generate and send PDF
   */
  async generateAndSend(
    res: Response,
    docDefinition: TDocumentDefinitions,
    filename: string = 'export.pdf',
  ): Promise<void> {
    try {
      const pdfDoc = this.printer.createPdfKitDocument(docDefinition);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${filename}"`,
      );

      pdfDoc.pipe(res);
      pdfDoc.end();
    } catch (error) {
      console.error('Error generating PDF:', error);
      throw error;
    }
  }

  /**
   * Generate PDF buffer
   */
  async generateBuffer(docDefinition: TDocumentDefinitions): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const pdfDoc = this.printer.createPdfKitDocument(docDefinition);
        const chunks: Buffer[] = [];

        pdfDoc.on('data', (chunk) => chunks.push(chunk));
        pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
        pdfDoc.on('error', reject);

        pdfDoc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Get images object for pdfmake
   */
  getImages(): Record<string, string> {
    return this.images;
  }

  /**
   * Clear loaded images
   */
  clearImages(): void {
    this.images = {};
  }
}
