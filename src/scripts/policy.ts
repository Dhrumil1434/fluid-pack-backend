export type Action =
  | 'CREATE_MACHINE'
  | 'EDIT_MACHINE'
  | 'DELETE_MACHINE'
  | 'APPROVE_MACHINE'
  | 'VIEW_MACHINE'
  | 'CREATE_QC_ENTRY'
  | 'EDIT_QC_ENTRY'
  | 'DELETE_QC_ENTRY'
  | 'VIEW_QC_ENTRY'
  | 'CREATE_QC_APPROVAL'
  | 'EDIT_QC_APPROVAL'
  | 'DELETE_QC_APPROVAL'
  | 'VIEW_QC_APPROVAL'
  | 'APPROVE_QC_APPROVAL'
  | 'ACTIVATE_MACHINE'
  | 'VIEW_SO';

export type Permission = 'ALLOWED' | 'REQUIRES_APPROVAL' | 'DENIED';

export interface Policy {
  roles: string[];
  departments: string[];
  approvers: {
    defaultRoles: string[];
    perDepartment?: Record<string, string[]>;
  };
  rules: Array<{
    name: string;
    description?: string;
    action: Action;
    permission: Permission;
    roles?: string[];
    users?: string[]; // usernames or emails; best-effort resolution
    departments?: string[];
    categories?: string[];
    maxValue?: number;
    useDepartmentApprovers?: boolean;
    approverRoles?: string[];
    priority: number;
    isActive?: boolean;
  }>;
  overrides?: Array<{
    type: 'user-allow' | 'user-deny';
    action: Action;
    user: string; // username or email
    department?: string;
    priority?: number; // default 100
  }>;
}

