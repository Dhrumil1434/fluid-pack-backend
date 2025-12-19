/**
 * Setup script for sub-admin role permissions
 *
 * This script configures permissions for the sub-admin role:
 * - Allows VIEW actions (read-only access)
 * - Requires approval for CREATE_SO action
 * - Allows EDIT_SO and UPDATE_SO (for non-activated SOs only)
 * - Denies DELETE and other actions
 *
 * Usage: npm run setup-sub-admin-permissions
 * or: ts-node src/scripts/setup-sub-admin-permissions.ts
 */

import mongoose from 'mongoose';
import { Role } from '../models/role.model';
import {
  PermissionConfig,
  ActionType,
  PermissionLevel,
} from '../models/permissionConfig.model';
import { User } from '../models/user.model';

// Use the same environment variable as the app (MONGO_URI)
// Fallback to MONGODB_URI for backward compatibility
const MONGODB_URI =
  process.env['MONGO_URI'] ||
  process.env['MONGODB_URI'] ||
  'mongodb://localhost:27017/fluidpack';

async function connectDB(): Promise<void> {
  try {
    await mongoose.connect(MONGODB_URI);
    const dbName = mongoose.connection.db?.databaseName;
    console.log(`✅ Connected to MongoDB`);
    console.log(`📊 Database: ${dbName || 'unknown'}`);
    console.log(
      `🔗 Connection: ${MONGODB_URI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}`,
    );
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    console.error(
      `❌ Attempted to connect to: ${MONGODB_URI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}`,
    );
    process.exit(1);
  }
}

async function getAdminUserId(
  adminRoleId?: mongoose.Types.ObjectId,
): Promise<string> {
  // First, try to find user by email (most reliable)
  const userByEmail = await User.findOne({
    email: 'admin@company.com',
  })
    .select('_id email username role isApproved')
    .populate('role', 'name')
    .lean();

  if (userByEmail?._id) {
    const userRole = userByEmail.role as
      | { name?: string; _id?: unknown }
      | string;
    const roleName =
      typeof userRole === 'object' && userRole !== null ? userRole.name : null;

    if (roleName?.toLowerCase() === 'admin') {
      const approvalStatus = userByEmail.isApproved
        ? 'approved'
        : 'not approved';
      console.log(
        `✅ Found admin user by email: ${userByEmail.email} (ID: ${userByEmail._id}, ${approvalStatus})`,
      );
      return userByEmail._id.toString();
    } else {
      console.log(
        `⚠️  Found user ${userByEmail.email} but role is "${roleName}", not admin.`,
      );
    }
  }

  // If we have adminRoleId, try to find user by role
  if (adminRoleId) {
    // Try to find approved admin user first
    let adminUser = await User.findOne({
      role: adminRoleId,
      isApproved: true,
    })
      .select('_id email username')
      .lean();

    if (adminUser?._id) {
      console.log(
        `✅ Found approved admin user: ${adminUser.email || adminUser.username} (ID: ${adminUser._id})`,
      );
      return adminUser._id.toString();
    }

    // Try to find any admin user (even if not approved)
    adminUser = await User.findOne({ role: adminRoleId })
      .select('_id email username isApproved')
      .lean();

    if (adminUser?._id) {
      console.log(
        `⚠️  Found admin user but not approved: ${adminUser.email || adminUser.username} (ID: ${adminUser._id})`,
      );
      console.log('   Using this user ID for createdBy field.');
      return adminUser._id.toString();
    }
  }

  // If no admin user found, create a dummy ObjectId for createdBy
  // This allows the script to run even without an admin user
  console.log(
    '⚠️  No admin user found. Using system user ID for createdBy field.',
  );
  return new mongoose.Types.ObjectId().toString();
}

