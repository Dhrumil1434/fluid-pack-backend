import connectDB from '../db/index';
import { Role } from '../models/role.model';
import { Department } from '../models/department.model';
import {
  PermissionConfig,
  PermissionLevel,
  ActionType,
} from '../models/permissionConfig.model';
import { User } from '../models/user.model';
import { Types } from 'mongoose';
import { defaultPolicy, Policy } from './policy';

function toObjectId(value: string | undefined): Types.ObjectId | undefined {
  try {
    return value ? new Types.ObjectId(value) : undefined;
  } catch {
    return undefined;
  }
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

function mapAction(a: Policy['rules'][number]['action']): ActionType {
  // Values already match enum string values; ensure type-safety
  const allowed: Record<string, ActionType> = {
    CREATE_MACHINE: ActionType.CREATE_MACHINE,
    EDIT_MACHINE: ActionType.EDIT_MACHINE,
    DELETE_MACHINE: ActionType.DELETE_MACHINE,
    APPROVE_MACHINE: ActionType.APPROVE_MACHINE,
    VIEW_MACHINE: ActionType.VIEW_MACHINE,
  };
  return allowed[a] ?? ActionType.VIEW_MACHINE;
}

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

async function resolveRoleIds(names: string[]): Promise<string[]> {
  const roles = await Role.find({
    name: { $in: names.map((n) => n.toLowerCase().trim()) },
  }).lean();
  return roles.map((r) => r._id.toString());
}

async function resolveDepartmentIds(names: string[]): Promise<string[]> {
  const depts = await Department.find({ name: { $in: names } }).lean();
  return depts.map((d) => d._id.toString());
}

async function resolveUserIds(identifiers: string[]): Promise<string[]> {
  if (!identifiers?.length) return [];
  const users = await User.find({
    $or: [{ email: { $in: identifiers } }, { username: { $in: identifiers } }],
  })
    .select('_id email username')
    .lean();
  return users.map((u) => u._id.toString());
}

async function upsertPermissionFromRule(
  rule: Policy['rules'][number],
  context: {
    roleNameToId: Record<string, string>;
    deptNameToId: Record<string, string>;
    approverRoleNameToIds: Record<string, string>;
    createdByUserId: string;
  },
) {
  const roleIds = (rule.roles || [])
    .map((r) => context.roleNameToId[r.toLowerCase().trim()])
    .filter(isNonEmptyString);
  const departmentIds = (rule.departments || [])
    .map((d) => context.deptNameToId[d])
    .filter(isNonEmptyString);

  // approvers
  let approverRoles: string[] | undefined = undefined;
  if (rule.approverRoles?.length) {
    approverRoles = rule.approverRoles
      .map((r) => context.approverRoleNameToIds[r.toLowerCase().trim()])
      .filter(isNonEmptyString);
  }

  if (!approverRoles && rule.useDepartmentApprovers && departmentIds.length) {
    const collected = new Set<string>();
    for (const deptName of rule.departments || []) {
      const names =
        defaultPolicy.approvers.perDepartment?.[deptName] ||
        defaultPolicy.approvers.defaultRoles;
      (names || []).forEach((n) => {
        const id =
          context.approverRoleNameToIds[n?.toLowerCase?.().trim?.() || ''];
        if (id) collected.add(id);
      });
    }
    approverRoles = Array.from(collected.values());
  }

  if (!approverRoles && !rule.useDepartmentApprovers) {
    if (rule.permission === 'REQUIRES_APPROVAL') {
      const fallback = (defaultPolicy.approvers.defaultRoles || [])
        .map(
          (n) =>
            context.approverRoleNameToIds[n?.toLowerCase?.().trim?.() || ''],
        )
        .filter(isNonEmptyString);
      approverRoles = fallback.length ? fallback : undefined;
    }
  }

  // Final safeguard: if approval required but no approver roles resolved, try 'admin'
  if (
    rule.permission === 'REQUIRES_APPROVAL' &&
    (!approverRoles || approverRoles.length === 0)
  ) {
    const adminId = context.approverRoleNameToIds['admin'];
    approverRoles = adminId ? [adminId] : undefined;
  }

  const updateDoc: Record<string, unknown> = {
    name: rule.name,
    description: rule.description || rule.name,
    action: mapAction(rule.action),
    permission: rule.permission as unknown as PermissionLevel,
    priority: rule.priority,
    isActive: rule.isActive !== false,
    maxValue: rule.maxValue,
    createdBy: toObjectId(context.createdByUserId)!,
  };

  const roleIdsObj = roleIds
    .map((id) => toObjectId(id))
    .filter(Boolean) as Types.ObjectId[];
  const deptIdsObj = departmentIds
    .map((id) => toObjectId(id))
    .filter(Boolean) as Types.ObjectId[];
  const apprIdsObj = (approverRoles || [])
    .map((id) => toObjectId(id))
    .filter(Boolean) as Types.ObjectId[];

  if (roleIdsObj.length) updateDoc['roleIds'] = roleIdsObj;
  if (deptIdsObj.length) updateDoc['departmentIds'] = deptIdsObj;
  if (apprIdsObj.length) updateDoc['approverRoles'] = apprIdsObj;

  await PermissionConfig.findOneAndUpdate(
    { name: rule.name, action: mapAction(rule.action) },
    updateDoc,
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

async function main() {
  await connectDB();

  // Ensure base roles/departments from policy
  const roleDocs = await Promise.all(
    defaultPolicy.roles.map((r) => upsertRole(r)),
  );
  const deptDocs = await Promise.all(
    defaultPolicy.departments.map((d) => upsertDepartment(d)),
  );

  console.log('Seeded roles:', roleDocs.map((r) => r.name).join(', '));
  console.log('Seeded departments:', deptDocs.map((d) => d.name).join(', '));

  const roleNameToId: Record<string, string> = Object.fromEntries(
    roleDocs.map((r) => [
      r.name.toLowerCase().trim(),
      (r._id as unknown as Types.ObjectId).toString(),
    ]),
  );
  const deptNameToId: Record<string, string> = Object.fromEntries(
    deptDocs.map((d) => [
      d.name,
      (d._id as unknown as Types.ObjectId).toString(),
    ]),
  );

  // Pick a createdBy user: prefer an existing admin user; otherwise fallback to any user or a new ObjectId
  const anyUser = await User.findOne().lean();
  const createdByUserId =
    anyUser?._id?.toString?.() || new Types.ObjectId().toString();

  // Build approver role map
  const approverRoleNames = Array.from(
    new Set(
      [
        ...defaultPolicy.approvers.defaultRoles,
        ...Object.values(defaultPolicy.approvers.perDepartment || {}).flat(),
      ].map((n) => n.toLowerCase().trim()),
    ),
  );
  const approverIds = await resolveRoleIds(approverRoleNames);
  const approverRoleNameToIds: Record<string, string> = {};
  approverRoleNames.forEach((n, i) => {
    const id = approverIds[i];
    if (id) approverRoleNameToIds[n] = id;
  });

  // Upsert rules from policy
  for (const rule of defaultPolicy.rules) {
    await upsertPermissionFromRule(rule, {
      roleNameToId,
      deptNameToId,
      approverRoleNameToIds: approverRoleNameToIds,
      createdByUserId,
    });
  }

  // User-specific overrides
  for (const ov of defaultPolicy.overrides || []) {
    const userIds = await resolveUserIds([ov.user]);
    if (!userIds.length) continue; // skip silently if user not present
    const deptIds = ov.department
      ? await resolveDepartmentIds([ov.department])
      : [];

    await PermissionConfig.findOneAndUpdate(
      {
        name: `Override ${ov.type} ${ov.user} ${ov.action}`,
        action: ov.action as ActionType,
      },
      {
        name: `Override ${ov.type} ${ov.user} ${ov.action}`,
        description: 'User-specific override generated from policy',
        action: ov.action as ActionType,
        userIds: userIds.map((id) => new Types.ObjectId(id)),
        departmentIds: deptIds.length
          ? deptIds.map((id) => new Types.ObjectId(id))
          : undefined,
        permission:
          ov.type === 'user-allow'
            ? PermissionLevel.ALLOWED
            : PermissionLevel.DENIED,
        priority: ov.priority ?? 100,
        isActive: true,
        createdBy: new Types.ObjectId(createdByUserId),
      },
      { upsert: true, new: true },
    );
  }

  console.log('Policy-based permission rules ensured.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
