import mongoose from 'mongoose';
import { Category, SequenceManagement } from '../models/category.model';
import { Machine } from '../models/machine.model';

/**
 * Migration script to enhance existing categories with hierarchy support
 * and create initial sequence management configurations
 */
class CategoryMigration {
  /**
   * Run the complete migration
   */
  static async runMigration(): Promise<void> {
    try {
      console.log('🚀 Starting Category Enhancement Migration...');

      // Step 1: Migrate existing categories
      await this.migrateExistingCategories();

      // Step 2: Create default sequence configurations
      await this.createDefaultSequenceConfigs();

      // Step 3: Update machine references (if needed)
      await this.updateMachineReferences();

      console.log('✅ Category Enhancement Migration completed successfully!');
    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    }
  }

  /**
   * Migrate existing categories to new schema
   */
  private static async migrateExistingCategories(): Promise<void> {
    console.log('📝 Migrating existing categories...');

    try {
      // Get all existing categories
      const existingCategories = await Category.find({}).lean();

      for (const category of existingCategories) {
        // Check if category already has the new fields
        if (!category.slug) {
          // Generate slug from name
          const slug = category.name
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim();

          // Update category with new fields
          await Category.findByIdAndUpdate(category._id, {
            $set: {
              slug: slug,
              level: 0, // All existing categories are root level
              sort_order: 0,
              is_active: category.is_active !== false, // Default to true
              created_at: category.created_at || new Date(),
              updated_at: category.updated_at || new Date(),
              deleted_at: null,
            },
          });

          console.log(`✅ Migrated category: ${category.name} -> ${slug}`);
        }
      }

      console.log(`📊 Migrated ${existingCategories.length} categories`);
    } catch (error) {
      console.error('❌ Error migrating categories:', error);
      throw error;
    }
  }

  /**
   * Create default sequence configurations for existing categories
   */
  private static async createDefaultSequenceConfigs(): Promise<void> {
    console.log('🔢 Creating default sequence configurations...');

    try {
      // Get all root level categories
      const rootCategories = await Category.find({ level: 0, is_active: true });

      for (const category of rootCategories) {
        // Check if sequence config already exists
        const existingConfig = await SequenceManagement.findOne({
          category_id: category._id,
          subcategory_id: null,
        });

        if (!existingConfig) {
          // Create default sequence configuration
          const sequenceConfig = new SequenceManagement({
            category_id: category._id,
            subcategory_id: null,
            sequence_prefix: this.generatePrefix(category.name),
            current_sequence: 0,
            starting_number: 1,
            format: `${this.generatePrefix(category.name)}-{category}-{sequence}`,
            is_active: true,
            created_by: category.created_by,
            created_at: new Date(),
            updated_at: new Date(),
          });

          await sequenceConfig.save();
          console.log(`✅ Created sequence config for: ${category.name}`);
        }
      }

      console.log(
        `🔢 Created sequence configurations for ${rootCategories.length} categories`,
      );
    } catch (error) {
      console.error('❌ Error creating sequence configurations:', error);
      throw error;
    }
  }

  /**
   * Update machine references to use new category structure
   */
  private static async updateMachineReferences(): Promise<void> {
    console.log('🔗 Updating machine references...');

    try {
      // Get all machines that have category references
      const machines = await Machine.find({ category_id: { $exists: true } });

      for (const machine of machines) {
        // Check if machine already has subcategory_id field
        if (!machine.subcategory_id) {
          // For now, we'll leave subcategory_id as null
          // This can be updated later when subcategories are created
          await Machine.findByIdAndUpdate(machine._id, {
            $set: {
              subcategory_id: null,
              machine_sequence: null, // Will be generated when needed
            },
          });

          console.log(
            `✅ Updated machine reference: ${machine.name || machine._id}`,
          );
        }
      }

      console.log(`🔗 Updated ${machines.length} machine references`);
    } catch (error) {
      console.error('❌ Error updating machine references:', error);
      throw error;
    }
  }

