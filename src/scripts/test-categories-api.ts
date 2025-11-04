import mongoose from 'mongoose';
import { CategoryService } from '../modules/category/services/category.service';

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(
      process.env.MONGODB_URI || 'mongodb://localhost:27017/fluidpack',
    );
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Test categories service directly
const testCategoriesService = async () => {
  try {
    console.log('Testing CategoryService.getAllCategories...');

    // Test with default options
    const categories1 = await CategoryService.getAllCategories();
    console.log('Categories with default options:', categories1.length);
    categories1.forEach((cat) =>
      console.log(`- ${cat.name} (Level: ${cat.level})`),
    );

    // Test with includeInactive: true
    const categories2 = await CategoryService.getAllCategories({
      includeInactive: true,
    });
    console.log('Categories with includeInactive: true:', categories2.length);
    categories2.forEach((cat) =>
      console.log(`- ${cat.name} (Level: ${cat.level})`),
    );

    // Test with level: 0
    const categories3 = await CategoryService.getAllCategories({ level: 0 });
    console.log('Categories with level: 0:', categories3.length);
    categories3.forEach((cat) =>
      console.log(`- ${cat.name} (Level: ${cat.level})`),
    );
  } catch (error) {
    console.error('Error testing categories service:', error);
  }
};

// Main execution
const main = async () => {
  await connectDB();
  await testCategoriesService();
  await mongoose.connection.close();
  console.log('Database connection closed');
  process.exit(0);
};

main().catch(console.error);
