import connectDB from '../db/index';
import { Role } from '../models/role.model';
import { Department } from '../models/department.model';
import {
  PermissionConfig,
  PermissionLevel,
  ActionType,
} from '../models/permissionConfig.model';
import { Types } from 'mongoose';

async function upsertRole(name: string, description?: string) {
  const doc = await Role.findOneAndUpdate(
    { name: name.toLowerCase().trim() },
    { name: name.toLowerCase().trim(), description },
    { upsert: true, new: true },
  );
  return doc;
}

async function upsertDepartment(name: string, description?: string) {
  const doc = await Department.findOneAndUpdate(
    { name },
    { name, description },
    { upsert: true, new: true },
  );
  return doc;
}

async function ensureBaselinePermissions(adminRoleId: string) {
  // Global default deny for CREATE_MACHINE at low priority
  await PermissionConfig.findOneAndUpdate(
    { name: 'Global default deny create', action: ActionType.CREATE_MACHINE },
    {
      name: 'Global default deny create',
      description: 'Default deny for create machine',
      action: ActionType.CREATE_MACHINE,
      permission: PermissionLevel.DENIED,
      priority: 1,
      createdBy: new Types.ObjectId(adminRoleId), // not perfect, but schema requires user id
    },
    { upsert: true, new: true },
  );
}

async function main() {
  await connectDB();

  const [admin, manager, technician] = await Promise.all([
    upsertRole('admin', 'System administrator'),
    upsertRole('manager1', 'Manager'),
    upsertRole('technician', 'Technician'),
  ]);

  const [dispatch, qa] = await Promise.all([
    upsertDepartment('dispatch', 'Dispatch operations'),
    upsertDepartment('qa', 'Quality assurance'),
  ]);

  console.log('Seeded roles:', admin.name, manager.name, technician.name);
  console.log('Seeded departments:', dispatch.name, qa.name);

  if (admin?._id) {
    await ensureBaselinePermissions(admin._id.toString());
  }

  console.log('Baseline permission rules ensured.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