  /**
   * Generate a prefix from category name
   */
  private static generatePrefix(categoryName: string): string {
    const prefixMap: { [key: string]: string } = {
      'tablet press machine': 'TP',
      'allied equipment': 'AE',
      'punches & dies': 'PD',
      'roll compactor machines': 'RC',
      'tablet compression machine': 'TC',
      'multi mill': 'MM',
      'vibro sifter': 'VS',
      'oscillating granulator': 'OG',
      'dust extractor machine': 'DE',
    };

    const normalizedName = categoryName.toLowerCase().trim();
    return (
      prefixMap[normalizedName] || categoryName.substring(0, 2).toUpperCase()
    );
  }

  /**
   * Rollback migration (if needed)
   */
  static async rollbackMigration(): Promise<void> {
    try {
      console.log('🔄 Rolling back Category Enhancement Migration...');

      // Remove sequence management configurations
      await SequenceManagement.deleteMany({});
      console.log('✅ Removed sequence management configurations');

      // Reset category fields to original state
      await Category.updateMany(
        {},
        {
          $unset: {
            slug: 1,
            parent_id: 1,
            level: 1,
            sort_order: 1,
            image_url: 1,
            seo_title: 1,
            seo_description: 1,
            created_at: 1,
            updated_at: 1,
            deleted_at: 1,
          },
        },
      );
      console.log('✅ Reset category fields');

      // Reset machine fields
      await Machine.updateMany(
        {},
        {
          $unset: {
            subcategory_id: 1,
            machine_sequence: 1,
          },
        },
      );
      console.log('✅ Reset machine fields');

      console.log('✅ Rollback completed successfully!');
    } catch (error) {
      console.error('❌ Rollback failed:', error);
      throw error;
    }
  }

  /**
   * Check migration status
   */
  static async checkMigrationStatus(): Promise<void> {
    try {
      console.log('📊 Checking migration status...');

      const totalCategories = await Category.countDocuments();
      const migratedCategories = await Category.countDocuments({
        slug: { $exists: true },
      });
      const sequenceConfigs = await SequenceManagement.countDocuments();
      const machinesWithNewFields = await Machine.countDocuments({
        $or: [
          { subcategory_id: { $exists: true } },
          { machine_sequence: { $exists: true } },
        ],
      });

      console.log('📈 Migration Status:');
      console.log(
        `   Categories: ${migratedCategories}/${totalCategories} migrated`,
      );
      console.log(`   Sequence Configs: ${sequenceConfigs} created`);
      console.log(`   Machines Updated: ${machinesWithNewFields}`);

      if (migratedCategories === totalCategories && sequenceConfigs > 0) {
        console.log('✅ Migration appears to be complete');
      } else {
        console.log('⚠️  Migration may be incomplete');
      }
    } catch (error) {
      console.error('❌ Error checking migration status:', error);
      throw error;
    }
  }
}

/**
 * CLI interface for running migrations
 */
if (require.main === module) {
  const command = process.argv[2];

  const runMigration = async () => {
    try {
      // Connect to MongoDB
      await mongoose.connect(
        process.env['MONGODB_URI'] || 'mongodb://localhost:27017/fluidpack',
      );

      switch (command) {
        case 'migrate':
          await CategoryMigration.runMigration();
          break;
        case 'rollback':
          await CategoryMigration.rollbackMigration();
          break;
        case 'status':
          await CategoryMigration.checkMigrationStatus();
          break;
        default:
          console.log(
            'Usage: npm run migrate:category [migrate|rollback|status]',
          );
          process.exit(1);
      }

      await mongoose.disconnect();
      process.exit(0);
    } catch (error) {
      console.error('Migration failed:', error);
      await mongoose.disconnect();
      process.exit(1);
    }
  };

  runMigration();
}

export { CategoryMigration };
