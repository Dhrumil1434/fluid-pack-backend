import connectDB from '../db/index';
import { Role } from '../models/role.model';
import {
  PermissionConfig,
  ActionType,
  PermissionLevel,
} from '../models/permissionConfig.model';
import { User } from '../models/user.model';
import { Types } from 'mongoose';

async function fixTechnicianViewSO() {
  await connectDB();

  console.log('🔧 Fixing VIEW_SO permission for technician role...\n');

  // 1. Find technician role
  const technicianRole = await Role.findOne({ name: 'technician' }).lean();
  if (!technicianRole) {
    console.error('❌ Technician role not found!');
    process.exit(1);
  }
  const technicianRoleId = technicianRole._id as Types.ObjectId;
  console.log(
    `✅ Found technician role: ${technicianRole.name} (ID: ${technicianRoleId})`,
  );

  // 2. Find or create VIEW_SO permission for technician
  const permissionName = 'Technician view SO';
  const existingPermission = await PermissionConfig.findOne({
    name: permissionName,
    action: ActionType.VIEW_SO,
  }).lean();

  if (existingPermission) {
    console.log(`\n📋 Found existing permission: ${permissionName}`);
    console.log(
      `   Current role IDs: ${
        existingPermission.roleIds
          ?.map((r: Types.ObjectId | { _id: Types.ObjectId }) => {
            if (typeof r === 'object' && '_id' in r) {
              return r._id.toString();
            }
            return r.toString();
          })
          .join(', ') || 'None'
      }`,
    );

    // Check if technician role ID is already in the list
    const roleIdStrings = (existingPermission.roleIds || []).map(
      (r: Types.ObjectId | { _id: Types.ObjectId }) => {
        if (typeof r === 'object' && '_id' in r) {
          return r._id.toString();
        }
        return r.toString();
      },
    );
    const technicianRoleIdStr = technicianRoleId.toString();

    if (roleIdStrings.includes(technicianRoleIdStr)) {
      console.log(`   ✅ Technician role ID is already in the permission!`);
    } else {
      console.log(
        `   ⚠️  Technician role ID is NOT in the permission. Updating...`,
      );

      // Update the permission to include technician role ID
      const updatedRoleIds = [
        ...new Set([...roleIdStrings, technicianRoleIdStr]),
      ].map((id) => new Types.ObjectId(id));

      await PermissionConfig.findOneAndUpdate(
        { _id: existingPermission._id },
        {
          $set: {
            roleIds: updatedRoleIds,
            isActive: true,
          },
        },
        { new: true },
      );

      console.log(`   ✅ Updated permission with technician role ID!`);
      console.log(
        `   New role IDs: ${updatedRoleIds.map((r) => r.toString()).join(', ')}`,
      );
    }
  } else {
    console.log(`\n📝 Creating new permission: ${permissionName}`);

    // Get admin user for createdBy
    const adminRole = await Role.findOne({ name: 'admin' }).lean();
    let createdByUserId = new Types.ObjectId();
    if (adminRole) {
      const adminUser = await User.findOne({ role: adminRole._id })
        .select('_id')
        .lean();
      if (adminUser) {
        createdByUserId = adminUser._id as Types.ObjectId;
      }
    }

    // Create the permission
    await PermissionConfig.create({
      name: permissionName,
      description: 'Allow technician to view SO records',
      action: ActionType.VIEW_SO,
      permission: PermissionLevel.ALLOWED,
      roleIds: [technicianRoleId],
      priority: 60,
      isActive: true,
      createdBy: createdByUserId,
    });

    console.log(`   ✅ Created permission with technician role ID!`);
  }

  // 3. Verify the permission
  const finalPermission = await PermissionConfig.findOne({
    name: permissionName,
    action: ActionType.VIEW_SO,
  })
    .populate('roleIds', 'name')
    .lean();

  if (finalPermission) {
    console.log(`\n✅ Verification:`);
    console.log(`   Permission: ${finalPermission.name}`);
    console.log(`   Action: ${finalPermission.action}`);
    console.log(`   Permission Level: ${finalPermission.permission}`);
    console.log(`   Active: ${finalPermission.isActive}`);
    console.log(
      `   Role IDs: ${(finalPermission.roleIds || [])
        .map((r: Types.ObjectId | { _id: Types.ObjectId; name?: string }) => {
          if (typeof r === 'object' && '_id' in r) {
            return `${r._id} (${r.name || 'unknown'})`;
          }
          return r.toString();
        })
        .join(', ')}`,
    );
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ Fix completed!');
  console.log('\n💡 Next steps:');
  console.log(
    '   1. Clear the permission cache: POST /api/permission-configs/clear-cache',
  );
  console.log('   2. Restart the server to clear in-memory cache');
  console.log('   3. Test with a technician user');
  console.log('='.repeat(60) + '\n');

  process.exit(0);
}

fixTechnicianViewSO().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
