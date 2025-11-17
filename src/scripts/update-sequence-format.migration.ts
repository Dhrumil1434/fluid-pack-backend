import mongoose from 'mongoose';
import { SequenceManagement } from '../models/category.model';

/**
 * Migration script to update existing sequence format from {category}-{sequence} to {sequence}-{category}
 * This script updates all existing sequence configurations to use the new format pattern
 */
class SequenceFormatMigration {
  /**
   * Update all sequence configurations to use new format: {sequence}-{category}
   */
  static async updateSequenceFormats(): Promise<void> {
    try {
      console.log('🔄 Starting Sequence Format Migration...');
      console.log(
        '📝 Updating format from {category}-{sequence} to {sequence}-{category}',
      );

      // Get all sequence configurations
      const sequenceConfigs = await SequenceManagement.find({});

      if (sequenceConfigs.length === 0) {
        console.log('ℹ️  No sequence configurations found. Nothing to update.');
        return;
      }

      let updatedCount = 0;
      let skippedCount = 0;

      for (const config of sequenceConfigs) {
        const oldFormat = config.format;

        // Check if format needs updating
        // Only update formats that match the old pattern: {category}-{sequence} or similar
        if (
          oldFormat.includes('{category}') &&
          oldFormat.includes('{sequence}') &&
          oldFormat.indexOf('{category}') < oldFormat.indexOf('{sequence}')
        ) {
          // Replace {category}-{sequence} pattern with {sequence}-{category}
          // Handle various formats like:
          // - {category}-{sequence}
          // - {prefix}-{category}-{sequence}
          // - {category}-{subcategory}-{sequence}
          // - etc.

          let newFormat = oldFormat;

          // Simple case: {category}-{sequence} -> {sequence}-{category}
          if (oldFormat === '{category}-{sequence}') {
            newFormat = '{sequence}-{category}';
          } else {
            // Complex case: handle formats with prefixes, subcategories, etc.
            // Strategy: Find {category} and {sequence} positions and swap them
            const categoryIndex = oldFormat.indexOf('{category}');
            const sequenceIndex = oldFormat.indexOf('{sequence}');

            if (categoryIndex < sequenceIndex) {
              // Extract parts before, between, and after
              const beforeCategory = oldFormat.substring(0, categoryIndex);
              const categoryPlaceholder = '{category}';
              const between = oldFormat.substring(
                categoryIndex + categoryPlaceholder.length,
                sequenceIndex,
              );
              const sequencePlaceholder = '{sequence}';
              const afterSequence = oldFormat.substring(
                sequenceIndex + sequencePlaceholder.length,
              );

              // Reconstruct with swapped positions
              newFormat =
                beforeCategory +
                sequencePlaceholder +
                between +
                categoryPlaceholder +
                afterSequence;
            }
          }

          // Update the configuration
          await SequenceManagement.findByIdAndUpdate(config._id, {
            $set: {
              format: newFormat,
              updated_at: new Date(),
            },
          });

          console.log(
            `✅ Updated config for category ${config.category_id}: "${oldFormat}" -> "${newFormat}"`,
          );
          updatedCount++;
        } else {
          console.log(
            `⏭️  Skipped config for category ${config.category_id}: Format already matches new pattern or is different: "${oldFormat}"`,
          );
          skippedCount++;
        }
      }

      console.log('\n📊 Migration Summary:');
      console.log(`   ✅ Updated: ${updatedCount} configurations`);
      console.log(`   ⏭️  Skipped: ${skippedCount} configurations`);
      console.log(`   📝 Total: ${sequenceConfigs.length} configurations`);

      if (updatedCount > 0) {
        console.log('\n✅ Sequence Format Migration completed successfully!');
        console.log(
          '⚠️  Note: Existing machine sequences will not change. Only new sequences will use the new format.',
        );
      } else {
        console.log(
          '\nℹ️  No configurations needed updating. All formats are already in the new pattern.',
        );
      }
    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    }
  }

