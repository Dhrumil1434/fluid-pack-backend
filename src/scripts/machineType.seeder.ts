import mongoose from 'mongoose';
import { Category } from '../models/category.model';
import { Role } from '../models/role.model';
import { User } from '../models/user.model';

const MONGODB_URI =
  process.env['MONGODB_URI'] || 'mongodb://localhost:27017/fluidpack';
async function resolveAdminUserId(): Promise<mongoose.Types.ObjectId> {
  // Find role id for 'admin' (roles are stored lowercase per schema)
  const adminRole = await Role.findOne({ name: 'admin' }).select('_id').lean();
  if (!adminRole?._id) {
    throw new Error('Admin role not found. Please seed roles first.');
  }

  // Find any approved user with admin role (fallback to any user with role)
  const adminUser = await User.findOne({
    role: adminRole._id,
    isApproved: true,
  })
    .select('_id')
    .lean();

  if (adminUser?._id) return adminUser._id as mongoose.Types.ObjectId;

  const anyAdmin = await User.findOne({ role: adminRole._id })
    .select('_id')
    .lean();
  if (anyAdmin?._id) return anyAdmin._id as mongoose.Types.ObjectId;

  throw new Error(
    'No user found with admin role. Please create an admin user.',
  );
}

async function seedMachineTypes() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const createdBy = await resolveAdminUserId();

    const machineTypes = [
      {
        name: 'high-speed single sided/double rotary tablet press',
        description:
          'High-speed rotary tablet presses designed for large-scale production with robust cGMP features.',
        createdBy,
        isActive: true,
      },
      {
        name: 'double rotary tablet press (accura act-v)',
        description:
          'ACCURA ACT-V double rotary press enabling enhanced throughput and consistent tablet quality.',
        createdBy,
        isActive: true,
      },
      {
        name: 'b4-double sided / d4-single sided rotary tablet press',
        description:
          'Versatile rotary tablet press platform supporting double-sided and single-sided configurations.',
        createdBy,
        isActive: true,
      },
      {
        name: 'single sided tablet slugging (bolus) machine',
        description:
          'Specialized press for large-format tablets/boluses, often used in veterinary applications.',
        createdBy,
        isActive: true,
      },
      {
        name: 'single & double layer mini tablet press',
        description:
          'Laboratory/pilot-scale mini press capable of producing single or double-layer tablets.',
        createdBy,
        isActive: true,
      },
      {
        name: 'roller compactor (plain & water jacketed)',
        description:
          'Roll compactors for dry granulation; available in plain and water-jacketed, cGMP-compliant designs.',
        createdBy,
        isActive: true,
      },
      {
        name: 'tablet de-burring & de-dusting machine',
        description:
          'Post-compression equipment to remove burrs and dust, ensuring cleaner tablets.',
        createdBy,
        isActive: true,
      },
      {
        name: 'tablet coating machine',
        description:
          'Automatic coating systems for functional or aesthetic tablet coating requirements.',
        createdBy,
        isActive: true,
      },
    ];

    const result = await Category.insertMany(machineTypes, { ordered: false });
    console.log(`✅ Seeded categories: ${result.length}`);
  } catch (err: unknown) {
    const e = err as { writeErrors?: unknown[]; message?: string };
    if (Array.isArray(e?.writeErrors)) {
      console.warn(
        `⚠️  Some documents skipped (likely duplicates): ${e.writeErrors.length}`,
      );
    } else {
      console.error('❌ Seeding error:', e?.message || String(err));
    }
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected. Seeding complete.');
    process.exit(0);
  }
}

seedMachineTypes();
