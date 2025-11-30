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

// Check categories
const checkCategories = async () => {
  try {
    const totalCategories = await Category.countDocuments();
    console.log('Total categories in database:', totalCategories);

    if (totalCategories > 0) {
      const allCategories = await Category.find({}).lean();
      console.log('All categories:');
      allCategories.forEach((cat, index) => {
        console.log(
          `${index + 1}. ${cat.name} (Level: ${cat.level}, Active: ${cat.is_active})`,
        );
      });
    } else {
      console.log('No categories found in database');
    }
  } catch (error) {
    console.error('Error checking categories:', error);
  }
};

// Main execution
const main = async () => {
  await connectDB();
  await checkCategories();
  await mongoose.connection.close();
  console.log('Database connection closed');
  process.exit(0);
};

main().catch(console.error);