  /**
   * Preview what changes will be made without actually updating
   */
  static async previewChanges(): Promise<void> {
    try {
      console.log('👀 Previewing Sequence Format Migration Changes...\n');

      const sequenceConfigs = await SequenceManagement.find({})
        .populate('category_id', 'name slug')
        .populate('subcategory_id', 'name slug');

      if (sequenceConfigs.length === 0) {
        console.log('ℹ️  No sequence configurations found.');
        return;
      }

      let wouldUpdateCount = 0;
      let wouldSkipCount = 0;

      for (const config of sequenceConfigs) {
        const oldFormat = config.format;
        const categoryName =
          typeof config.category_id === 'object' &&
          config.category_id !== null &&
          'name' in config.category_id
            ? (config.category_id as { name: string }).name
            : 'Unknown';

        if (
          oldFormat.includes('{category}') &&
          oldFormat.includes('{sequence}') &&
          oldFormat.indexOf('{category}') < oldFormat.indexOf('{sequence}')
        ) {
          let newFormat = oldFormat;

          if (oldFormat === '{category}-{sequence}') {
            newFormat = '{sequence}-{category}';
          } else {
            const categoryIndex = oldFormat.indexOf('{category}');
            const sequenceIndex = oldFormat.indexOf('{sequence}');

            if (categoryIndex < sequenceIndex) {
              const beforeCategory = oldFormat.substring(0, categoryIndex);
              const categoryPlaceholder = '{category}';
              const between = oldFormat.substring(
                categoryIndex + categoryPlaceholder.length,
                sequenceIndex,
              );
              const sequencePlaceholder = '{sequence}';
              const afterSequence = oldFormat.substring(
                sequenceIndex + sequencePlaceholder.length,
              );

              newFormat =
                beforeCategory +
                sequencePlaceholder +
                between +
                categoryPlaceholder +
                afterSequence;
            }
          }

          console.log(`📝 Category: ${categoryName}`);
          console.log(`   Old: "${oldFormat}"`);
          console.log(`   New: "${newFormat}"`);
          console.log('');
          wouldUpdateCount++;
        } else {
          console.log(
            `⏭️  Category: ${categoryName} - Skipped (format: "${oldFormat}")`,
          );
          wouldSkipCount++;
        }
      }

      console.log('\n📊 Preview Summary:');
      console.log(`   Would Update: ${wouldUpdateCount} configurations`);
      console.log(`   Would Skip: ${wouldSkipCount} configurations`);
      console.log(`   Total: ${sequenceConfigs.length} configurations`);
    } catch (error) {
      console.error('❌ Preview failed:', error);
      throw error;
    }
  }
}

/**
 * CLI interface for running the migration
 */
if (require.main === module) {
  const command = process.argv[2];

  const runMigration = async () => {
    try {
      // Connect to MongoDB
      const mongoUri =
        process.env['MONGODB_URI'] || 'mongodb://localhost:27017/fluidpack';
      await mongoose.connect(mongoUri);

      console.log('✅ Connected to MongoDB\n');

      switch (command) {
        case 'migrate':
          await SequenceFormatMigration.updateSequenceFormats();
          break;
        case 'preview':
          await SequenceFormatMigration.previewChanges();
          break;
        default:
          console.log(
            'Usage: ts-node src/scripts/update-sequence-format.migration.ts [migrate|preview]',
          );
          console.log('\nCommands:');
          console.log('  preview  - Preview changes without updating');
          console.log('  migrate  - Apply the format changes');
          process.exit(1);
      }

      await mongoose.disconnect();
      console.log('\n✅ Disconnected from MongoDB');
      process.exit(0);
    } catch (error) {
      console.error('❌ Migration failed:', error);
      await mongoose.disconnect();
      process.exit(1);
    }
  };

  runMigration();
}

export { SequenceFormatMigration };
