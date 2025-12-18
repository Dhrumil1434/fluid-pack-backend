/**
 * Helper script to list all roles in the database
 * Usage: ts-node src/scripts/list-roles.ts
 */

import mongoose from 'mongoose';
import { Role } from '../models/role.model';

const MONGODB_URI =
  process.env['MONGODB_URI'] || 'mongodb://localhost:27017/fluidpack';

async function listRoles(): Promise<void> {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const roles = await Role.find({}).select('name description _id').lean();

    if (roles.length === 0) {
      console.log('📋 No roles found in database.');
    } else {
      console.log(`📋 Found ${roles.length} role(s):\n`);
      roles.forEach((role, index) => {
        console.log(`${index + 1}. Name: "${role.name}"`);
        console.log(`   ID: ${role._id}`);
        console.log(`   Description: ${role.description || '(none)'}`);
        console.log('');
      });
    }

    // Check specifically for admin role
    const adminRole = await Role.findOne({ name: 'admin' });
    if (adminRole) {
      console.log('✅ Admin role found!');
    } else {
      console.log('❌ Admin role not found with exact name "admin"');
      const adminLike = await Role.find({
        name: { $regex: /admin/i },
      })
        .select('name _id')
        .lean();
      if (adminLike.length > 0) {
        console.log('   But found similar roles:');
        adminLike.forEach((role) => {
          console.log(`   - "${role.name}" (ID: ${role._id})`);
        });
      }
    }
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

listRoles();
