import mongoose from 'mongoose';
import { Category } from '../models/category.model';

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(
      process.env['MONGODB_URI'] || 'mongodb://localhost:27017/fluidpack',
    );
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Create sample categories
const createSampleCategories = async () => {
  try {
    // Clear existing categories
    await Category.deleteMany({});
    console.log('Cleared existing categories');

    // Create main categories
    const mainCategories = [
      {
        name: 'Tablet Press Machine',
        slug: 'tablet-press-machine',
        description: 'Machines for tablet compression and pressing',
        level: 0,
        is_active: true,
        sort_order: 1,
        created_by: new mongoose.Types.ObjectId(),
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        name: 'Capsule Filling Machine',
        slug: 'capsule-filling-machine',
        description: 'Machines for filling capsules with powder or pellets',
        level: 0,
        is_active: true,
        sort_order: 2,
        created_by: new mongoose.Types.ObjectId(),
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        name: 'Coating Machine',
        slug: 'coating-machine',
        description: 'Machines for tablet and capsule coating',
        level: 0,
        is_active: true,
        sort_order: 3,
        created_by: new mongoose.Types.ObjectId(),
        created_at: new Date(),
        updated_at: new Date(),
      },
    ];

    const createdMainCategories = await Category.insertMany(mainCategories);
    console.log('Created main categories:', createdMainCategories.length);

    // Create subcategories for Tablet Press Machine
    const tabletPressId = createdMainCategories[0]?._id;
    if (!tabletPressId) {
      throw new Error('Failed to create main categories');
    }
    const tabletSubcategories = [
      {
        name: 'Single Punch Tablet Press',
        slug: 'single-punch-tablet-press',
        description: 'Single station tablet press machines',
        parent_id: tabletPressId,
        level: 1,
        is_active: true,
        sort_order: 1,
        created_by: new mongoose.Types.ObjectId(),
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        name: 'Multi Station Tablet Press',
        slug: 'multi-station-tablet-press',
        description: 'Multi-station rotary tablet press machines',
        parent_id: tabletPressId,
        level: 1,
        is_active: true,
        sort_order: 2,
        created_by: new mongoose.Types.ObjectId(),
        created_at: new Date(),
        updated_at: new Date(),
      },
    ];

    const createdTabletSubcategories =
      await Category.insertMany(tabletSubcategories);
    console.log(
      'Created tablet press subcategories:',
      createdTabletSubcategories.length,
    );

    // Create subcategories for Capsule Filling Machine
    const capsuleFillingId = createdMainCategories[1]?._id;
    if (!capsuleFillingId) {
      throw new Error('Failed to create main categories');
    }
    const capsuleSubcategories = [
      {
        name: 'Manual Capsule Filler',
        slug: 'manual-capsule-filler',
        description: 'Manual capsule filling machines',
        parent_id: capsuleFillingId,
        level: 1,
        is_active: true,
        sort_order: 1,
        created_by: new mongoose.Types.ObjectId(),
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        name: 'Automatic Capsule Filler',
        slug: 'automatic-capsule-filler',
        description: 'Fully automatic capsule filling machines',
        parent_id: capsuleFillingId,
        level: 1,
        is_active: true,
        sort_order: 2,
        created_by: new mongoose.Types.ObjectId(),
        created_at: new Date(),
        updated_at: new Date(),
      },
    ];

    const createdCapsuleSubcategories =
      await Category.insertMany(capsuleSubcategories);
    console.log(
      'Created capsule filling subcategories:',
      createdCapsuleSubcategories.length,
    );

    console.log('Sample categories created successfully!');
    console.log('Total categories:', await Category.countDocuments());
  } catch (error) {
    console.error('Error creating sample categories:', error);
  }
};

// Main execution
const main = async () => {
  await connectDB();
  await createSampleCategories();
  await mongoose.connection.close();
  console.log('Database connection closed');
  process.exit(0);
};

main().catch(console.error);