async function setupSubAdminPermissions(): Promise<void> {
  try {
    await connectDB();

    // Find sub-admin role
    const subAdminRole = await Role.findOne({ name: 'sub-admin' });
    if (!subAdminRole) {
      console.log('⚠️  Sub-admin role not found. Creating it...');
      const newSubAdminRole = new Role({
        name: 'sub-admin',
        description:
          'Sub-admin role with read-only access and approval-required for SO creation',
      });
      await newSubAdminRole.save();
      console.log('✅ Created sub-admin role');
    } else {
      console.log('✅ Sub-admin role found');
    }

    // Get sub-admin role ID (refresh query after potential creation)
    const finalSubAdminRole = await Role.findOne({ name: 'sub-admin' });
    if (!finalSubAdminRole) {
      throw new Error('Failed to get sub-admin role ID');
    }
    const subAdminRoleId = finalSubAdminRole._id;

    // Try to find admin role
    // Role names are stored lowercase per schema (lowercase: true)
    let adminRole = await Role.findOne({ name: 'admin' });

    // If not found with exact match, try case-insensitive
    if (!adminRole) {
      adminRole = await Role.findOne({
        name: { $regex: /^admin$/i },
      });
    }

    // If still not found, try to find admin user by email and get role from there
    if (!adminRole) {
      console.log(
        '⚠️  Admin role not found by name. Trying to find via admin user...',
      );
      const adminUserByEmail = await User.findOne({
        email: 'admin@company.com',
      })
        .populate('role')
        .lean();

      if (adminUserByEmail?.role) {
        const userRole = adminUserByEmail.role as
          | { _id?: unknown; name?: string }
          | string;
        if (typeof userRole === 'object' && userRole !== null && userRole._id) {
          adminRole = await Role.findById(userRole._id);
          if (adminRole) {
            console.log(
              `✅ Found admin role via user: "${adminRole.name}" (ID: ${adminRole._id})`,
            );
          }
        }
      }
    }

    // If still not found, create the admin role
    if (!adminRole) {
      console.log('⚠️  Admin role not found. Creating admin role...');
      try {
        adminRole = new Role({
          name: 'admin',
          description: 'Administrator role with full access',
        });
        await adminRole.save();
        console.log(
          `✅ Created admin role: "${adminRole.name}" (ID: ${adminRole._id})`,
        );
      } catch {
        // If creation fails (e.g., duplicate), try to find it again
        adminRole = await Role.findOne({ name: 'admin' });
        if (!adminRole) {
          // Debug: List all existing roles
          const allRoles = await Role.find({}).select('name _id').lean();
          console.error('\n❌ Failed to create admin role.');
          console.error('📋 Existing roles in database:');
          if (allRoles.length === 0) {
            console.error('   (No roles found)');
          } else {
            allRoles.forEach((role) => {
              console.error(`   - "${role.name}" (ID: ${role._id})`);
            });
          }

          // Also check users
          const adminUsers = await User.find({ email: 'admin@company.com' })
            .populate('role', 'name')
            .select('email role')
            .lean();
          if (adminUsers.length > 0) {
            console.error('\n📋 Found user(s) with email admin@company.com:');
            adminUsers.forEach((user) => {
              const role = user.role as { name?: string } | string;
              const roleName =
                typeof role === 'object' && role !== null
                  ? role.name
                  : 'unknown';
              console.error(`   - Email: ${user.email}, Role: "${roleName}"`);
            });
          }

          throw new Error(
            'Admin role not found and could not be created. Please create it manually.',
          );
        }
      }
    }

    console.log(
      `✅ Found admin role: "${adminRole.name}" (ID: ${adminRole._id})`,
    );

    const adminRoleId = adminRole._id as mongoose.Types.ObjectId;
    const adminUserId = await getAdminUserId(adminRoleId);

    console.log('\n📋 Setting up permissions for sub-admin role...\n');

    // ============================================================
    // VIEW PERMISSIONS (ALLOWED - Read-only access like admin)
    // ============================================================

    // 1. Allow VIEW_SO (read-only)
    await PermissionConfig.findOneAndUpdate(
      {
        action: ActionType.VIEW_SO,
        roleIds: subAdminRoleId,
        permission: PermissionLevel.ALLOWED,
      },
      {
        name: 'Sub-admin View SO',
        description: 'Allow sub-admin to view SO records',
        action: ActionType.VIEW_SO,
        roleIds: [subAdminRoleId],
        permission: PermissionLevel.ALLOWED,
        isActive: true,
        priority: 10,
        createdBy: adminUserId,
      },
      { upsert: true, new: true },
    );
    console.log('✅ Configured VIEW_SO permission (ALLOWED)');

    // 2. Allow VIEW_MACHINE (read-only)
    await PermissionConfig.findOneAndUpdate(
      {
        action: ActionType.VIEW_MACHINE,
        roleIds: subAdminRoleId,
        permission: PermissionLevel.ALLOWED,
      },
      {
        name: 'Sub-admin View Machine',
        description: 'Allow sub-admin to view machine records',
        action: ActionType.VIEW_MACHINE,
        roleIds: [subAdminRoleId],
        permission: PermissionLevel.ALLOWED,
        isActive: true,
        priority: 10,
        createdBy: adminUserId,
      },
      { upsert: true, new: true },
    );
    console.log('✅ Configured VIEW_MACHINE permission (ALLOWED)');

    // 3. Allow VIEW_QC_ENTRY (read-only)
    await PermissionConfig.findOneAndUpdate(
      {
        action: ActionType.VIEW_QC_ENTRY,
        roleIds: subAdminRoleId,
        permission: PermissionLevel.ALLOWED,
      },
      {
        name: 'Sub-admin View QC Entry',
        description: 'Allow sub-admin to view QC entry records',
        action: ActionType.VIEW_QC_ENTRY,
        roleIds: [subAdminRoleId],
        permission: PermissionLevel.ALLOWED,
        isActive: true,
        priority: 10,
        createdBy: adminUserId,
      },
      { upsert: true, new: true },
    );
    console.log('✅ Configured VIEW_QC_ENTRY permission (ALLOWED)');

    // 4. Allow VIEW_QC_APPROVAL (read-only)
    await PermissionConfig.findOneAndUpdate(
      {
        action: ActionType.VIEW_QC_APPROVAL,
        roleIds: subAdminRoleId,
        permission: PermissionLevel.ALLOWED,
      },
      {
        name: 'Sub-admin View QC Approval',
        description: 'Allow sub-admin to view QC approval records',
        action: ActionType.VIEW_QC_APPROVAL,
        roleIds: [subAdminRoleId],
        permission: PermissionLevel.ALLOWED,
        isActive: true,
        priority: 10,
        createdBy: adminUserId,
      },
      { upsert: true, new: true },
    );
    console.log('✅ Configured VIEW_QC_APPROVAL permission (ALLOWED)');

    // ============================================================
    // CREATE PERMISSIONS
    // ============================================================

    // 5. Require approval for CREATE_SO (only action sub-admin can create)
    await PermissionConfig.findOneAndUpdate(
      {
        action: ActionType.CREATE_SO,
        roleIds: subAdminRoleId,
        permission: PermissionLevel.REQUIRES_APPROVAL,
      },
      {
        name: 'Sub-admin Create SO (Requires Approval)',
        description: 'Sub-admin can create SO but requires admin approval',
        action: ActionType.CREATE_SO,
        roleIds: [subAdminRoleId],
        permission: PermissionLevel.REQUIRES_APPROVAL,
        approverRoles: [adminRole._id],
        isActive: true,
        priority: 10,
        createdBy: adminUserId,
      },
      { upsert: true, new: true },
    );
    console.log('✅ Configured CREATE_SO permission (REQUIRES_APPROVAL)');

    // ============================================================
    // DENY ALL OTHER CREATE/EDIT/UPDATE/DELETE/APPROVE ACTIONS
    // ============================================================

    // 6. Deny CREATE_MACHINE
    await PermissionConfig.findOneAndUpdate(
      {
        action: ActionType.CREATE_MACHINE,
        roleIds: subAdminRoleId,
        permission: PermissionLevel.DENIED,
      },
      {
        name: 'Sub-admin Create Machine (Denied)',
        description: 'Sub-admin cannot create machine records',
        action: ActionType.CREATE_MACHINE,
        roleIds: [subAdminRoleId],
        permission: PermissionLevel.DENIED,
        isActive: true,
        priority: 10,
        createdBy: adminUserId,
      },
      { upsert: true, new: true },
    );
    console.log('✅ Configured CREATE_MACHINE permission (DENIED)');

    // 7. Deny EDIT_MACHINE
    await PermissionConfig.findOneAndUpdate(
      {
        action: ActionType.EDIT_MACHINE,
        roleIds: subAdminRoleId,
        permission: PermissionLevel.DENIED,
      },
      {
        name: 'Sub-admin Edit Machine (Denied)',
        description: 'Sub-admin cannot edit machine records',
        action: ActionType.EDIT_MACHINE,
        roleIds: [subAdminRoleId],
        permission: PermissionLevel.DENIED,
        isActive: true,
        priority: 10,
        createdBy: adminUserId,
      },
      { upsert: true, new: true },
    );
    console.log('✅ Configured EDIT_MACHINE permission (DENIED)');

    // 8. Deny DELETE_MACHINE
    await PermissionConfig.findOneAndUpdate(
      {
        action: ActionType.DELETE_MACHINE,
        roleIds: subAdminRoleId,
        permission: PermissionLevel.DENIED,
      },
      {
        name: 'Sub-admin Delete Machine (Denied)',
        description: 'Sub-admin cannot delete machine records',
        action: ActionType.DELETE_MACHINE,
        roleIds: [subAdminRoleId],
        permission: PermissionLevel.DENIED,
        isActive: true,
        priority: 10,
        createdBy: adminUserId,
      },
      { upsert: true, new: true },
    );
    console.log('✅ Configured DELETE_MACHINE permission (DENIED)');

    // 9. Deny APPROVE_MACHINE
    await PermissionConfig.findOneAndUpdate(
      {
        action: ActionType.APPROVE_MACHINE,
        roleIds: subAdminRoleId,
        permission: PermissionLevel.DENIED,
      },
      {
        name: 'Sub-admin Approve Machine (Denied)',
        description: 'Sub-admin cannot approve machine records',
        action: ActionType.APPROVE_MACHINE,
        roleIds: [subAdminRoleId],
        permission: PermissionLevel.DENIED,
        isActive: true,
        priority: 10,
        createdBy: adminUserId,
      },
      { upsert: true, new: true },
    );
    console.log('✅ Configured APPROVE_MACHINE permission (DENIED)');

    // 10. Deny UPDATE_MACHINE_SEQUENCE
    await PermissionConfig.findOneAndUpdate(
      {
        action: ActionType.UPDATE_MACHINE_SEQUENCE,
        roleIds: subAdminRoleId,
        permission: PermissionLevel.DENIED,
      },
      {
        name: 'Sub-admin Update Machine Sequence (Denied)',
        description: 'Sub-admin cannot update machine sequence',
        action: ActionType.UPDATE_MACHINE_SEQUENCE,
        roleIds: [subAdminRoleId],
        permission: PermissionLevel.DENIED,
        isActive: true,
        priority: 10,
        createdBy: adminUserId,
      },
      { upsert: true, new: true },
    );
    console.log('✅ Configured UPDATE_MACHINE_SEQUENCE permission (DENIED)');

    // 11. Deny ACTIVATE_MACHINE
    await PermissionConfig.findOneAndUpdate(
      {
        action: ActionType.ACTIVATE_MACHINE,
        roleIds: subAdminRoleId,
        permission: PermissionLevel.DENIED,
      },
      {
        name: 'Sub-admin Activate Machine (Denied)',
        description: 'Sub-admin cannot activate machine records',
        action: ActionType.ACTIVATE_MACHINE,
        roleIds: [subAdminRoleId],
        permission: PermissionLevel.DENIED,
        isActive: true,
        priority: 10,
        createdBy: adminUserId,
      },
      { upsert: true, new: true },
    );
    console.log('✅ Configured ACTIVATE_MACHINE permission (DENIED)');

    // 12. Deny CREATE_QC_ENTRY
    await PermissionConfig.findOneAndUpdate(
      {
        action: ActionType.CREATE_QC_ENTRY,
        roleIds: subAdminRoleId,
        permission: PermissionLevel.DENIED,
      },
      {
        name: 'Sub-admin Create QC Entry (Denied)',
        description: 'Sub-admin cannot create QC entry records',
        action: ActionType.CREATE_QC_ENTRY,
        roleIds: [subAdminRoleId],
        permission: PermissionLevel.DENIED,
        isActive: true,
        priority: 10,
        createdBy: adminUserId,
      },
      { upsert: true, new: true },
    );
    console.log('✅ Configured CREATE_QC_ENTRY permission (DENIED)');

    // 13. Deny EDIT_QC_ENTRY
    await PermissionConfig.findOneAndUpdate(
      {
        action: ActionType.EDIT_QC_ENTRY,
        roleIds: subAdminRoleId,
        permission: PermissionLevel.DENIED,
      },
      {
        name: 'Sub-admin Edit QC Entry (Denied)',
        description: 'Sub-admin cannot edit QC entry records',
        action: ActionType.EDIT_QC_ENTRY,
        roleIds: [subAdminRoleId],
        permission: PermissionLevel.DENIED,
        isActive: true,
        priority: 10,
        createdBy: adminUserId,
      },
      { upsert: true, new: true },
    );
    console.log('✅ Configured EDIT_QC_ENTRY permission (DENIED)');

    // 14. Deny DELETE_QC_ENTRY
    await PermissionConfig.findOneAndUpdate(
      {
        action: ActionType.DELETE_QC_ENTRY,
        roleIds: subAdminRoleId,
        permission: PermissionLevel.DENIED,
      },
      {
        name: 'Sub-admin Delete QC Entry (Denied)',
        description: 'Sub-admin cannot delete QC entry records',
        action: ActionType.DELETE_QC_ENTRY,
        roleIds: [subAdminRoleId],
        permission: PermissionLevel.DENIED,
        isActive: true,
        priority: 10,
        createdBy: adminUserId,
      },
      { upsert: true, new: true },
    );
    console.log('✅ Configured DELETE_QC_ENTRY permission (DENIED)');

    // 15. Deny CREATE_QC_APPROVAL
    await PermissionConfig.findOneAndUpdate(
      {
        action: ActionType.CREATE_QC_APPROVAL,
        roleIds: subAdminRoleId,
        permission: PermissionLevel.DENIED,
      },
      {
        name: 'Sub-admin Create QC Approval (Denied)',
        description: 'Sub-admin cannot create QC approval records',
        action: ActionType.CREATE_QC_APPROVAL,
        roleIds: [subAdminRoleId],
        permission: PermissionLevel.DENIED,
        isActive: true,
        priority: 10,
        createdBy: adminUserId,
      },
      { upsert: true, new: true },
    );
    console.log('✅ Configured CREATE_QC_APPROVAL permission (DENIED)');

    // 16. Deny EDIT_QC_APPROVAL
    await PermissionConfig.findOneAndUpdate(
      {
        action: ActionType.EDIT_QC_APPROVAL,
        roleIds: subAdminRoleId,
        permission: PermissionLevel.DENIED,
      },
      {
        name: 'Sub-admin Edit QC Approval (Denied)',
        description: 'Sub-admin cannot edit QC approval records',
        action: ActionType.EDIT_QC_APPROVAL,
        roleIds: [subAdminRoleId],
        permission: PermissionLevel.DENIED,
        isActive: true,
        priority: 10,
        createdBy: adminUserId,
      },
      { upsert: true, new: true },
    );
    console.log('✅ Configured EDIT_QC_APPROVAL permission (DENIED)');

    // 17. Deny DELETE_QC_APPROVAL
    await PermissionConfig.findOneAndUpdate(
      {
        action: ActionType.DELETE_QC_APPROVAL,
        roleIds: subAdminRoleId,
        permission: PermissionLevel.DENIED,
      },
      {
        name: 'Sub-admin Delete QC Approval (Denied)',
        description: 'Sub-admin cannot delete QC approval records',
        action: ActionType.DELETE_QC_APPROVAL,
        roleIds: [subAdminRoleId],
        permission: PermissionLevel.DENIED,
        isActive: true,
        priority: 10,
        createdBy: adminUserId,
      },
      { upsert: true, new: true },
    );
    console.log('✅ Configured DELETE_QC_APPROVAL permission (DENIED)');

    // 18. Deny APPROVE_QC_APPROVAL
    await PermissionConfig.findOneAndUpdate(
      {
        action: ActionType.APPROVE_QC_APPROVAL,
        roleIds: subAdminRoleId,
        permission: PermissionLevel.DENIED,
      },
      {
        name: 'Sub-admin Approve QC Approval (Denied)',
        description: 'Sub-admin cannot approve QC approval records',
        action: ActionType.APPROVE_QC_APPROVAL,
        roleIds: [subAdminRoleId],
        permission: PermissionLevel.DENIED,
        isActive: true,
        priority: 10,
        createdBy: adminUserId,
      },
      { upsert: true, new: true },
    );
    console.log('✅ Configured APPROVE_QC_APPROVAL permission (DENIED)');

    // 19. Allow EDIT_SO (sub-admins can edit non-activated SOs)
    await PermissionConfig.findOneAndUpdate(
      {
        action: ActionType.EDIT_SO,
        roleIds: subAdminRoleId,
        permission: PermissionLevel.ALLOWED,
      },
      {
        name: 'Sub-admin Edit SO (Allowed)',
        description: 'Sub-admin can edit SO records (only non-activated SOs)',
        action: ActionType.EDIT_SO,
        roleIds: [subAdminRoleId],
        permission: PermissionLevel.ALLOWED,
        isActive: true,
        priority: 10,
        createdBy: adminUserId,
      },
      { upsert: true, new: true },
    );
    console.log('✅ Configured EDIT_SO permission (ALLOWED)');

    // 20. Allow UPDATE_SO (sub-admins can update non-activated SOs)
    await PermissionConfig.findOneAndUpdate(
      {
        action: ActionType.UPDATE_SO,
        roleIds: subAdminRoleId,
        permission: PermissionLevel.ALLOWED,
      },
      {
        name: 'Sub-admin Update SO (Allowed)',
        description: 'Sub-admin can update SO records (only non-activated SOs)',
        action: ActionType.UPDATE_SO,
        roleIds: [subAdminRoleId],
        permission: PermissionLevel.ALLOWED,
        isActive: true,
        priority: 10,
        createdBy: adminUserId,
      },
      { upsert: true, new: true },
    );
    console.log('✅ Configured UPDATE_SO permission (ALLOWED)');

    // 21. Deny DELETE_SO
    await PermissionConfig.findOneAndUpdate(
      {
        action: ActionType.DELETE_SO,
        roleIds: subAdminRoleId,
        permission: PermissionLevel.DENIED,
      },
      {
        name: 'Sub-admin Delete SO (Denied)',
        description: 'Sub-admin cannot delete SO records',
        action: ActionType.DELETE_SO,
        roleIds: [subAdminRoleId],
        permission: PermissionLevel.DENIED,
        isActive: true,
        priority: 10,
        createdBy: adminUserId,
      },
      { upsert: true, new: true },
    );
    console.log('✅ Configured DELETE_SO permission (DENIED)');

    // Verify permissions were created
    console.log('\n🔍 Verifying permissions were created...');
    const viewSoPermission = await PermissionConfig.findOne({
      action: ActionType.VIEW_SO,
      roleIds: subAdminRoleId,
      isActive: true,
    }).lean();

    if (viewSoPermission) {
      console.log('✅ VIEW_SO permission verified');
    } else {
      console.log('⚠️  VIEW_SO permission not found - please check');
    }

    const createSoPermission = await PermissionConfig.findOne({
      action: ActionType.CREATE_SO,
      roleIds: subAdminRoleId,
      isActive: true,
    }).lean();

    if (createSoPermission) {
      console.log('✅ CREATE_SO permission verified');
    } else {
      console.log('⚠️  CREATE_SO permission not found - please check');
    }

    const editSoPermission = await PermissionConfig.findOne({
      action: ActionType.EDIT_SO,
      roleIds: subAdminRoleId,
      isActive: true,
    }).lean();

    if (editSoPermission) {
      console.log(
        `✅ EDIT_SO permission verified (${editSoPermission.permission})`,
      );
    } else {
      console.log('⚠️  EDIT_SO permission not found - please check');
    }

    const updateSoPermission = await PermissionConfig.findOne({
      action: ActionType.UPDATE_SO,
      roleIds: subAdminRoleId,
      isActive: true,
    }).lean();

    if (updateSoPermission) {
      console.log(
        `✅ UPDATE_SO permission verified (${updateSoPermission.permission})`,
      );
    } else {
      console.log('⚠️  UPDATE_SO permission not found - please check');
    }

    // Count total permissions for sub-admin
    const totalPermissions = await PermissionConfig.countDocuments({
      roleIds: subAdminRoleId,
      isActive: true,
    });
    console.log(
      `📊 Total active permissions for sub-admin: ${totalPermissions}`,
    );

    console.log('\n✅ Sub-admin permissions setup completed successfully!\n');
    console.log('📝 Summary:');
    console.log('   ✅ VIEW actions: ALLOWED (read-only access like admin)');
    console.log('      - VIEW_SO');
    console.log('      - VIEW_MACHINE');
    console.log('      - VIEW_QC_ENTRY');
    console.log('      - VIEW_QC_APPROVAL');
    console.log('   ✅ CREATE_SO: REQUIRES_APPROVAL (admin must approve)');
    console.log('   ✅ EDIT_SO: ALLOWED (can edit non-activated SOs only)');
    console.log('   ✅ UPDATE_SO: ALLOWED (can update non-activated SOs only)');
    console.log(
      '   ❌ All other CREATE/EDIT/UPDATE/DELETE/APPROVE actions: DENIED',
    );
    console.log('\n💡 Sub-admin users can now:');
    console.log('   - View all pages (SO, Machines, QC Entries, QC Approvals)');
    console.log('   - Access admin dashboard (read-only)');
    console.log('   - Create SO records (pending admin approval)');
    console.log('   - Edit and update SO records (only non-activated SOs)');
    console.log('   - Cannot delete or approve any records');
    console.log('\n⚠️  IMPORTANT: If you still see permission errors,');
    console.log('   make sure the app is using the same database.');
    console.log('   Check that MONGO_URI environment variable matches.');
    console.log('\n');
  } catch (error) {
    console.error('❌ Error setting up sub-admin permissions:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  }
}

// Run the script
if (require.main === module) {
  setupSubAdminPermissions()
    .then(() => {
      console.log('✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

export default setupSubAdminPermissions;
