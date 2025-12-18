/**
 * Verification script to check sub-admin permissions
 * Usage: ts-node src/scripts/verify-sub-admin-permissions.ts
 */

import mongoose from 'mongoose';
import { Role } from '../models/role.model';
import { PermissionConfig, ActionType } from '../models/permissionConfig.model';

// Use the same environment variable as the app
const MONGODB_URI =
  process.env['MONGO_URI'] ||
  process.env['MONGODB_URI'] ||
  'mongodb://localhost:27017/fluidpack';

async function verifyPermissions(): Promise<void> {
  try {
    await mongoose.connect(MONGODB_URI);
    const dbName = mongoose.connection.db?.databaseName;
    console.log(`✅ Connected to MongoDB`);
    console.log(`📊 Database: ${dbName || 'unknown'}\n`);

    // Find sub-admin role
    const subAdminRole = await Role.findOne({ name: 'sub-admin' });
    if (!subAdminRole) {
      console.error('❌ Sub-admin role not found!');
      process.exit(1);
    }

    console.log(
      `✅ Found sub-admin role: "${subAdminRole.name}" (ID: ${subAdminRole._id})\n`,
    );

    // Check all VIEW permissions
    const viewActions = [
      ActionType.VIEW_SO,
      ActionType.VIEW_MACHINE,
      ActionType.VIEW_QC_ENTRY,
      ActionType.VIEW_QC_APPROVAL,
    ];

    console.log('📋 Checking VIEW permissions (should be ALLOWED):');
    for (const action of viewActions) {
      const permission = await PermissionConfig.findOne({
        action,
        roleIds: subAdminRole._id,
        isActive: true,
      }).lean();

      if (permission) {
        console.log(
          `   ✅ ${action}: ${permission.permission} (Priority: ${permission.priority})`,
        );
      } else {
        console.log(`   ❌ ${action}: NOT FOUND`);
      }
    }

    // Check CREATE_SO permission
    console.log(
      '\n📋 Checking CREATE_SO permission (should be REQUIRES_APPROVAL):',
    );
    const createSoPermission = await PermissionConfig.findOne({
      action: ActionType.CREATE_SO,
      roleIds: subAdminRole._id,
      isActive: true,
    })
      .populate('approverRoles', 'name')
      .lean();

    if (createSoPermission) {
      console.log(`   ✅ CREATE_SO: ${createSoPermission.permission}`);
      if (createSoPermission.approverRoles) {
        const approvers = Array.isArray(createSoPermission.approverRoles)
          ? createSoPermission.approverRoles
          : [createSoPermission.approverRoles];
        const approverNames = approvers
          .map((r: unknown) => {
            const role = r as { name?: string };
            return role?.name || 'unknown';
          })
          .join(', ');
        console.log(`   📝 Approver Roles: ${approverNames}`);
      }
    } else {
      console.log('   ❌ CREATE_SO: NOT FOUND');
    }

    // Count total permissions
    const totalPermissions = await PermissionConfig.countDocuments({
      roleIds: subAdminRole._id,
      isActive: true,
    });

    console.log(
      `\n📊 Total active permissions for sub-admin: ${totalPermissions}`,
    );

    // List all permissions
    const allPermissions = await PermissionConfig.find({
      roleIds: subAdminRole._id,
      isActive: true,
    })
      .select('action permission priority')
      .sort({ action: 1 })
      .lean();

    console.log('\n📋 All permissions for sub-admin:');
    allPermissions.forEach((perm) => {
      const status =
        perm.permission === 'ALLOWED'
          ? '✅'
          : perm.permission === 'REQUIRES_APPROVAL'
            ? '⚠️'
            : '❌';
      console.log(`   ${status} ${perm.action}: ${perm.permission}`);
    });

    console.log('\n✅ Verification complete!\n');
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  }
}

verifyPermissions()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
