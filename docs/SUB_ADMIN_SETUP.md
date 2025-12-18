# Sub-Admin Role Setup Guide

This document explains how to set up and use the sub-admin role feature, which allows sub-admin users to access the admin dashboard with read-only permissions and create SO records that require admin approval.

## Overview

The sub-admin role provides:

- **Read-only access** to the admin dashboard (view SO, machines, etc.)
- **SO creation** with automatic approval workflow
- **No edit/delete permissions** for SO records

## Setup Steps

### 1. Create Sub-Admin Role (if not already created)

The sub-admin role should already be created via the UI. If not, you can create it using the admin panel or directly in the database.

### 2. Run the Setup Script

Run the setup script to configure permissions for the sub-admin role:

```bash
# Using npm
npm run setup-sub-admin-permissions

# Or directly with ts-node
npx ts-node src/scripts/setup-sub-admin-permissions.ts
```

This script will:

- Verify/create the sub-admin role
- Configure VIEW permissions (ALLOWED)
- Configure CREATE_SO permission (REQUIRES_APPROVAL)
- Configure EDIT/UPDATE/DELETE_SO permissions (DENIED)

### 3. Assign Sub-Admin Role to Users

Assign the sub-admin role to users via the admin panel or directly update the user's role in the database.

## How It Works

### Sub-Admin SO Creation Flow

1. **Sub-admin creates SO**: When a sub-admin user creates an SO record:

   - The SO is created successfully
   - An approval request is automatically created
   - The SO is set to `is_active: false` (inactive) until approved
   - Admin users receive notification (if notifications are configured)

2. **Admin reviews approval**: Admin users can:

   - View pending SO approvals at `/api/so-approvals/pending`
   - Approve or reject the SO creation
   - Add approval notes or rejection reasons

3. **After approval**:
   - If approved: SO is activated (`is_active: true`)
   - If rejected: SO remains inactive, sub-admin can see rejection reason

### API Endpoints

#### SO Approval Endpoints

- `POST /api/so-approvals` - Create approval request (automatically called when sub-admin creates SO)
- `GET /api/so-approvals` - Get all approval requests
- `GET /api/so-approvals/pending` - Get pending approvals for current user's role
- `GET /api/so-approvals/my-requests` - Get current user's approval requests
- `GET /api/so-approvals/:id` - Get approval by ID
- `PATCH /api/so-approvals/:id/process` - Process approval (approve/reject) - Admin only
- `PATCH /api/so-approvals/:id/cancel` - Cancel approval request

#### Example: Process Approval

```bash
# Approve an SO
curl -X PATCH http://localhost:3000/api/so-approvals/:id/process \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "approved": true,
    "approverNotes": "Approved after review"
  }'

# Reject an SO
curl -X PATCH http://localhost:3000/api/so-approvals/:id/process \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "approved": false,
    "rejectionReason": "Missing required information"
  }'
```

## Permission Configuration

The setup script creates the following permission configurations:

| Action       | Permission Level  | Description                                         |
| ------------ | ----------------- | --------------------------------------------------- |
| VIEW_SO      | ALLOWED           | Sub-admin can view SO records                       |
| VIEW_MACHINE | ALLOWED           | Sub-admin can view machine records                  |
| CREATE_SO    | REQUIRES_APPROVAL | Sub-admin can create SO but requires admin approval |
| EDIT_SO      | DENIED            | Sub-admin cannot edit SO records                    |
| UPDATE_SO    | DENIED            | Sub-admin cannot update SO records                  |
| DELETE_SO    | DENIED            | Sub-admin cannot delete SO records                  |

## Frontend Integration

### Admin Guard

The admin guard has been updated to allow sub-admin users to access the admin dashboard:

```typescript
// front-end/src/app/core/guards/admin.guard.ts
const isAdmin =
  userRole === 'admin' || userRole === 'manager' || userRole === 'sub-admin';
```

### Login Redirect

The login component redirects sub-admin users to the admin dashboard:

```typescript
// front-end/src/app/modules/auth/components/login.component.ts
const isAdmin =
  roleName === 'admin' || roleName === 'manager' || roleName === 'sub-admin';
```

## Database Schema

### SO Approval Model

```typescript
interface ISOApproval {
  soId: ObjectId; // Reference to SO
  requestedBy: ObjectId; // Sub-admin who created the SO
  approvalType: SOApprovalType; // SO_CREATION, SO_EDIT, SO_DELETION
  status: SOApprovalStatus; // PENDING, APPROVED, REJECTED, CANCELLED
  approverRoles?: ObjectId[]; // Roles that can approve (admin)
  proposedChanges: Record<string, unknown>;
  approvedBy?: ObjectId;
  rejectedBy?: ObjectId;
  approvalDate?: Date;
  rejectionReason?: string;
  requestNotes?: string;
  approverNotes?: string;
}
```

## Testing

### Test Sub-Admin Flow

1. **Create a sub-admin user**:

   ```bash
   # Via API or admin panel
   POST /api/user/register
   {
     "username": "subadmin1",
     "email": "subadmin@example.com",
     "password": "password123",
     "role": "<sub-admin-role-id>",
     "department": "<department-id>"
   }
   ```

2. **Login as sub-admin**:

   ```bash
   POST /api/user/login
   {
     "email": "subadmin@example.com",
     "password": "password123"
   }
   ```

3. **Create an SO** (will require approval):

   ```bash
   POST /api/so
   # ... SO data ...
   ```

4. **Login as admin and approve**:
   ```bash
   GET /api/so-approvals/pending
   PATCH /api/so-approvals/:id/process
   {
     "approved": true
   }
   ```

## Troubleshooting

### Sub-admin cannot access admin dashboard

- Verify the user has the sub-admin role assigned
- Check that the admin guard allows sub-admin (should include `userRole === 'sub-admin'`)
- Verify the login redirect logic includes sub-admin

### SO creation not creating approval request

- Verify the user's role is exactly "sub-admin" (case-insensitive)
- Check that admin role exists in database
- Verify SO approval service is properly imported

### Permission denied errors

- Run the setup script to ensure permissions are configured
- Check that permission configs are active (`isActive: true`)
- Verify the permission middleware allows VIEW actions for sub-admin

## Notes

- Sub-admin users share the same dashboard as admin but with read-only access
- SO records created by sub-admin are inactive until approved
- Admin users can view and process all pending SO approvals
- The approval workflow is similar to the machine approval workflow
