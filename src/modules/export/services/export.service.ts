import { ExcelUtil } from '../utils/excel.util';
import { PdfUtil } from '../utils/pdf.util';
import { Response } from 'express';
import ExcelJS from 'exceljs';
import { User } from '../../../models/user.model';
import { Machine } from '../../../models/machine.model';
import { Category } from '../../../models/category.model';
import { Role } from '../../../models/role.model';
import { MachineApproval } from '../../../models/machineApproval.model';
import { QAMachineEntry } from '../../../models/qcMachine.model';
import { QCApproval } from '../../../models/qcApproval.model';
import { PermissionConfig } from '../../../models/permissionConfig.model';
import { SequenceManagement } from '../../../models/category.model';
import path from 'path';
import { TDocumentDefinitions } from 'pdfmake/interfaces';

/**
 * Export Service
 * Handles data fetching and formatting for Excel and PDF exports
 */

export interface ExportFilters {
  [key: string]: unknown;
}

export class ExportService {
  /**
   * Export users to Excel
   */
  static async exportUsersToExcel(
    res: Response,
    filters: ExportFilters = {},
  ): Promise<void> {
    const excel = new ExcelUtil('Users');

    // Define column structure first (for column count)
    const columns = [
      { header: 'User ID', key: '_id', width: 25 },
      { header: 'Username', key: 'username', width: 20 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Role', key: 'role', width: 15 },
      { header: 'Department', key: 'department', width: 20 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Created Date', key: 'createdAt', width: 20 },
      { header: 'Updated Date', key: 'updatedAt', width: 20 },
    ];

    // Add filter/sort header first and get the data start row
    const sortBy = filters.sortBy || 'createdAt';
    const sortOrder = filters.sortOrder || 'desc';
    const dataStartRow = excel.addFilterSortHeader(
      filters,
      sortBy,
      sortOrder,
      undefined,
      columns.length,
    );

    // Define columns with headers at the correct row (after filter header)
    excel.setColumns(columns, dataStartRow);

    // Fetch all users matching filters (no pagination)
    const query: Record<string, unknown> = {};
    if (filters.search) {
      query.$or = [
        { username: { $regex: filters.search, $options: 'i' } },
        { email: { $regex: filters.search, $options: 'i' } },
      ];
    }
    if (filters.role) query.role = filters.role;
    if (filters.department) query.department = filters.department;
    if (typeof filters.isApproved === 'boolean') {
      query.isApproved = filters.isApproved;
    }

    // Apply sorting (already set above)
    const sort: Record<string, number> = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const users = await User.find(query)
      .populate('role', 'name')
      .populate('department', 'name')
      .sort(sort)
      .lean();

    // Add data rows
    for (const user of users) {
      const rowData: Record<string, unknown> = {
        _id: user._id?.toString() || '-',
        username: user.username || '-',
        email: user.email || '-',
        role:
          (user.role as Record<string, unknown>)?.name ||
          (typeof user.role === 'string' ? user.role : '-'),
        department:
          (user.department as Record<string, unknown>)?.name ||
          (typeof user.department === 'string' ? user.department : '-'),
        status: user.isApproved ? 'Approved' : 'Pending',
        createdAt: user.createdAt
          ? new Date(user.createdAt).toLocaleString()
          : '-',
        updatedAt: user.updatedAt
          ? new Date(user.updatedAt).toLocaleString()
          : '-',
      };

      // Add row and get the row number
      const rowNumber = excel.addRow(rowData);

      // Apply status style
      excel.applyStatusStyle(
        rowNumber,
        'status',
        user.isApproved ? 'approved' : 'pending',
      );
    }

    // Add export info sheet with filters and sort
    excel.addExportInfoSheet(
      filters,
      filters.sortBy || 'createdAt',
      filters.sortOrder || 'desc',
      users.length,
    );

    await excel.generateAndSend(
      res,
      `users_export_${new Date().toISOString().split('T')[0]}.xlsx`,
    );
  }

  /**
   * Export users to PDF (individual)
   */
  static async exportUserToPdf(res: Response, userId: string): Promise<void> {
    const pdf = new PdfUtil();
    const styles = pdf.getDefaultStyles();

    const user = await User.findById(userId)
      .populate('role', 'name')
      .populate('department', 'name')
      .lean();

    if (!user) {
      throw new Error('User not found');
    }

    const content: unknown[] = [
      { text: 'User Details', style: 'header' },
      { text: '\n' },
      {
        columns: [
          {
            text: [
              { text: 'Username: ', style: 'label' },
              { text: user.username || 'N/A', style: 'value' },
            ],
          },
        ],
      },
      {
        text: [
          { text: 'Email: ', style: 'label' },
          { text: user.email || 'N/A', style: 'value' },
        ],
      },
      {
        text: [
          { text: 'Role: ', style: 'label' },
          {
            text:
              (user.role as Record<string, unknown>)?.name ||
              (typeof user.role === 'string' ? user.role : 'N/A'),
            style: 'value',
          },
        ],
      },
      {
        text: [
          { text: 'Department: ', style: 'label' },
          {
            text:
              (user.department as Record<string, unknown>)?.name ||
              (typeof user.department === 'string' ? user.department : 'N/A'),
            style: 'value',
          },
        ],
      },
      {
        text: [
          { text: 'Status: ', style: 'label' },
          pdf.formatStatusBadge(user.isApproved ? 'approved' : 'pending'),
        ],
      },
      {
        text: [
          { text: 'Created Date: ', style: 'label' },
          {
            text: pdf.formatDate(user.createdAt),
            style: 'value',
          },
        ],
      },
    ];

    const docDefinition: TDocumentDefinitions = {
      content,
      styles,
      defaultStyle: {
        font: 'Roboto',
      },
    };

    await pdf.generateAndSend(
      res,
      docDefinition,
      `user_${user._id}_${new Date().toISOString().split('T')[0]}.pdf`,
    );
  }

  /**
   * Export machines to Excel
   */
  static async exportMachinesToExcel(
    res: Response,
    filters: ExportFilters = {},
  ): Promise<void> {
    const excel = new ExcelUtil('Machines');

    // Define column structure first (for column count)
    const columns = [
      { header: 'Machine ID', key: '_id', width: 25 },
      { header: 'Name', key: 'name', width: 25 },
      { header: 'Category', key: 'category', width: 20 },
      { header: 'Sequence', key: 'sequence', width: 15 },
      { header: 'Party Name', key: 'party_name', width: 20 },
      { header: 'Location', key: 'location', width: 20 },
      { header: 'Mobile', key: 'mobile', width: 15 },
      { header: 'Dispatch Date', key: 'dispatch_date', width: 15 },
      { header: 'Images', key: 'images', width: 15 },
      { header: 'Documents', key: 'documents', width: 20 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Created By', key: 'created_by', width: 20 },
      { header: 'Created Date', key: 'createdAt', width: 20 },
    ];

    // Add filter/sort header first and get the data start row
    const sortBy = filters.sortBy || 'createdAt';
    const sortOrder = filters.sortOrder || 'desc';
    const dataStartRow = excel.addFilterSortHeader(
      filters,
      sortBy,
      sortOrder,
      undefined,
      columns.length,
    );

    // Define columns with headers at the correct row (after filter header)
    excel.setColumns(columns, dataStartRow);

    // Build query
    const query: Record<string, unknown> = { deletedAt: null };
    if (filters.category_id) query.category_id = filters.category_id;
    if (typeof filters.is_approved === 'boolean') {
      query.is_approved = filters.is_approved;
    }
    if (filters.search) {
      query.$or = [
        { name: { $regex: filters.search, $options: 'i' } },
        { party_name: { $regex: filters.search, $options: 'i' } },
        { location: { $regex: filters.search, $options: 'i' } },
      ];
    }

    const machines = await Machine.find(query)
      .populate('category_id', 'name')
      .populate('created_by', 'username email')
      .sort({ createdAt: -1 })
      .lean();

    // Add data rows
    for (const machine of machines) {
      const rowData: Record<string, unknown> = {
        _id: machine._id?.toString() || '-',
        name: machine.name || '-',
        category: (machine.category_id as Record<string, unknown>)?.name || '-',
        sequence: machine.machine_sequence || '-',
        party_name: machine.party_name || '-',
        location: machine.location || '-',
        mobile: machine.mobile_number || '-',
        dispatch_date: machine.dispatch_date
          ? new Date(machine.dispatch_date).toLocaleDateString()
          : '-',
        images: machine.images?.length
          ? `${machine.images.length} image(s)`
          : '-',
        documents: machine.documents?.length
          ? `${machine.documents.length} document(s)`
          : '-',
        status: machine.is_approved ? 'Approved' : 'Pending',
        created_by:
          (machine.created_by as Record<string, unknown>)?.username || '-',
        createdAt: machine.createdAt
          ? new Date(machine.createdAt).toLocaleString()
          : '-',
      };

      // Add row and get the row number
      const rowNumber = excel.addRow(rowData);

      // Apply status style
      excel.applyStatusStyle(
        rowNumber,
        'status',
        machine.is_approved ? 'approved' : 'pending',
      );

      // Add first image if available
      if (machine.images && machine.images.length > 0) {
        try {
          await excel.addImage(rowNumber, 'images', machine.images[0], {
            width: 100,
            height: 100,
          });
        } catch (error) {
          console.error('Error adding image:', error);
        }
      }

      // Add document hyperlinks
      if (machine.documents && machine.documents.length > 0) {
        const firstDoc = machine.documents[0];
        const docPath = path.isAbsolute(firstDoc.file_path)
          ? firstDoc.file_path
          : path.join(process.cwd(), 'public', firstDoc.file_path);
        excel.addHyperlink(
          rowNumber,
          'documents',
          firstDoc.name || 'Document',
          `file:///${docPath}`,
        );
      }
    }

    // Add export info sheet with filters and sort
    excel.addExportInfoSheet(filters, sortBy, sortOrder, machines.length);

    await excel.generateAndSend(
      res,
      `machines_export_${new Date().toISOString().split('T')[0]}.xlsx`,
    );
  }

  /**
   * Export machine to PDF (individual)
   */
  static async exportMachineToPdf(
    res: Response,
    machineId: string,
  ): Promise<void> {
    const pdf = new PdfUtil();
    const styles = pdf.getDefaultStyles();

    const machine = await Machine.findById(machineId)
      .populate('category_id', 'name description')
      .populate('created_by', 'username email')
      .lean();

    if (!machine) {
      throw new Error('Machine not found');
    }

    const content: unknown[] = [
      { text: 'Machine Details', style: 'header' },
      { text: '\n' },
    ];

    // Basic Information
    content.push({ text: 'Basic Information', style: 'subheader' });
    content.push({
      text: [
        { text: 'Name: ', style: 'label' },
        { text: machine.name || 'N/A', style: 'value' },
      ],
    });
    content.push({
      text: [
        { text: 'Category: ', style: 'label' },
        {
          text: (machine.category_id as Record<string, unknown>)?.name || 'N/A',
          style: 'value',
        },
      ],
    });
    content.push({
      text: [
        { text: 'Machine Sequence: ', style: 'label' },
        { text: machine.machine_sequence || 'N/A', style: 'value' },
      ],
    });
    content.push({
      text: [
        { text: 'Status: ', style: 'label' },
        pdf.formatStatusBadge(machine.is_approved ? 'approved' : 'pending'),
      ],
    });

    // Contact Information
    content.push({ text: '\nContact Information', style: 'subheader' });
    content.push({
      text: [
        { text: 'Party Name: ', style: 'label' },
        { text: machine.party_name || 'N/A', style: 'value' },
      ],
    });
    content.push({
      text: [
        { text: 'Location: ', style: 'label' },
        { text: machine.location || 'N/A', style: 'value' },
      ],
    });
    content.push({
      text: [
        { text: 'Mobile Number: ', style: 'label' },
        { text: machine.mobile_number || 'N/A', style: 'value' },
      ],
    });
    content.push({
      text: [
        { text: 'Dispatch Date: ', style: 'label' },
        {
          text: machine.dispatch_date
            ? pdf.formatDate(machine.dispatch_date)
            : 'N/A',
          style: 'value',
        },
      ],
    });

    // Images
    if (machine.images && machine.images.length > 0) {
      content.push({ text: '\nImages', style: 'subheader' });
      const imageColumns: unknown[] = [];
      for (let i = 0; i < Math.min(machine.images.length, 4); i++) {
        const imagePath = machine.images[i];
        const imageData = await pdf.loadImage(imagePath);
        if (imageData) {
          imageColumns.push({
            image: imageData,
            width: 150,
            height: 150,
            fit: [150, 150],
            margin: [0, 0, 10, 10],
          });
        }
      }
      if (imageColumns.length > 0) {
        content.push({
          columns: imageColumns,
        });
      }
    }

    // Documents
    if (machine.documents && machine.documents.length > 0) {
      content.push({ text: '\nDocuments', style: 'subheader' });
      const docList: unknown[] = [];
      for (const doc of machine.documents) {
        const docPath = path.isAbsolute(doc.file_path)
          ? doc.file_path
          : path.join(process.cwd(), 'public', doc.file_path);
        docList.push({
          text: doc.name || 'Document',
          link: `file:///${docPath}`,
          color: '#3B82F6',
          decoration: 'underline',
          margin: [0, 2, 0, 2],
        });
      }
      content.push({ ul: docList });
    }

    // Metadata
    if (machine.metadata && Object.keys(machine.metadata).length > 0) {
      content.push({ text: '\nMetadata', style: 'subheader' });
      for (const [key, value] of Object.entries(machine.metadata)) {
        content.push({
          text: [
            { text: `${key}: `, style: 'label' },
            { text: String(value), style: 'value' },
          ],
        });
      }
    }

    const docDefinition: TDocumentDefinitions = {
      content,
      styles,
      defaultStyle: {
        font: 'Roboto',
      },
    };

    await pdf.generateAndSend(
      res,
      docDefinition,
      `machine_${machine._id}_${new Date().toISOString().split('T')[0]}.pdf`,
    );
  }

  /**
   * Export categories to Excel
   */
  static async exportCategoriesToExcel(
    res: Response,
    filters: ExportFilters = {},
  ): Promise<void> {
    const excel = new ExcelUtil('Categories');

    // Define column structure first (for column count)
    const columns = [
      { header: 'Category ID', key: '_id', width: 25 },
      { header: 'Name', key: 'name', width: 25 },
      { header: 'Level', key: 'level', width: 10 },
      { header: 'Parent', key: 'parent', width: 20 },
      { header: 'Sort Order', key: 'sort_order', width: 12 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Created By', key: 'created_by', width: 20 },
      { header: 'Created Date', key: 'createdAt', width: 20 },
    ];

    // Add filter/sort header first and get the data start row
    const sortBy = filters.sortBy || 'sort_order';
    const sortOrder = filters.sortOrder || 'asc';
    const dataStartRow = excel.addFilterSortHeader(
      filters,
      sortBy,
      sortOrder,
      undefined,
      columns.length,
    );

    // Define columns with headers at the correct row (after filter header)
    excel.setColumns(columns, dataStartRow);

    const query: Record<string, unknown> = { deletedAt: { $exists: false } };
    if (filters.search) {
      query.$or = [
        { name: { $regex: filters.search, $options: 'i' } },
        { description: { $regex: filters.search, $options: 'i' } },
      ];
    }
    if (filters.level !== undefined) query.level = filters.level;

    // Apply sorting (already set above)
    const sort: Record<string, number> = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const categories = await Category.find(query)
      .populate('createdBy', 'username email')
      .sort(sort)
      .lean();

    for (const category of categories) {
      const rowData: Record<string, unknown> = {
        _id: category._id?.toString() || '-',
        name: category.name || '-',
        level: category.level || 0,
        parent: category.parent_id?.toString() || '-',
        sort_order: category.sort_order || 0,
        status: category.is_active ? 'Active' : 'Inactive',
        created_by:
          (category.createdBy as Record<string, unknown>)?.username || '-',
        createdAt: category.created_at
          ? new Date(category.created_at).toLocaleString()
          : '-',
      };

      const rowNumber = excel.addRow(rowData);
      excel.applyStatusStyle(
        rowNumber,
        'status',
        category.is_active ? 'active' : 'inactive',
      );
    }

    // Add export info sheet with filters and sort
    excel.addExportInfoSheet(filters, sortBy, sortOrder, categories.length);

    await excel.generateAndSend(
      res,
      `categories_export_${new Date().toISOString().split('T')[0]}.xlsx`,
    );
  }

  /**
   * Export category to PDF (individual)
   */
  static async exportCategoryToPdf(
    res: Response,
    categoryId: string,
  ): Promise<void> {
    const pdf = new PdfUtil();
    const styles = pdf.getDefaultStyles();

    const category = await Category.findById(categoryId)
      .populate('parent_id', 'name slug')
      .populate('created_by', 'username email')
      .lean();

    if (!category) {
      throw new Error('Category not found');
    }

    const content: unknown[] = [
      { text: 'Category Details', style: 'header' },
      { text: '\n' },
    ];

    // Basic Information
    content.push({ text: 'Basic Information', style: 'subheader' });
    content.push({
      text: [
        { text: 'Category ID: ', style: 'label' },
        { text: category._id?.toString() || 'N/A', style: 'value' },
      ],
    });
    content.push({
      text: [
        { text: 'Name: ', style: 'label' },
        { text: category.name || 'N/A', style: 'value' },
      ],
    });
    content.push({
      text: [
        { text: 'Slug: ', style: 'label' },
        { text: category.slug || 'N/A', style: 'value' },
      ],
    });
    if (category.description) {
      content.push({
        text: [
          { text: 'Description: ', style: 'label' },
          { text: category.description, style: 'value' },
        ],
      });
    }
    content.push({
      text: [
        { text: 'Level: ', style: 'label' },
        {
          text:
            category.level === 0
              ? 'Main Category'
              : category.level === 1
                ? 'Subcategory'
                : category.level === 2
                  ? 'Sub-subcategory'
                  : `Level ${category.level}`,
          style: 'value',
        },
      ],
    });
    content.push({
      text: [
        { text: 'Parent Category: ', style: 'label' },
        {
          text:
            (category.parent_id as Record<string, unknown>)?.name ||
            'None (Root Category)',
          style: 'value',
        },
      ],
    });
    content.push({
      text: [
        { text: 'Sort Order: ', style: 'label' },
        { text: (category.sort_order || 0).toString(), style: 'value' },
      ],
    });
    content.push({
      text: [
        { text: 'Status: ', style: 'label' },
        pdf.formatStatusBadge(category.is_active ? 'active' : 'inactive'),
      ],
    });

    // SEO Information
    if (category.seo_title || category.seo_description) {
      content.push({ text: '\nSEO Information', style: 'subheader' });
      if (category.seo_title) {
        content.push({
          text: [
            { text: 'SEO Title: ', style: 'label' },
            { text: category.seo_title, style: 'value' },
          ],
        });
      }
      if (category.seo_description) {
        content.push({
          text: [
            { text: 'SEO Description: ', style: 'label' },
            { text: category.seo_description, style: 'value' },
          ],
        });
      }
    }

    // Image
    if (category.image_url) {
      content.push({ text: '\nCategory Image', style: 'subheader' });
      try {
        const imageData = await pdf.loadImage(category.image_url);
        content.push({
          image: imageData,
          width: 200,
          margin: [0, 5, 0, 10],
        });
      } catch {
        content.push({
          text: [
            { text: 'Image URL: ', style: 'label' },
            { text: category.image_url, style: 'value' },
          ],
        });
      }
    }

    // Metadata
    content.push({ text: '\nMetadata', style: 'subheader' });
    content.push({
      text: [
        { text: 'Created By: ', style: 'label' },
        {
          text:
            (category.created_by as Record<string, unknown>)?.username || 'N/A',
          style: 'value',
        },
      ],
    });
    content.push({
      text: [
        { text: 'Created Date: ', style: 'label' },
        {
          text: pdf.formatDate(category.created_at),
          style: 'value',
        },
      ],
    });
    if (category.updated_at) {
      content.push({
        text: [
          { text: 'Updated Date: ', style: 'label' },
          {
            text: pdf.formatDate(category.updated_at),
            style: 'value',
          },
        ],
      });
    }

    const docDefinition: TDocumentDefinitions = {
      content,
      styles,
      defaultStyle: {
        font: 'Roboto',
      },
    };

    await pdf.generateAndSend(
      res,
      docDefinition,
      `category_${category._id}_${new Date().toISOString().split('T')[0]}.pdf`,
    );
  }

  /**
   * Export roles to Excel
   */
  static async exportRolesToExcel(
    res: Response,
    filters: ExportFilters = {},
  ): Promise<void> {
    const excel = new ExcelUtil('Roles');

    // Define column structure first (for column count)
    const columns = [
      { header: 'Role ID', key: '_id', width: 25 },
      { header: 'Name', key: 'name', width: 25 },
      { header: 'Description', key: 'description', width: 40 },
      { header: 'Created Date', key: 'createdAt', width: 20 },
      { header: 'Updated Date', key: 'updatedAt', width: 20 },
    ];

    // Add filter/sort header first and get the data start row
    const sortBy = filters.sortBy || 'name';
    const sortOrder = filters.sortOrder || 'asc';
    const dataStartRow = excel.addFilterSortHeader(
      filters,
      sortBy,
      sortOrder,
      undefined,
      columns.length,
    );

    // Define columns with headers at the correct row (after filter header)
    excel.setColumns(columns, dataStartRow);

    const query: Record<string, unknown> = {};
    if (filters.search) {
      query.$or = [
        { name: { $regex: filters.search, $options: 'i' } },
        { description: { $regex: filters.search, $options: 'i' } },
      ];
    }

    // Apply sorting (already set above)
    const sort: Record<string, number> = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const roles = await Role.find(query).sort(sort).lean();

    for (const role of roles) {
      const rowData: Record<string, unknown> = {
        _id: role._id?.toString() || '-',
        name: role.name || '-',
        description: role.description || '-',
        createdAt: role.createdAt
          ? new Date(role.createdAt).toLocaleString()
          : '-',
        updatedAt: role.updatedAt
          ? new Date(role.updatedAt).toLocaleString()
          : '-',
      };

      excel.addRow(rowData);
    }

    // Add export info sheet with filters and sort
    excel.addExportInfoSheet(filters, sortBy, sortOrder, roles.length);

    await excel.generateAndSend(
      res,
      `roles_export_${new Date().toISOString().split('T')[0]}.xlsx`,
    );
  }

  /**
   * Export QC entries to Excel
   * Includes machine data and QC data with document links
   */
  static async exportQCEntriesToExcel(
    res: Response,
    filters: ExportFilters = {},
  ): Promise<void> {
    const excel = new ExcelUtil('QC Entries');

    // Define comprehensive column structure showing the full journey
    // Journey: Machine Creation -> Machine Approval -> QC Entry -> QC Approval
    const columns = [
      // ===== MACHINE CREATION SECTION =====
      {
        header: 'Machine Seq',
        key: 'machineSequence',
        width: 18,
        section: 'machine_creation',
      },
      {
        header: 'Machine Name',
        key: 'machineName',
        width: 25,
        section: 'machine_creation',
      },
      {
        header: 'Category',
        key: 'category',
        width: 20,
        section: 'machine_creation',
      },
      {
        header: 'Subcategory',
        key: 'subcategory',
        width: 20,
        section: 'machine_creation',
      },
      {
        header: 'Party Name',
        key: 'partyName',
        width: 20,
        section: 'machine_creation',
      },
      {
        header: 'Location',
        key: 'location',
        width: 20,
        section: 'machine_creation',
      },
      {
        header: 'Mobile Number',
        key: 'mobileNumber',
        width: 15,
        section: 'machine_creation',
      },
      {
        header: 'Dispatch Date',
        key: 'dispatchDate',
        width: 20,
        section: 'machine_creation',
      },
      {
        header: 'Machine Created By',
        key: 'machineCreatedBy',
        width: 20,
        section: 'machine_creation',
      },
      {
        header: 'Machine Created Date',
        key: 'machineCreatedAt',
        width: 20,
        section: 'machine_creation',
      },
      {
        header: 'Machine Images',
        key: 'machineImages',
        width: 60,
        section: 'machine_creation',
      },
      {
        header: 'Machine Documents',
        key: 'machineDocuments',
        width: 60,
        section: 'machine_creation',
      },

      // ===== MACHINE APPROVAL SECTION =====
      {
        header: 'Machine Approval Status',
        key: 'machineApprovalStatus',
        width: 20,
        section: 'machine_approval',
      },
      {
        header: 'Machine Requested By',
        key: 'machineRequestedBy',
        width: 20,
        section: 'machine_approval',
      },
      {
        header: 'Machine Approved By',
        key: 'machineApprovedBy',
        width: 20,
        section: 'machine_approval',
      },
      {
        header: 'Machine Approval Date',
        key: 'machineApprovalDate',
        width: 20,
        section: 'machine_approval',
      },
      {
        header: 'Machine Rejected By',
        key: 'machineRejectedBy',
        width: 20,
        section: 'machine_approval',
      },
      {
        header: 'Machine Rejection Reason',
        key: 'machineRejectionReason',
        width: 30,
        section: 'machine_approval',
      },

      // ===== QC ENTRY SECTION =====
      {
        header: 'QC Entry Seq',
        key: 'qcEntrySequence',
        width: 18,
        section: 'qc_entry',
      },
      {
        header: 'QC Entry Created By',
        key: 'qcEntryCreatedBy',
        width: 20,
        section: 'qc_entry',
      },
      {
        header: 'QC Entry Created Date',
        key: 'qcEntryCreatedAt',
        width: 20,
        section: 'qc_entry',
      },

      // ===== QC APPROVAL SECTION =====
      {
        header: 'QC Seq',
        key: 'qcSequence',
        width: 18,
        section: 'qc_approval',
      },
      { header: 'QC Notes', key: 'qcNotes', width: 30, section: 'qc_approval' },
      {
        header: 'Quality Score',
        key: 'qualityScore',
        width: 15,
        section: 'qc_approval',
      },
      {
        header: 'Inspection Date',
        key: 'inspectionDate',
        width: 20,
        section: 'qc_approval',
      },
      {
        header: 'Next Inspection Date',
        key: 'nextInspectionDate',
        width: 20,
        section: 'qc_approval',
      },
      {
        header: 'QC Documents',
        key: 'qcDocuments',
        width: 60,
        section: 'qc_approval',
      },
      { header: 'QC Files', key: 'qcFiles', width: 60, section: 'qc_approval' },
      {
        header: 'QC Requested By',
        key: 'qcRequestedBy',
        width: 20,
        section: 'qc_approval',
      },
      {
        header: 'QC Approval Type',
        key: 'qcApprovalType',
        width: 20,
        section: 'qc_approval',
      },
      {
        header: 'QC Approval Status',
        key: 'qcApprovalStatus',
        width: 15,
        section: 'qc_approval',
      },
      {
        header: 'QC Approved By',
        key: 'qcApprovedBy',
        width: 20,
        section: 'qc_approval',
      },
      {
        header: 'QC Rejected By',
        key: 'qcRejectedBy',
        width: 20,
        section: 'qc_approval',
      },
      {
        header: 'QC Approval Date',
        key: 'qcApprovalDate',
        width: 20,
        section: 'qc_approval',
      },
      {
        header: 'QC Rejection Reason',
        key: 'qcRejectionReason',
        width: 30,
        section: 'qc_approval',
      },
      {
        header: 'QC Created Date',
        key: 'qcCreatedAt',
        width: 20,
        section: 'qc_approval',
      },
    ];

    // Add filter/sort header first and get the data start row
    const sortBy = filters.sortBy || 'createdAt';
    const sortOrder = filters.sortOrder || 'desc';
    const dataStartRow = excel.addFilterSortHeader(
      filters,
      sortBy,
      sortOrder,
      undefined,
      columns.length,
    );

    // Define columns with headers at the correct row (after filter header)
    excel.setColumns(columns, dataStartRow);

    // Apply color coding to headers based on section
    const headerRow = excel['worksheet'].getRow(dataStartRow);
    const sectionColors: Record<string, string> = {
      machine_creation: 'FF2563EB', // Blue - Machine Creation
      machine_approval: 'FF7C3AED', // Purple - Machine Approval
      qc_entry: 'FFFF6B35', // Orange - QC Entry
      qc_approval: 'FF16A34A', // Green - QC Approval
    };

    columns.forEach((col, index) => {
      const cell = headerRow.getCell(index + 1);
      const color = sectionColors[col.section || ''] || 'FF3B82F6';
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: color },
      };
      cell.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
    });

    // Build query for QC Approvals
    const query: Record<string, unknown> = {};

    // Handle category filter - need to find machines with this category first
    if (filters.category_id) {
      const machinesWithCategory = await Machine.find({
        category_id: filters.category_id,
      })
        .select('_id')
        .lean();
      const machineIds = machinesWithCategory.map((m) => m._id);
      query.machineId = { $in: machineIds };
    }

    if (filters.search) {
      // Search in machine names, party names, QC notes
      const machinesMatchingSearch = await Machine.find({
        $or: [
          { name: { $regex: filters.search, $options: 'i' } },
          { party_name: { $regex: filters.search, $options: 'i' } },
        ],
      })
        .select('_id')
        .lean();
      const machineIds = machinesMatchingSearch.map((m) => m._id);

      query.$or = [
        { machineId: { $in: machineIds } },
        { 'proposedChanges.name': { $regex: filters.search, $options: 'i' } },
        {
          'proposedChanges.party_name': {
            $regex: filters.search,
            $options: 'i',
          },
        },
        { qcNotes: { $regex: filters.search, $options: 'i' } },
        { requestNotes: { $regex: filters.search, $options: 'i' } },
      ];
    }

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.approvalType) {
      query.approvalType = filters.approvalType;
    }

    if (filters.is_approved !== undefined) {
      // Map is_approved boolean to status
      if (filters.is_approved === true) {
        query.status = 'APPROVED';
      } else if (filters.is_approved === false) {
        query.status = { $in: ['PENDING', 'REJECTED'] };
      }
    }

    // Fetch QC Approvals with populated machine data
    const qcApprovals = await QCApproval.find(query)
      .populate(
        'machineId',
        'name machine_sequence category_id subcategory_id party_name location mobile_number dispatch_date images documents createdAt created_by updatedBy is_approved',
      )
      .populate('machineId.category_id', 'name')
      .populate('machineId.subcategory_id', 'name')
      .populate('machineId.created_by', 'username email')
      .populate('machineId.updatedBy', 'username email')
      .populate('requestedBy', 'username email')
      .populate('approvedBy', 'username email')
      .populate('rejectedBy', 'username email')
      .populate('qcEntryId', 'name machine_sequence files added_by createdAt')
      .populate('qcEntryId.added_by', 'username email')
      .sort({ createdAt: -1 })
      .lean();

    // Fetch machine approvals to get complete approval information
    const machineIds = qcApprovals
      .map((approval) => (approval.machineId as Record<string, unknown>)?._id)
      .filter(Boolean);

    const machineApprovals = await MachineApproval.find({
      machineId: { $in: machineIds },
    })
      .populate('requestedBy', 'username email')
      .populate('approvedBy', 'username email')
      .populate('rejectedBy', 'username email')
      .sort({ createdAt: -1 })
      .lean();

    // Create maps for machine approval data
    const machineApprovalMap = new Map(); // machineId -> latest approval
    machineApprovals.forEach((approval) => {
      const machineId = (
        approval.machineId as Record<string, unknown>
      )?.toString();
      if (machineId) {
        // Keep the latest approval for each machine
        const existing = machineApprovalMap.get(machineId);
        if (
          !existing ||
          new Date(approval.createdAt || 0) > new Date(existing.createdAt || 0)
        ) {
          machineApprovalMap.set(machineId, approval);
        }
      }
    });

    // Get base URL for document links
    const baseUrl =
      process.env.CLIENT_URL || process.env.BASE_URL || 'http://localhost:5000';

    // Helper function to get document URLs and names for hyperlinks
    const getDocumentLinks = (
      documents: unknown[],
    ): Array<{ name: string; url: string }> => {
      if (!documents || documents.length === 0) return [];
      return documents.map((doc) => {
        const path = doc.file_path || doc.path || doc;
        const name = doc.name || doc.originalName || doc.filename || 'Document';
        // Ensure URL is properly formatted - if it's already a full Cloudinary URL, use it directly
        let url = path;
        if (!path.startsWith('http://') && !path.startsWith('https://')) {
          // If it's not a full URL, it might be a relative path - but Cloudinary URLs should be full
          // Check if it contains cloudinary.com (might be malformed)
          if (path.includes('cloudinary.com')) {
            // Fix malformed URL (e.g., "https:\res.cloudinary.com" -> "https://res.cloudinary.com")
            url = path
              .replace(/\\/g, '/')
              .replace(/https?:\//, (match) => match.replace(':', '://'));
          } else {
            // Local file path - construct URL
            url = `${baseUrl}/${path.replace(/^\//, '')}`;
          }
        }
        return { name, url };
      });
    };

    // Helper function to get image URLs for hyperlinks
    const getImageLinks = (
      images: string[],
    ): Array<{ name: string; url: string }> => {
      if (!images || images.length === 0) return [];
      return images.map((img, index) => {
        // Ensure URL is properly formatted
        let url = img;
        if (!img.startsWith('http://') && !img.startsWith('https://')) {
          // Check if it contains cloudinary.com (might be malformed)
          if (img.includes('cloudinary.com')) {
            // Fix malformed URL
            url = img
              .replace(/\\/g, '/')
              .replace(/https?:\//, (match) => match.replace(':', '://'));
          } else {
            // Local file path - construct URL
            url = `${baseUrl}/${img.replace(/^\//, '')}`;
          }
        }
        return { name: `Image ${index + 1}`, url };
      });
    };

    // Helper function to get file URLs for hyperlinks
    const getFileLinks = (
      files: string[],
    ): Array<{ name: string; url: string }> => {
      if (!files || files.length === 0) return [];
      return files.map((file, index) => {
        // Ensure URL is properly formatted
        let url = file;
        if (!file.startsWith('http://') && !file.startsWith('https://')) {
          // Check if it contains cloudinary.com (might be malformed)
          if (file.includes('cloudinary.com')) {
            // Fix malformed URL
            url = file
              .replace(/\\/g, '/')
              .replace(/https?:\//, (match) => match.replace(':', '://'));
          } else {
            // Local file path - construct URL
            url = `${baseUrl}/${file.replace(/^\//, '')}`;
          }
        }
        return { name: `File ${index + 1}`, url };
      });
    };

    for (const approval of qcApprovals) {
      const machine = approval.machineId as Record<string, unknown>;
      const qcEntry = approval.qcEntryId as Record<string, unknown>;
      const proposedChanges = approval.proposedChanges || {};

      // Get machine data (from machine or proposedChanges)
      const machineName = machine?.name || proposedChanges.name || '-';
      const machineSequence =
        machine?.machine_sequence || proposedChanges.machine_sequence || '-';
      const category =
        machine?.category_id?.name ||
        (proposedChanges.category_id ? 'N/A' : '-');
      const subcategory =
        machine?.subcategory_id?.name ||
        (proposedChanges.subcategory_id ? 'N/A' : '-');
      const partyName =
        machine?.party_name || proposedChanges.party_name || '-';
      const location = machine?.location || proposedChanges.location || '-';
      const mobileNumber =
        machine?.mobile_number || proposedChanges.mobile_number || '-';
      const dispatchDate = machine?.dispatch_date
        ? new Date(machine.dispatch_date).toLocaleDateString()
        : proposedChanges.dispatch_date
          ? new Date(proposedChanges.dispatch_date).toLocaleDateString()
          : '-';

      // Machine documents and images (for hyperlink embedding)
      const machineDocuments = machine?.documents || [];
      const machineImages = machine?.images || [];
      const machineDocumentLinks = getDocumentLinks(machineDocuments);
      const machineImageLinks = getImageLinks(machineImages);

      // QC data
      const qcSequence =
        qcEntry?.machine_sequence ||
        approval.proposedChanges?.machine_sequence ||
        '-';
      const qcNotes = approval.qcNotes || approval.requestNotes || '-';
      const qualityScore = approval.qualityScore || '-';
      const inspectionDate = approval.inspectionDate
        ? new Date(approval.inspectionDate).toLocaleDateString()
        : '-';
      const nextInspectionDate = approval.nextInspectionDate
        ? new Date(approval.nextInspectionDate).toLocaleDateString()
        : '-';

      // QC documents and files (for hyperlink embedding)
      const qcDocuments = approval.documents || [];
      const qcFiles = qcEntry?.files || approval.proposedChanges?.files || [];
      const qcDocumentLinks = getDocumentLinks(qcDocuments);
      const qcFileLinks = getFileLinks(qcFiles);

      // Get machine creation data
      const machineCreatedBy =
        (machine?.created_by as Record<string, unknown>)?.username ||
        (machine?.created_by as Record<string, unknown>)?.email ||
        '-';

      // Get machine approval data
      const machineApproval = machineApprovalMap.get(machine?._id?.toString());
      const machineApprovalStatus =
        machineApproval?.status ||
        (machine?.is_approved ? 'APPROVED' : 'PENDING');
      const machineRequestedBy =
        (machineApproval?.requestedBy as Record<string, unknown>)?.username ||
        (machineApproval?.requestedBy as Record<string, unknown>)?.email ||
        '-';
      const machineApprovedBy =
        (machineApproval?.approvedBy as Record<string, unknown>)?.username ||
        (machineApproval?.approvedBy as Record<string, unknown>)?.email ||
        '-';
      const machineRejectedBy =
        (machineApproval?.rejectedBy as Record<string, unknown>)?.username ||
        (machineApproval?.rejectedBy as Record<string, unknown>)?.email ||
        '-';
      const machineApprovalDate = machineApproval?.approvalDate
        ? new Date(machineApproval.approvalDate).toLocaleString()
        : '-';
      const machineRejectionReason = machineApproval?.rejectionReason || '-';

      // Get QC Entry data
      const qcEntryCreatedBy =
        (qcEntry?.added_by as Record<string, unknown>)?.username ||
        (qcEntry?.added_by as Record<string, unknown>)?.email ||
        '-';
      const qcEntrySequence = qcEntry?.machine_sequence || '-';
      const qcEntryCreatedAt = qcEntry?.createdAt
        ? new Date(qcEntry.createdAt).toLocaleString()
        : '-';

      const rowData: Record<string, unknown> = {
        // ===== MACHINE CREATION SECTION =====
        machineSequence: machineSequence,
        machineName: machineName,
        category: category,
        subcategory: subcategory,
        partyName: partyName,
        location: location,
        mobileNumber: mobileNumber,
        dispatchDate: dispatchDate,
        machineCreatedBy: machineCreatedBy,
        machineCreatedAt: machine?.createdAt
          ? new Date(machine.createdAt).toLocaleString()
          : '-',
        machineImages:
          machineImageLinks.length > 0
            ? machineImageLinks.map((link) => link.name).join(', ')
            : '-',
        machineDocuments:
          machineDocumentLinks.length > 0
            ? machineDocumentLinks.map((link) => link.name).join(', ')
            : '-',

        // ===== MACHINE APPROVAL SECTION =====
        machineApprovalStatus: machineApprovalStatus,
        machineRequestedBy: machineRequestedBy,
        machineApprovedBy: machineApprovedBy,
        machineApprovalDate: machineApprovalDate,
        machineRejectedBy: machineRejectedBy,
        machineRejectionReason: machineRejectionReason,

        // ===== QC ENTRY SECTION =====
        qcEntrySequence: qcEntrySequence,
        qcEntryCreatedBy: qcEntryCreatedBy,
        qcEntryCreatedAt: qcEntryCreatedAt,

        // ===== QC APPROVAL SECTION =====
        qcSequence: qcSequence,
        qcNotes: qcNotes,
        qualityScore: qualityScore,
        inspectionDate: inspectionDate,
        nextInspectionDate: nextInspectionDate,
        qcDocuments:
          qcDocumentLinks.length > 0
            ? qcDocumentLinks.map((link) => link.name).join(', ')
            : '-',
        qcFiles:
          qcFileLinks.length > 0
            ? qcFileLinks.map((link) => link.name).join(', ')
            : '-',
        qcRequestedBy:
          (approval.requestedBy as Record<string, unknown>)?.username || '-',
        qcApprovalType: approval.approvalType || '-',
        qcApprovalStatus: approval.status || 'PENDING',
        qcApprovedBy:
          (approval.approvedBy as Record<string, unknown>)?.username || '-',
        qcRejectedBy:
          (approval.rejectedBy as Record<string, unknown>)?.username || '-',
        qcApprovalDate: approval.approvalDate
          ? new Date(approval.approvalDate).toLocaleString()
          : '-',
        qcRejectionReason: approval.rejectionReason || '-',
        qcCreatedAt: approval.createdAt
          ? new Date(approval.createdAt).toLocaleString()
          : '-',
      };

      const rowNumber = excel.addRow(rowData);

      // Helper function to properly format URLs and add hyperlinks
      const addHyperlinksToCell = (
        cell: ExcelJS.Cell,
        links: Array<{ name: string; url: string }>,
      ) => {
        if (!links || links.length === 0) return;

        // Clean and format URLs
        const cleanedLinks = links.map((link) => {
          let cleanUrl = link.url;
          // Fix malformed URLs (replace backslashes and fix protocol)
          if (cleanUrl.includes('cloudinary.com')) {
            cleanUrl = cleanUrl
              .replace(/\\/g, '/')
              .replace(/https?:\//, (match) => match.replace(':', '://'));
          }
          // Ensure proper URL format
          if (
            !cleanUrl.startsWith('http://') &&
            !cleanUrl.startsWith('https://')
          ) {
            // If it's not a full URL, it might be a relative path
            cleanUrl = `${baseUrl}/${cleanUrl.replace(/^\//, '')}`;
          }
          return { name: link.name, url: cleanUrl };
        });

        // For single link, use simple hyperlink format (more reliable)
        if (cleanedLinks.length === 1) {
          cell.value = {
            text: cleanedLinks[0].name,
            hyperlink: cleanedLinks[0].url,
          };
          cell.font = { color: { argb: 'FF0563C1' }, underline: true };
          return;
        }

        // For multiple links, use rich text format
        // ExcelJS rich text format: array of objects with text, font, and hyperlink properties
        const richTextParts: Array<{
          text: string;
          font?: { color?: { argb: string }; underline?: boolean };
          hyperlink?: string;
        }> = [];

        cleanedLinks.forEach((link, index) => {
          if (index > 0) {
            // Add comma separator (no hyperlink, no special font)
            richTextParts.push({ text: ', ' });
          }
          // Add link with hyperlink and styling
          richTextParts.push({
            text: link.name,
            hyperlink: link.url,
            font: { color: { argb: 'FF0563C1' }, underline: true },
          });
        });

        // Set the rich text value
        cell.value = { richText: richTextParts };
      };

      // Add hyperlinks for machine images
      if (machineImageLinks.length > 0) {
        const imageCell = excel['worksheet']
          .getRow(rowNumber)
          .getCell('machineImages');
        addHyperlinksToCell(imageCell, machineImageLinks);
      }

      // Add hyperlinks for machine documents
      if (machineDocumentLinks.length > 0) {
        const docCell = excel['worksheet']
          .getRow(rowNumber)
          .getCell('machineDocuments');
        addHyperlinksToCell(docCell, machineDocumentLinks);
      }

      // Add hyperlinks for QC documents
      if (qcDocumentLinks.length > 0) {
        const qcDocCell = excel['worksheet']
          .getRow(rowNumber)
          .getCell('qcDocuments');
        addHyperlinksToCell(qcDocCell, qcDocumentLinks);
      }

      // Add hyperlinks for QC files
      if (qcFileLinks.length > 0) {
        const qcFileCell = excel['worksheet']
          .getRow(rowNumber)
          .getCell('qcFiles');
        addHyperlinksToCell(qcFileCell, qcFileLinks);
      }

      // Apply section-based row coloring for better visual separation
      const row = excel['worksheet'].getRow(rowNumber);

      // Color sections based on column definitions
      columns.forEach((col, index) => {
        // Use index + 1 for 1-based column numbering
        const colNumber = index + 1;
        if (colNumber > 16384) return; // Excel limit check

        const cell = row.getCell(colNumber);
        if (!cell) return; // Safety check

        const sectionColors: Record<string, string> = {
          machine_creation: 'FFEFF6FF', // Light blue
          machine_approval: 'FFF3E8FF', // Light purple
          qc_entry: 'FFFFF4ED', // Light orange
          qc_approval: 'FFF0FDF4', // Light green
        };
        const color = sectionColors[col.section || ''] || 'FFFFFFFF';
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: color },
        };
      });

      // Apply status styling for QC approval status
      excel.applyStatusStyle(
        rowNumber,
        'qcApprovalStatus',
        (approval.status || 'pending').toLowerCase(),
      );
    }

    // Add export info sheet with filters and sort
    excel.addExportInfoSheet(filters, sortBy, sortOrder, qcApprovals.length);

    await excel.generateAndSend(
      res,
      `qc_entries_export_${new Date().toISOString().split('T')[0]}.xlsx`,
    );
  }

  /**
   * Export QC entry to PDF (individual)
   */
  static async exportQCEntryToPdf(
    res: Response,
    qcEntryId: string,
  ): Promise<void> {
    const pdf = new PdfUtil();
    const styles = pdf.getDefaultStyles();

    const qcEntry = await QAMachineEntry.findById(qcEntryId)
      .populate('machine_id', 'name machine_sequence')
      .populate('category_id', 'name')
      .populate('added_by', 'username email')
      .lean();

    if (!qcEntry) {
      throw new Error('QC entry not found');
    }

    const content: unknown[] = [
      { text: 'QC Entry Details', style: 'header' },
      { text: '\n' },
    ];

    // Basic Information
    content.push({ text: 'Basic Information', style: 'subheader' });
    content.push({
      text: [
        { text: 'QC Entry ID: ', style: 'label' },
        { text: qcEntry._id?.toString() || 'N/A', style: 'value' },
      ],
    });
    content.push({
      text: [
        { text: 'Machine Name: ', style: 'label' },
        { text: qcEntry.name || 'N/A', style: 'value' },
      ],
    });
    content.push({
      text: [
        { text: 'Machine Sequence: ', style: 'label' },
        { text: qcEntry.machine_sequence || 'N/A', style: 'value' },
      ],
    });
    content.push({
      text: [
        { text: 'Category: ', style: 'label' },
        {
          text: (qcEntry.category_id as Record<string, unknown>)?.name || 'N/A',
          style: 'value',
        },
      ],
    });
    content.push({
      text: [
        { text: 'Status: ', style: 'label' },
        pdf.formatStatusBadge(
          (qcEntry.approval_status || 'PENDING').toLowerCase(),
        ),
      ],
    });

    // Contact Information
    content.push({ text: '\nContact Information', style: 'subheader' });
    content.push({
      text: [
        { text: 'Party Name: ', style: 'label' },
        { text: qcEntry.party_name || 'N/A', style: 'value' },
      ],
    });
    content.push({
      text: [
        { text: 'Location: ', style: 'label' },
        { text: qcEntry.location || 'N/A', style: 'value' },
      ],
    });
    content.push({
      text: [
        { text: 'Mobile Number: ', style: 'label' },
        { text: qcEntry.mobile_number || 'N/A', style: 'value' },
      ],
    });
    if (qcEntry.dispatch_date) {
      content.push({
        text: [
          { text: 'Dispatch Date: ', style: 'label' },
          {
            text: pdf.formatDate(qcEntry.dispatch_date),
            style: 'value',
          },
        ],
      });
    }

    // QC Specific Information
    content.push({ text: '\nQC Information', style: 'subheader' });
    if (qcEntry.qcNotes) {
      content.push({
        text: [
          { text: 'QC Notes: ', style: 'label' },
          { text: qcEntry.qcNotes, style: 'value' },
        ],
      });
    }
    if (qcEntry.qualityScore !== undefined) {
      content.push({
        text: [
          { text: 'Quality Score: ', style: 'label' },
          { text: qcEntry.qualityScore.toString(), style: 'value' },
        ],
      });
    }
    if (qcEntry.inspectionDate) {
      content.push({
        text: [
          { text: 'Inspection Date: ', style: 'label' },
          {
            text: pdf.formatDate(qcEntry.inspectionDate),
            style: 'value',
          },
        ],
      });
    }
    if (qcEntry.qc_date) {
      content.push({
        text: [
          { text: 'QC Date: ', style: 'label' },
          {
            text: pdf.formatDate(qcEntry.qc_date),
            style: 'value',
          },
        ],
      });
    }
    if (qcEntry.nextInspectionDate) {
      content.push({
        text: [
          { text: 'Next Inspection Date: ', style: 'label' },
          {
            text: pdf.formatDate(qcEntry.nextInspectionDate),
            style: 'value',
          },
        ],
      });
    }
    if (qcEntry.report_link) {
      content.push({
        text: [
          { text: 'Report Link: ', style: 'label' },
          {
            text: qcEntry.report_link,
            style: 'value',
            link: qcEntry.report_link,
            color: '#3B82F6',
          },
        ],
      });
    }

    // Images
    if (qcEntry.images && qcEntry.images.length > 0) {
      content.push({ text: '\nMachine Images', style: 'subheader' });
      for (const imageUrl of qcEntry.images.slice(0, 5)) {
        // Limit to 5 images in PDF
        try {
          const imageData = await pdf.loadImage(imageUrl);
          content.push({
            image: imageData,
            width: 200,
            margin: [0, 5, 0, 10],
          });
        } catch {
          content.push({
            text: [
              { text: 'Image: ', style: 'label' },
              { text: imageUrl, style: 'value' },
            ],
          });
        }
      }
      if (qcEntry.images.length > 5) {
        content.push({
          text: `... and ${qcEntry.images.length - 5} more images`,
          style: 'value',
          italics: true,
        });
      }
    }

    // Documents
    if (qcEntry.documents && qcEntry.documents.length > 0) {
      content.push({ text: '\nMachine Documents', style: 'subheader' });
      const docList: unknown[] = [];
      qcEntry.documents.forEach((doc: unknown) => {
        docList.push({
          text: [
            { text: '• ', style: 'value' },
            {
              text: doc.name || 'Document',
              style: 'value',
              link: doc.file_path,
              color: '#3B82F6',
            },
            { text: ` (${doc.document_type || 'N/A'})`, style: 'value' },
          ],
          margin: [0, 2, 0, 2],
        });
      });
      content.push(...docList);
    }

    // QC Files
    if (qcEntry.files && qcEntry.files.length > 0) {
      content.push({ text: '\nQC Files', style: 'subheader' });
      const fileList: unknown[] = [];
      qcEntry.files.forEach((fileUrl: string) => {
        fileList.push({
          text: [
            { text: '• ', style: 'value' },
            {
              text: fileUrl,
              style: 'value',
              link: fileUrl,
              color: '#3B82F6',
            },
          ],
          margin: [0, 2, 0, 2],
        });
      });
      content.push(...fileList);
    }

    // Metadata
    content.push({ text: '\nMetadata', style: 'subheader' });
    content.push({
      text: [
        { text: 'Added By: ', style: 'label' },
        {
          text:
            (qcEntry.added_by as Record<string, unknown>)?.username || 'N/A',
          style: 'value',
        },
      ],
    });
    content.push({
      text: [
        { text: 'Created Date: ', style: 'label' },
        {
          text: pdf.formatDate(qcEntry.createdAt),
          style: 'value',
        },
      ],
    });
    if (qcEntry.metadata && Object.keys(qcEntry.metadata).length > 0) {
      content.push({
        text: [
          { text: 'Additional Metadata: ', style: 'label' },
          {
            text: JSON.stringify(qcEntry.metadata, null, 2),
            style: 'value',
            margin: [0, 5, 0, 10],
          },
        ],
      });
    }

    const docDefinition: TDocumentDefinitions = {
      content,
      styles,
      defaultStyle: {
        font: 'Roboto',
      },
    };

    await pdf.generateAndSend(
      res,
      docDefinition,
      `qc_entry_${qcEntry._id}_${new Date().toISOString().split('T')[0]}.pdf`,
    );
  }

  /**
   * Export machine approvals to Excel
   */
  static async exportMachineApprovalsToExcel(
    res: Response,
    filters: ExportFilters = {},
  ): Promise<void> {
    const excel = new ExcelUtil('Machine Approvals');

    // Define column structure first (for column count)
    const columns = [
      { header: 'Approval ID', key: '_id', width: 25 },
      { header: 'Machine', key: 'machine', width: 25 },
      { header: 'Type', key: 'type', width: 15 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Requested By', key: 'requestedBy', width: 20 },
      { header: 'Created Date', key: 'createdAt', width: 20 },
    ];

    // Add filter/sort header first and get the data start row
    const sortBy = filters.sortBy || 'createdAt';
    const sortOrder = filters.sortOrder || 'desc';
    const dataStartRow = excel.addFilterSortHeader(
      filters,
      sortBy,
      sortOrder,
      undefined,
      columns.length,
    );

    // Define columns with headers at the correct row (after filter header)
    excel.setColumns(columns, dataStartRow);

    const query: Record<string, unknown> = {};
    if (filters.status) query.status = filters.status;
    if (filters.approvalType) query.approvalType = filters.approvalType;

    // Apply sorting (already set above)
    const sort: Record<string, number> = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const approvals = await MachineApproval.find(query)
      .populate('machineId', 'name machine_sequence')
      .populate('requestedBy', 'username email')
      .sort(sort)
      .lean();

    for (const approval of approvals) {
      const rowData: Record<string, unknown> = {
        _id: approval._id?.toString() || '-',
        machine: (approval.machineId as Record<string, unknown>)?.name || '-',
        type: approval.approvalType || '-',
        status: approval.status || 'PENDING',
        requestedBy:
          (approval.requestedBy as Record<string, unknown>)?.username || '-',
        createdAt: approval.createdAt
          ? new Date(approval.createdAt).toLocaleString()
          : '-',
      };

      const rowNumber = excel.addRow(rowData);
      excel.applyStatusStyle(
        rowNumber,
        'status',
        (approval.status || 'pending').toLowerCase(),
      );
    }

    // Add export info sheet with filters and sort
    excel.addExportInfoSheet(filters, sortBy, sortOrder, approvals.length);

    await excel.generateAndSend(
      res,
      `machine_approvals_export_${new Date().toISOString().split('T')[0]}.xlsx`,
    );
  }

  /**
   * Export machine approval to PDF (individual)
   */
  static async exportMachineApprovalToPdf(
    res: Response,
    approvalId: string,
  ): Promise<void> {
    const pdf = new PdfUtil();
    const styles = pdf.getDefaultStyles();

    const approval = await MachineApproval.findById(approvalId)
      .populate('machineId', 'name machine_sequence')
      .populate('requestedBy', 'username email')
      .populate('approvedBy', 'username email')
      .populate('rejectedBy', 'username email')
      .lean();

    if (!approval) {
      throw new Error('Machine approval not found');
    }

    const content: unknown[] = [
      { text: 'Machine Approval Details', style: 'header' },
      { text: '\n' },
    ];

    // Basic Information
    content.push({ text: 'Approval Information', style: 'subheader' });
    content.push({
      text: [
        { text: 'Approval ID: ', style: 'label' },
        { text: approval._id?.toString() || 'N/A', style: 'value' },
      ],
    });
    content.push({
      text: [
        { text: 'Machine: ', style: 'label' },
        {
          text: (approval.machineId as Record<string, unknown>)?.name || 'N/A',
          style: 'value',
        },
      ],
    });
    content.push({
      text: [
        { text: 'Machine Sequence: ', style: 'label' },
        {
          text:
            (approval.machineId as Record<string, unknown>)?.machine_sequence ||
            'N/A',
          style: 'value',
        },
      ],
    });
    content.push({
      text: [
        { text: 'Approval Type: ', style: 'label' },
        { text: approval.approvalType || 'N/A', style: 'value' },
      ],
    });
    content.push({
      text: [
        { text: 'Status: ', style: 'label' },
        pdf.formatStatusBadge((approval.status || 'PENDING').toLowerCase()),
      ],
    });

    // Request Information
    content.push({ text: '\nRequest Information', style: 'subheader' });
    content.push({
      text: [
        { text: 'Requested By: ', style: 'label' },
        {
          text:
            (approval.requestedBy as Record<string, unknown>)?.username ||
            'N/A',
          style: 'value',
        },
      ],
    });
    content.push({
      text: [
        { text: 'Requested Email: ', style: 'label' },
        {
          text:
            (approval.requestedBy as Record<string, unknown>)?.email || 'N/A',
          style: 'value',
        },
      ],
    });
    if (approval.requestNotes) {
      content.push({
        text: [
          { text: 'Request Notes: ', style: 'label' },
          { text: approval.requestNotes, style: 'value' },
        ],
      });
    }
    content.push({
      text: [
        { text: 'Created Date: ', style: 'label' },
        {
          text: pdf.formatDate(approval.createdAt),
          style: 'value',
        },
      ],
    });

    // Approval/Rejection Information
    if (approval.status === 'APPROVED') {
      content.push({ text: '\nApproval Information', style: 'subheader' });
      content.push({
        text: [
          { text: 'Approved By: ', style: 'label' },
          {
            text:
              (approval.approvedBy as Record<string, unknown>)?.username ||
              'N/A',
            style: 'value',
          },
        ],
      });
      if (approval.approvalDate) {
        content.push({
          text: [
            { text: 'Approval Date: ', style: 'label' },
            {
              text: pdf.formatDate(approval.approvalDate),
              style: 'value',
            },
          ],
        });
      }
      if (approval.approverNotes) {
        content.push({
          text: [
            { text: 'Approver Notes: ', style: 'label' },
            { text: approval.approverNotes, style: 'value' },
          ],
        });
      }
    } else if (approval.status === 'REJECTED') {
      content.push({ text: '\nRejection Information', style: 'subheader' });
      content.push({
        text: [
          { text: 'Rejected By: ', style: 'label' },
          {
            text:
              (approval.rejectedBy as Record<string, unknown>)?.username ||
              'N/A',
            style: 'value',
          },
        ],
      });
      if (approval.rejectionReason) {
        content.push({
          text: [
            { text: 'Rejection Reason: ', style: 'label' },
            { text: approval.rejectionReason, style: 'value' },
          ],
        });
      }
    }

    // Proposed Changes
    if (
      approval.proposedChanges &&
      Object.keys(approval.proposedChanges).length > 0
    ) {
      content.push({ text: '\nProposed Changes', style: 'subheader' });
      content.push({
        text: JSON.stringify(approval.proposedChanges, null, 2),
        style: 'value',
        margin: [0, 5, 0, 10],
      });
    }

    const docDefinition: TDocumentDefinitions = {
      content,
      styles,
      defaultStyle: {
        font: 'Roboto',
      },
    };

    await pdf.generateAndSend(
      res,
      docDefinition,
      `machine_approval_${approval._id}_${new Date().toISOString().split('T')[0]}.pdf`,
    );
  }

  /**
   * Export permissions to Excel
   */
  static async exportPermissionsToExcel(
    res: Response,
    filters: ExportFilters = {},
  ): Promise<void> {
    const excel = new ExcelUtil('Permissions');

    // Define column structure first (for column count)
    const columns = [
      { header: 'Permission ID', key: '_id', width: 25 },
      { header: 'Name', key: 'name', width: 30 },
      { header: 'Action', key: 'action', width: 25 },
      { header: 'Permission Level', key: 'permission', width: 20 },
      { header: 'Roles', key: 'roles', width: 35 },
      { header: 'Departments', key: 'departments', width: 35 },
      { header: 'Categories', key: 'categories', width: 35 },
      { header: 'Approver Roles', key: 'approvers', width: 35 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Priority', key: 'priority', width: 12 },
      { header: 'Created Date', key: 'createdAt', width: 20 },
    ];

    // Add filter/sort header first and get the data start row
    const sortBy = filters.sortBy || 'createdAt';
    const sortOrder = filters.sortOrder || 'desc';
    const dataStartRow = excel.addFilterSortHeader(
      filters,
      sortBy,
      sortOrder,
      undefined,
      columns.length,
    );

    // Define columns with headers at the correct row (after filter header)
    excel.setColumns(columns, dataStartRow);

    const query: Record<string, unknown> = {};
    if (filters.search) {
      query.$or = [
        { name: { $regex: filters.search, $options: 'i' } },
        { description: { $regex: filters.search, $options: 'i' } },
        { action: { $regex: filters.search, $options: 'i' } },
      ];
    }
    if (filters.resource) {
      // Action type filtering (resource is mapped to action)
      query.action = filters.resource;
    }
    if (filters.action) {
      query.action = filters.action;
    }
    if (filters.role) {
      query.roleIds = filters.role;
    }
    if (typeof filters.isActive === 'boolean') {
      query.isActive = filters.isActive;
    }

    // Apply sorting (already set above)
    const sort: Record<string, number> = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const permissions = await PermissionConfig.find(query)
      .populate('roleIds', 'name')
      .populate('departmentIds', 'name')
      .populate('categoryIds', 'name')
      .populate('approverRoles', 'name')
      .populate('createdBy', 'username email')
      .sort(sort)
      .lean();

    for (const permission of permissions) {
      // Handle multiple values with comma separation
      const roles = Array.isArray(permission.roleIds)
        ? (permission.roleIds as unknown[])
            .map((r) => (typeof r === 'object' && r?.name ? r.name : r))
            .filter(Boolean)
            .join(', ')
        : '-';

      const departments = Array.isArray(permission.departmentIds)
        ? (permission.departmentIds as unknown[])
            .map((d) => (typeof d === 'object' && d?.name ? d.name : d))
            .filter(Boolean)
            .join(', ')
        : '-';

      const categories = Array.isArray(permission.categoryIds)
        ? (permission.categoryIds as unknown[])
            .map((c) => (typeof c === 'object' && c?.name ? c.name : c))
            .filter(Boolean)
            .join(', ')
        : '-';

      const approvers = Array.isArray(permission.approverRoles)
        ? (permission.approverRoles as unknown[])
            .map((a) => (typeof a === 'object' && a?.name ? a.name : a))
            .filter(Boolean)
            .join(', ')
        : '-';

      const rowData: Record<string, unknown> = {
        _id: permission._id?.toString() || '-',
        name: permission.name || '-',
        action: permission.action || '-',
        permission: permission.permission || '-',
        roles: roles || '-',
        departments: departments || '-',
        categories: categories || '-',
        approvers: approvers || '-',
        status: permission.isActive ? 'Active' : 'Inactive',
        priority: permission.priority?.toString() || '0',
        createdAt: permission.createdAt
          ? new Date(permission.createdAt).toLocaleString()
          : '-',
      };

      const rowNumber = excel.addRow(rowData);

      // Apply text wrapping for array columns to handle multiple values
      excel.applyTextWrapping(rowNumber, [
        'roles',
        'departments',
        'categories',
        'approvers',
      ]);

      // Apply status style
      excel.applyStatusStyle(
        rowNumber,
        'status',
        permission.isActive ? 'active' : 'inactive',
      );
    }

    // Add export info sheet with filters and sort
    excel.addExportInfoSheet(filters, sortBy, sortOrder, permissions.length);

    await excel.generateAndSend(
      res,
      `permissions_export_${new Date().toISOString().split('T')[0]}.xlsx`,
    );
  }

  /**
   * Export permission to PDF (individual)
   */
  static async exportPermissionToPdf(
    res: Response,
    permissionId: string,
  ): Promise<void> {
    const pdf = new PdfUtil();
    const styles = pdf.getDefaultStyles();

    const permission = await PermissionConfig.findById(permissionId)
      .populate('roleIds', 'name')
      .populate('createdBy', 'username email')
      .populate('departmentIds', 'name')
      .populate('categoryIds', 'name')
      .populate('approverRoles', 'name')
      .lean();

    if (!permission) {
      throw new Error('Permission not found');
    }

    const roles = Array.isArray(permission.roleIds)
      ? (permission.roleIds as unknown[])
          .map((r) =>
            typeof r === 'object' && r && 'name' in r
              ? (r as Record<string, unknown>).name
              : r,
          )
          .filter(Boolean)
          .join(', ')
      : 'None';

    const departments = Array.isArray(permission.departmentIds)
      ? (permission.departmentIds as unknown[])
          .map((d) =>
            typeof d === 'object' && d && 'name' in d
              ? (d as Record<string, unknown>).name
              : d,
          )
          .filter(Boolean)
          .join(', ')
      : 'None';

    const categories = Array.isArray(permission.categoryIds)
      ? (permission.categoryIds as unknown[])
          .map((c) =>
            typeof c === 'object' && c && 'name' in c
              ? (c as Record<string, unknown>).name
              : c,
          )
          .filter(Boolean)
          .join(', ')
      : 'None';

    const approvers = Array.isArray(permission.approverRoles)
      ? (permission.approverRoles as unknown[])
          .map((a) =>
            typeof a === 'object' && a && 'name' in a
              ? (a as Record<string, unknown>).name
              : a,
          )
          .filter(Boolean)
          .join(', ')
      : 'None';

    const content: unknown[] = [
      { text: 'Permission Configuration Details', style: 'header' },
      { text: '\n' },
      {
        text: [
          { text: 'Permission ID: ', style: 'label' },
          { text: permission._id?.toString() || 'N/A', style: 'value' },
        ],
      },
      {
        text: [
          { text: 'Name: ', style: 'label' },
          { text: permission.name || 'N/A', style: 'value' },
        ],
      },
      {
        text: [
          { text: 'Description: ', style: 'label' },
          { text: permission.description || 'N/A', style: 'value' },
        ],
      },
      {
        text: [
          { text: 'Action: ', style: 'label' },
          { text: permission.action || 'N/A', style: 'value' },
        ],
      },
      {
        text: [
          { text: 'Permission Level: ', style: 'label' },
          pdf.formatStatusBadge(
            permission.permission?.toLowerCase() || 'denied',
          ),
        ],
      },
      {
        text: [
          { text: 'Roles: ', style: 'label' },
          { text: roles, style: 'value' },
        ],
      },
      {
        text: [
          { text: 'Departments: ', style: 'label' },
          { text: departments, style: 'value' },
        ],
      },
      {
        text: [
          { text: 'Categories: ', style: 'label' },
          { text: categories, style: 'value' },
        ],
      },
      {
        text: [
          { text: 'Approver Roles: ', style: 'label' },
          { text: approvers, style: 'value' },
        ],
      },
      {
        text: [
          { text: 'Status: ', style: 'label' },
          pdf.formatStatusBadge(permission.isActive ? 'active' : 'inactive'),
        ],
      },
      {
        text: [
          { text: 'Priority: ', style: 'label' },
          { text: permission.priority?.toString() || '0', style: 'value' },
        ],
      },
      {
        text: [
          { text: 'Max Value: ', style: 'label' },
          {
            text:
              permission.maxValue !== undefined
                ? permission.maxValue.toString()
                : 'N/A',
            style: 'value',
          },
        ],
      },
      {
        text: [
          { text: 'Created By: ', style: 'label' },
          {
            text:
              (permission.createdBy as Record<string, unknown>)?.username ||
              (typeof permission.createdBy === 'string'
                ? permission.createdBy
                : 'N/A'),
            style: 'value',
          },
        ],
      },
      {
        text: [
          { text: 'Created Date: ', style: 'label' },
          {
            text: pdf.formatDate(permission.createdAt),
            style: 'value',
          },
        ],
      },
    ];

    const docDefinition: TDocumentDefinitions = {
      content,
      styles,
      defaultStyle: {
        font: 'Roboto',
      },
    };

    await pdf.generateAndSend(
      res,
      docDefinition,
      `permission_${permission._id}_${new Date().toISOString().split('T')[0]}.pdf`,
    );
  }

  /**
   * Export sequence configurations to Excel
   */
  static async exportSequenceConfigsToExcel(
    res: Response,
    filters: ExportFilters = {},
  ): Promise<void> {
    const excel = new ExcelUtil('Sequence Configurations');

    // Define column structure first (for column count)
    const columns = [
      { header: 'Config ID', key: '_id', width: 25 },
      { header: 'Category', key: 'category', width: 25 },
      { header: 'Subcategory', key: 'subcategory', width: 25 },
      { header: 'Sequence Prefix', key: 'prefix', width: 20 },
      { header: 'Current Sequence', key: 'current', width: 18 },
      { header: 'Starting Number', key: 'starting', width: 18 },
      { header: 'Format', key: 'format', width: 20 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Created By', key: 'createdBy', width: 20 },
      { header: 'Created Date', key: 'createdAt', width: 20 },
    ];

    // Add filter/sort header first and get the data start row
    const sortBy = filters.sortBy || 'created_at';
    const sortOrder = filters.sortOrder || 'desc';
    const dataStartRow = excel.addFilterSortHeader(
      filters,
      sortBy,
      sortOrder,
      undefined,
      columns.length,
    );

    // Define columns with headers at the correct row (after filter header)
    excel.setColumns(columns, dataStartRow);

    const query: Record<string, unknown> = {};
    if (filters.search) {
      query.$or = [
        { sequence_prefix: { $regex: filters.search, $options: 'i' } },
        { format: { $regex: filters.search, $options: 'i' } },
      ];
    }
    if (filters.category_id) query.category_id = filters.category_id;
    if (filters.subcategory_id) query.subcategory_id = filters.subcategory_id;
    if (typeof filters.is_active === 'boolean') {
      query.is_active = filters.is_active;
    }

    // Apply sorting (already set above)
    const sort: Record<string, number> = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const sequences = await SequenceManagement.find(query)
      .populate('category_id', 'name')
      .populate('subcategory_id', 'name')
      .populate('created_by', 'username email')
      .sort(sort)
      .lean();

    for (const seq of sequences) {
      const rowData: Record<string, unknown> = {
        _id: seq._id?.toString() || '-',
        category:
          (seq.category_id as Record<string, unknown>)?.name ||
          (typeof seq.category_id === 'string' ? seq.category_id : '-'),
        subcategory:
          (seq.subcategory_id as Record<string, unknown>)?.name ||
          (typeof seq.subcategory_id === 'string' ? seq.subcategory_id : '-'),
        prefix: seq.sequence_prefix || '-',
        current: seq.current_sequence?.toString() || '0',
        starting: seq.starting_number?.toString() || '1',
        format: seq.format || '-',
        status: seq.is_active ? 'Active' : 'Inactive',
        createdBy:
          (seq.created_by as Record<string, unknown>)?.username ||
          (typeof seq.created_by === 'string' ? seq.created_by : '-'),
        createdAt: seq.created_at
          ? new Date(seq.created_at).toLocaleString()
          : '-',
      };

      const rowNumber = excel.addRow(rowData);

      // Apply status style
      excel.applyStatusStyle(
        rowNumber,
        'status',
        seq.is_active ? 'active' : 'inactive',
      );
    }

    // Add export info sheet with filters and sort
    excel.addExportInfoSheet(filters, sortBy, sortOrder, sequences.length);

    await excel.generateAndSend(
      res,
      `sequence_configs_export_${new Date().toISOString().split('T')[0]}.xlsx`,
    );
  }

  /**
   * Export sequence configuration to PDF (individual)
   */
  static async exportSequenceConfigToPdf(
    res: Response,
    sequenceId: string,
  ): Promise<void> {
    const pdf = new PdfUtil();
    const styles = pdf.getDefaultStyles();

    const sequence = await SequenceManagement.findById(sequenceId)
      .populate('category_id', 'name')
      .populate('subcategory_id', 'name')
      .populate('created_by', 'username email')
      .lean();

    if (!sequence) {
      throw new Error('Sequence configuration not found');
    }

    const content: unknown[] = [
      { text: 'Sequence Configuration Details', style: 'header' },
      { text: '\n' },
      {
        text: [
          { text: 'Config ID: ', style: 'label' },
          { text: sequence._id?.toString() || 'N/A', style: 'value' },
        ],
      },
      {
        text: [
          { text: 'Category: ', style: 'label' },
          {
            text:
              (sequence.category_id as Record<string, unknown>)?.name ||
              (typeof sequence.category_id === 'string'
                ? sequence.category_id
                : 'N/A'),
            style: 'value',
          },
        ],
      },
      {
        text: [
          { text: 'Subcategory: ', style: 'label' },
          {
            text:
              (sequence.subcategory_id as Record<string, unknown>)?.name ||
              (typeof sequence.subcategory_id === 'string'
                ? sequence.subcategory_id
                : 'N/A'),
            style: 'value',
          },
        ],
      },
      {
        text: [
          { text: 'Sequence Prefix: ', style: 'label' },
          { text: sequence.sequence_prefix || 'N/A', style: 'value' },
        ],
      },
      {
        text: [
          { text: 'Current Sequence: ', style: 'label' },
          {
            text: sequence.current_sequence?.toString() || '0',
            style: 'value',
          },
        ],
      },
      {
        text: [
          { text: 'Starting Number: ', style: 'label' },
          {
            text: sequence.starting_number?.toString() || '1',
            style: 'value',
          },
        ],
      },
      {
        text: [
          { text: 'Format: ', style: 'label' },
          { text: sequence.format || 'N/A', style: 'value' },
        ],
      },
      {
        text: [
          { text: 'Status: ', style: 'label' },
          pdf.formatStatusBadge(sequence.is_active ? 'active' : 'inactive'),
        ],
      },
      {
        text: [
          { text: 'Created By: ', style: 'label' },
          {
            text:
              (sequence.created_by as Record<string, unknown>)?.username ||
              (typeof sequence.created_by === 'string'
                ? sequence.created_by
                : 'N/A'),
            style: 'value',
          },
        ],
      },
      {
        text: [
          { text: 'Created Date: ', style: 'label' },
          {
            text: pdf.formatDate(sequence.created_at),
            style: 'value',
          },
        ],
      },
    ];

    const docDefinition: TDocumentDefinitions = {
      content,
      styles,
      defaultStyle: {
        font: 'Roboto',
      },
    };

    await pdf.generateAndSend(
      res,
      docDefinition,
      `sequence_config_${sequence._id}_${new Date().toISOString().split('T')[0]}.pdf`,
    );
  }

  /**
   * Export user approvals to Excel (approval_management - users tab)
   */
  static async exportUserApprovalsToExcel(
    res: Response,
    filters: ExportFilters = {},
  ): Promise<void> {
    const excel = new ExcelUtil('User Approvals');

    // Define column structure first (for column count)
    const columns = [
      { header: 'User ID', key: '_id', width: 25 },
      { header: 'Username', key: 'username', width: 20 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Role', key: 'role', width: 20 },
      { header: 'Requested Date', key: 'createdAt', width: 20 },
    ];

    // Add filter/sort header first and get the data start row
    const sortBy = filters.sortBy || 'createdAt';
    const sortOrder = filters.sortOrder || 'desc';
    const dataStartRow = excel.addFilterSortHeader(
      filters,
      sortBy,
      sortOrder,
      undefined,
      columns.length,
    );

    // Define columns with headers at the correct row (after filter header)
    excel.setColumns(columns, dataStartRow);

    // Fetch pending users (users awaiting approval)
    const query: Record<string, unknown> = { isApproved: false };
    if (filters.search) {
      query.$or = [
        { username: { $regex: filters.search, $options: 'i' } },
        { email: { $regex: filters.search, $options: 'i' } },
      ];
    }
    if (filters.role) query.role = filters.role;

    // Apply sorting
    const sort: Record<string, number> = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const users = await User.find(query)
      .populate('role', 'name')
      .sort(sort)
      .lean();

    // Add data rows
    for (const user of users) {
      const rowData: Record<string, unknown> = {
        _id: user._id?.toString() || '-',
        username: user.username || '-',
        email: user.email || '-',
        role:
          (user.role as Record<string, unknown>)?.name ||
          (typeof user.role === 'string' ? user.role : '-'),
        createdAt: user.createdAt
          ? new Date(user.createdAt).toLocaleString()
          : '-',
      };

      excel.addRow(rowData);
    }

    // Add export info sheet with filters and sort
    excel.addExportInfoSheet(filters, sortBy, sortOrder, users.length);

    await excel.generateAndSend(
      res,
      `user_approvals_export_${new Date().toISOString().split('T')[0]}.xlsx`,
    );
  }

  /**
   * Export machine approvals to Excel (approval_management - machines tab)
   */
  static async exportMachineApprovalsForApprovalPageToExcel(
    res: Response,
    filters: ExportFilters = {},
  ): Promise<void> {
    const excel = new ExcelUtil('Machine Approvals');

    // Define column structure first (for column count)
    const columns = [
      { header: 'Approval ID', key: '_id', width: 25 },
      { header: 'Machine Name', key: 'machineName', width: 30 },
      { header: 'Machine Sequence', key: 'machineSequence', width: 20 },
      { header: 'Approval Type', key: 'approvalType', width: 20 },
      { header: 'Requested By', key: 'requestedBy', width: 25 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Created Date', key: 'createdAt', width: 20 },
    ];

    // Add filter/sort header first and get the data start row
    const sortBy = filters.sortBy || 'createdAt';
    const sortOrder = filters.sortOrder || 'desc';
    const dataStartRow = excel.addFilterSortHeader(
      filters,
      sortBy,
      sortOrder,
      undefined,
      columns.length,
    );

    // Define columns with headers at the correct row (after filter header)
    excel.setColumns(columns, dataStartRow);

    // Build query
    const query: Record<string, unknown> = {};
    if (filters.status) query.status = filters.status;
    if (filters.approvalType) query.approvalType = filters.approvalType;
    if (filters.search) {
      query.$or = [{ requestNotes: { $regex: filters.search, $options: 'i' } }];
    }

    // Apply sorting
    const sort: Record<string, number> = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const approvals = await MachineApproval.find(query)
      .populate('machineId', 'name machine_sequence')
      .populate('requestedBy', 'username email')
      .sort(sort)
      .lean();

    for (const approval of approvals) {
      const machine = approval.machineId as Record<string, unknown>;
      const rowData: Record<string, unknown> = {
        _id: approval._id?.toString() || '-',
        machineName: machine?.name || '-',
        machineSequence: machine?.machine_sequence || '-',
        approvalType: approval.approvalType || '-',
        requestedBy:
          (approval.requestedBy as Record<string, unknown>)?.username ||
          (typeof approval.requestedBy === 'string'
            ? approval.requestedBy
            : '-'),
        status: approval.status || 'PENDING',
        createdAt: approval.createdAt
          ? new Date(approval.createdAt).toLocaleString()
          : '-',
      };

      const rowNumber = excel.addRow(rowData);

      // Apply status style
      excel.applyStatusStyle(
        rowNumber,
        'status',
        (approval.status || 'pending').toLowerCase(),
      );
    }

    // Add export info sheet with filters and sort
    excel.addExportInfoSheet(filters, sortBy, sortOrder, approvals.length);

    await excel.generateAndSend(
      res,
      `machine_approvals_for_approval_page_export_${new Date().toISOString().split('T')[0]}.xlsx`,
    );
  }
}