export const defaultPolicy: Policy = {
  roles: ['admin', 'manager1', 'technician', 'qc', 'sub-admin'],
  departments: ['dispatch', 'qa'],
  approvers: {
    defaultRoles: ['admin'],
    perDepartment: {
      dispatch: ['admin', 'manager1'],
      qa: ['admin', 'qc'],
    },
  },
  rules: [
    {
      name: 'Global view allowed',
      action: 'VIEW_MACHINE',
      permission: 'ALLOWED',
      priority: 10,
    },

    // Technician baseline
    {
      name: 'Technician create',
      action: 'CREATE_MACHINE',
      roles: ['technician'],
      permission: 'ALLOWED',
      priority: 60,
    },
    {
      name: 'Technician view',
      action: 'VIEW_MACHINE',
      roles: ['technician'],
      permission: 'ALLOWED',
      priority: 60,
    },
    {
      name: 'Technician edit',
      action: 'EDIT_MACHINE',
      roles: ['technician'],
      permission: 'ALLOWED',
      priority: 60,
    },
    {
      name: 'Technician view SO',
      action: 'VIEW_SO',
      roles: ['technician'],
      permission: 'ALLOWED',
      priority: 60,
    },

    // Manager approval in department (value-capped)
    {
      name: 'Dispatch manager approve <= 50k',
      action: 'APPROVE_MACHINE',
      roles: ['manager1'],
      departments: ['dispatch'],
      permission: 'ALLOWED',
      maxValue: 50000,
      priority: 70,
    },
    {
      name: 'Manager create requires approval',
      action: 'CREATE_MACHINE',
      roles: ['manager1'],
      permission: 'REQUIRES_APPROVAL',
      useDepartmentApprovers: true,
      priority: 65,
    },

    // Risk control
    {
      name: 'Dispatch deny delete',
      action: 'DELETE_MACHINE',
      departments: ['dispatch'],
      permission: 'DENIED',
      priority: 80,
    },

    // QC Role Permissions
    {
      name: 'QC view machines',
      action: 'VIEW_MACHINE',
      roles: ['qc'],
      permission: 'ALLOWED',
      priority: 60,
    },
    {
      name: 'QC create QC entries',
      action: 'CREATE_QC_ENTRY',
      roles: ['qc'],
      permission: 'ALLOWED',
      priority: 60,
    },
    {
      name: 'QC view QC entries',
      action: 'VIEW_QC_ENTRY',
      roles: ['qc'],
      permission: 'ALLOWED',
      priority: 60,
    },
    {
      name: 'QC edit QC entries',
      action: 'EDIT_QC_ENTRY',
      roles: ['qc'],
      permission: 'ALLOWED',
      priority: 60,
    },
    {
      name: 'QC delete QC entries',
      action: 'DELETE_QC_ENTRY',
      roles: ['qc'],
      permission: 'ALLOWED',
      priority: 60,
    },
    {
      name: 'QC create QC approvals',
      action: 'CREATE_QC_APPROVAL',
      roles: ['qc'],
      permission: 'ALLOWED',
      priority: 60,
    },
    {
      name: 'QC view QC approvals',
      action: 'VIEW_QC_APPROVAL',
      roles: ['qc'],
      permission: 'ALLOWED',
      priority: 60,
    },
    {
      name: 'QC edit QC approvals',
      action: 'EDIT_QC_APPROVAL',
      roles: ['qc'],
      permission: 'ALLOWED',
      priority: 60,
    },
    {
      name: 'QC delete QC approvals',
      action: 'DELETE_QC_APPROVAL',
      roles: ['qc'],
      permission: 'ALLOWED',
      priority: 60,
    },
    {
      name: 'QC approve QC approvals',
      action: 'APPROVE_QC_APPROVAL',
      roles: ['qc'],
      permission: 'ALLOWED',
      priority: 60,
    },
    {
      name: 'QC activate machines',
      action: 'ACTIVATE_MACHINE',
      roles: ['qc'],
      permission: 'ALLOWED',
      priority: 60,
    },

    // Sub-admin read-only QC views (no edits/creates)
    {
      name: 'Sub-admin view QC entries',
      action: 'VIEW_QC_ENTRY',
      roles: ['sub-admin'],
      permission: 'ALLOWED',
      priority: 50,
    },
    {
      name: 'Sub-admin view QC approvals',
      action: 'VIEW_QC_APPROVAL',
      roles: ['sub-admin'],
      permission: 'ALLOWED',
      priority: 50,
    },
    // Admin can do all QC operations
    {
      name: 'Admin QC operations',
      action: 'CREATE_QC_ENTRY',
      roles: ['admin'],
      permission: 'ALLOWED',
      priority: 80,
    },
    {
      name: 'Admin QC operations',
      action: 'VIEW_QC_ENTRY',
      roles: ['admin'],
      permission: 'ALLOWED',
      priority: 80,
    },
    {
      name: 'Admin QC operations',
      action: 'EDIT_QC_ENTRY',
      roles: ['admin'],
      permission: 'ALLOWED',
      priority: 80,
    },
    {
      name: 'Admin QC operations',
      action: 'DELETE_QC_ENTRY',
      roles: ['admin'],
      permission: 'ALLOWED',
      priority: 80,
    },
    {
      name: 'Admin QC operations',
      action: 'CREATE_QC_APPROVAL',
      roles: ['admin'],
      permission: 'ALLOWED',
      priority: 80,
    },
    {
      name: 'Admin QC operations',
      action: 'VIEW_QC_APPROVAL',
      roles: ['admin'],
      permission: 'ALLOWED',
      priority: 80,
    },
    {
      name: 'Admin QC operations',
      action: 'EDIT_QC_APPROVAL',
      roles: ['admin'],
      permission: 'ALLOWED',
      priority: 80,
    },
    {
      name: 'Admin QC operations',
      action: 'DELETE_QC_APPROVAL',
      roles: ['admin'],
      permission: 'ALLOWED',
      priority: 80,
    },
    {
      name: 'Admin QC operations',
      action: 'APPROVE_QC_APPROVAL',
      roles: ['admin'],
      permission: 'ALLOWED',
      priority: 80,
    },
    {
      name: 'Admin QC operations',
      action: 'ACTIVATE_MACHINE',
      roles: ['admin'],
      permission: 'ALLOWED',
      priority: 80,
    },
    // Global deny write safety nets
    {
      name: 'Global deny create',
      action: 'CREATE_MACHINE',
      permission: 'DENIED',
      priority: 1,
    },
    {
      name: 'Global deny edit',
      action: 'EDIT_MACHINE',
      permission: 'DENIED',
      priority: 1,
    },
    {
      name: 'Global deny delete',
      action: 'DELETE_MACHINE',
      permission: 'DENIED',
      priority: 1,
    },
    // Global deny QC operations for non-QC roles
    {
      name: 'Global deny QC operations',
      action: 'CREATE_QC_ENTRY',
      permission: 'DENIED',
      priority: 1,
    },
    {
      name: 'Global deny QC operations',
      action: 'EDIT_QC_ENTRY',
      permission: 'DENIED',
      priority: 1,
    },
    {
      name: 'Global deny QC operations',
      action: 'DELETE_QC_ENTRY',
      permission: 'DENIED',
      priority: 1,
    },
    {
      name: 'Global deny QC operations',
      action: 'CREATE_QC_APPROVAL',
      permission: 'DENIED',
      priority: 1,
    },
    {
      name: 'Global deny QC operations',
      action: 'EDIT_QC_APPROVAL',
      permission: 'DENIED',
      priority: 1,
    },
    {
      name: 'Global deny QC operations',
      action: 'DELETE_QC_APPROVAL',
      permission: 'DENIED',
      priority: 1,
    },
    {
      name: 'Global deny QC operations',
      action: 'APPROVE_QC_APPROVAL',
      permission: 'DENIED',
      priority: 1,
    },
    {
      name: 'Global deny QC operations',
      action: 'ACTIVATE_MACHINE',
      permission: 'DENIED',
      priority: 1,
    },
  ],
  overrides: [
    // Examples; will be skipped if user not found
    {
      type: 'user-deny',
      action: 'CREATE_MACHINE',
      user: 'tech1@company.com',
      department: 'dispatch',
      priority: 100,
    },
    {
      type: 'user-allow',
      action: 'EDIT_MACHINE',
      user: 'tech2@company.com',
      priority: 100,
    },
  ],
};
