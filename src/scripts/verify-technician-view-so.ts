import connectDB from '../db/index';
import { Role } from '../models/role.model';
import { PermissionConfig, ActionType } from '../models/permissionConfig.model';
import { User } from '../models/user.model';

async function verifyTechnicianViewSO() {
  await connectDB();

  console.log('🔍 Verifying VIEW_SO permission for technician role...\n');

  // 1. Find technician role
  const technicianRole = await Role.findOne({ name: 'technician' }).lean();
  if (!technicianRole) {
    console.error('❌ Technician role not found!');
    process.exit(1);
  }
  console.log(
    `✅ Found technician role: ${technicianRole.name} (ID: ${technicianRole._id})`,
  );

  // 2. Find VIEW_SO permission configs
  const viewSOPermissions = await PermissionConfig.find({
    action: ActionType.VIEW_SO,
    isActive: true,
  })
    .populate('roleIds', 'name')
    .lean();

  console.log(
    `\n📋 Found ${viewSOPermissions.length} VIEW_SO permission config(s):\n`,
  );

  if (viewSOPermissions.length === 0) {
    console.error('❌ No VIEW_SO permission configs found!');
    console.log('\n💡 Run the seed script to create permissions: npm run seed');
    process.exit(1);
  }

  // 3. Check each permission config
  let foundTechnicianPermission = false;
  for (const perm of viewSOPermissions) {
    console.log(`Permission: ${perm.name}`);
    console.log(`  - Action: ${perm.action}`);
    console.log(`  - Permission: ${perm.permission}`);
    console.log(`  - Priority: ${perm.priority}`);
    console.log(`  - Active: ${perm.isActive}`);

    if (
      perm.roleIds &&
      Array.isArray(perm.roleIds) &&
      perm.roleIds.length > 0
    ) {
      console.log(
        `  - Role IDs: ${perm.roleIds
          .map((r: unknown) => {
            if (typeof r === 'object' && r !== null && '_id' in r) {
              const roleObj = r as {
                _id: { toString(): string };
                name?: string;
              };
              return `${roleObj._id} (${roleObj.name || 'unknown'})`;
            }
            return String(r);
          })
          .join(', ')}`,
      );

      // Check if technician role ID is in the list
      const roleIdStrings = perm.roleIds.map((r: unknown) => {
        if (typeof r === 'object' && r !== null && '_id' in r) {
          const roleObj = r as { _id: { toString(): string } };
          return roleObj._id.toString();
        }
        return String(r);
      });

      const technicianRoleIdStr = technicianRole._id.toString();
      if (roleIdStrings.includes(technicianRoleIdStr)) {
        console.log(`  ✅ Technician role ID found in this permission!`);
        foundTechnicianPermission = true;
      } else {
        console.log(`  ❌ Technician role ID NOT found in this permission`);
        console.log(`     Expected: ${technicianRoleIdStr}`);
        console.log(`     Found: ${roleIdStrings.join(', ')}`);
      }
    } else {
      console.log(`  - Role IDs: None (global rule)`);
      if (!perm.roleIds || perm.roleIds.length === 0) {
        console.log(`  ✅ This is a global rule (matches all roles)`);
        foundTechnicianPermission = true;
      }
    }
    console.log('');
  }

  // 4. Test with an actual technician user
  const technicianUsers = await User.find({ role: technicianRole._id })
    .populate('role', 'name')
    .limit(1)
    .lean();

  const testUser = technicianUsers[0];
  if (testUser) {
    console.log(
      `\n👤 Testing with technician user: ${testUser.email || testUser.username}`,
    );
    console.log(`   User ID: ${testUser._id}`);
    const roleName =
      typeof testUser.role === 'object' &&
      testUser.role !== null &&
      'name' in testUser.role
        ? (testUser.role as { name: string }).name
        : 'unknown';
    console.log(`   Role: ${roleName}`);
    console.log(
      `   Role ID: ${typeof testUser.role === 'object' && testUser.role?._id ? testUser.role._id.toString() : testUser.role?.toString() || 'unknown'}`,
    );
  } else {
    console.log(`\n⚠️  No technician users found to test with`);
  }

  // 5. Summary
  console.log('\n' + '='.repeat(60));
  if (foundTechnicianPermission) {
    console.log('✅ Technician VIEW_SO permission is configured correctly!');
    console.log('\n💡 If technicians are still getting denied:');
    console.log(
      '   1. Clear the permission cache: POST /api/permission-configs/clear-cache',
    );
    console.log('   2. Restart the server to clear in-memory cache');
    console.log('   3. Verify the user has the technician role assigned');
  } else {
    console.log('❌ Technician VIEW_SO permission is NOT configured!');
    console.log('\n💡 Fix by running: npm run seed');
  }
  console.log('='.repeat(60) + '\n');

  process.exit(0);
}

verifyTechnicianViewSO().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
