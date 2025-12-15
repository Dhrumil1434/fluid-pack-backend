import mongoose from 'mongoose';
import { Machine } from '../models/machine.model';
import { SO } from '../models/so.model';

/**
 * Type for raw machine documents from MongoDB collection
 * (may include legacy fields from before SO migration)
 */
interface RawMachineDocument {
  _id: mongoose.Types.ObjectId;
  name?: string;
  category_id?: mongoose.Types.ObjectId | string;
  party_name?: string;
  mobile_number?: string;
  so_id?: mongoose.Types.ObjectId | null;
  [key: string]: unknown; // Allow other fields
}

/**
 * Type for machine documents with added migration fields
 */
interface MachineWithMigrationFields extends RawMachineDocument {
  _name: string;
  _categoryId: string | null;
  _partyName: string;
  _mobileNumber: string;
}

/**
 * Migration script to migrate existing machines to use SO references
 *
 * Strategy:
 * 1. Find all machines without so_id (or with old fields still present)
 * 2. Group machines by name + category_id + party_name
 * 3. For each unique combination, create one SO
 * 4. Link all machines with same combination to that SO
 * 5. Log migration results
 */
class MachineToSOMigration {
  private stats = {
    machinesProcessed: 0,
    machinesSkipped: 0,
    machinesUpdated: 0,
    soCreated: 0,
    soReused: 0,
    errors: 0,
  };

  /**
   * Run the complete migration
   */
  static async runMigration(): Promise<void> {
    const migration = new MachineToSOMigration();
    try {
      console.log('🚀 Starting Machine to SO Migration...\n');

      // Step 1: Check migration status
      await migration.checkMigrationStatus();

      // Step 2: Migrate machines
      await migration.migrateMachines();

      // Step 3: Verify migration
      await migration.verifyMigration();

      console.log('\n✅ Machine to SO Migration completed successfully!');
      migration.printStats();
    } catch (error) {
      console.error('❌ Migration failed:', error);
      migration.printStats();
      throw error;
    }
  }

  /**
   * Check migration status
   */
  async checkMigrationStatus(): Promise<void> {
    console.log('📊 Checking migration status...\n');

    // Count machines with so_id
    const machinesWithSO = await Machine.countDocuments({
      so_id: { $exists: true, $ne: null },
    });

    // Count machines without so_id (need migration)
    const machinesWithoutSO = await Machine.countDocuments({
      $or: [{ so_id: { $exists: false } }, { so_id: null }],
    });

    // Count total SOs
    const totalSOs = await SO.countDocuments({});

    console.log(`   Machines with SO: ${machinesWithSO}`);
    console.log(`   Machines without SO: ${machinesWithoutSO}`);
    console.log(`   Total SOs: ${totalSOs}\n`);

    if (machinesWithoutSO === 0) {
      console.log(
        '✅ All machines already have SO references. Migration not needed.',
      );
      return;
    }

    console.log(`⚠️  ${machinesWithoutSO} machines need migration.\n`);
  }

  /**
   * Migrate machines to use SO references
   */
  async migrateMachines(): Promise<void> {
    console.log('📝 Starting machine migration...\n');

    try {
      // Find machines without so_id using raw MongoDB query
      // We need to use the collection directly to access fields that might not be in the model
      const machineCollection = mongoose.connection.collection('machines');

      // Find machines that don't have so_id
      // Also check if they have old fields (name, category_id, party_name) that need migration
      const machinesToMigrate = await machineCollection
        .find({
          $or: [
            { so_id: { $exists: false } },
            { so_id: null },
            // Also include machines that have old fields but no so_id
            {
              $and: [
                { name: { $exists: true } },
                { category_id: { $exists: true } },
                { so_id: { $exists: false } },
              ],
            },
          ],
        })
        .toArray();

      if (machinesToMigrate.length === 0) {
        console.log('ℹ️  No machines found that need migration.');
        return;
      }

      console.log(`📦 Found ${machinesToMigrate.length} machines to migrate\n`);

      // Group machines by name + category_id + party_name
      const machineGroups = this.groupMachinesBySOFields(machinesToMigrate);

      console.log(
        `📊 Grouped into ${machineGroups.size} unique SO combinations\n`,
      );

      // Process each group
      for (const [groupKey, machines] of machineGroups.entries()) {
        await this.processMachineGroup(groupKey, machines);
      }

      console.log('\n📝 Machine migration completed!');
    } catch (error) {
      console.error('❌ Error during migration:', error);
      throw error;
    }
  }

  /**
   * Group machines by SO fields (name + category_id + party_name)
   */
  private groupMachinesBySOFields(
    machines: RawMachineDocument[],
  ): Map<string, MachineWithMigrationFields[]> {
    const groups = new Map<string, MachineWithMigrationFields[]>();

    for (const machine of machines) {
      // Extract old fields (they might still exist in the database)
      const name = machine.name || 'Unknown';
      const categoryId = machine.category_id
        ? machine.category_id.toString()
        : null;
      const partyName = machine.party_name || 'Unknown';
      const mobileNumber = machine.mobile_number || '';

      // Create group key
      const groupKey = `${name}::${categoryId}::${partyName}`;

      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }

      groups.get(groupKey)!.push({
        ...machine,
        _name: name,
        _categoryId: categoryId,
        _partyName: partyName,
        _mobileNumber: mobileNumber,
      });
    }

    return groups;
  }

  /**
   * Process a group of machines with the same SO fields
   */
  private async processMachineGroup(
    groupKey: string,
    machines: MachineWithMigrationFields[],
  ): Promise<void> {
    try {
      const firstMachine = machines[0];
      const name = firstMachine._name;
      const categoryId = firstMachine._categoryId;
      const partyName = firstMachine._partyName;
      const mobileNumber = firstMachine._mobileNumber;

      // Check if SO already exists with these fields
      let so = await SO.findOne({
        name: name,
        category_id: categoryId
          ? new mongoose.Types.ObjectId(categoryId)
          : undefined,
        party_name: partyName,
        deletedAt: null,
      });

      // If SO doesn't exist, create it
      if (!so) {
        if (!categoryId) {
          console.log(
            `⚠️  Skipping machines with group "${groupKey}" - missing category_id`,
          );
          this.stats.machinesSkipped += machines.length;
          return;
        }

        // Get created_by from first machine
        const createdBy = firstMachine.created_by
          ? new mongoose.Types.ObjectId(firstMachine.created_by)
          : undefined;

        // Create new SO
        so = new SO({
          name: name,
          category_id: new mongoose.Types.ObjectId(categoryId),
          subcategory_id: firstMachine.subcategory_id
            ? new mongoose.Types.ObjectId(firstMachine.subcategory_id)
            : null,
          party_name: partyName,
          mobile_number: mobileNumber || '0000000000', // Default if missing
          description: `Migrated SO for ${name} - ${partyName}`,
          is_active: true,
          created_by: createdBy,
          documents: firstMachine.documents || [],
        });

        await so.save();
        this.stats.soCreated++;
        console.log(
          `✅ Created SO: "${name}" for ${machines.length} machine(s)`,
        );
      } else {
        this.stats.soReused++;
        console.log(
          `♻️  Reusing existing SO: "${name}" for ${machines.length} machine(s)`,
        );
      }

      // Update all machines in this group with so_id
      for (const machine of machines) {
        try {
          await Machine.findByIdAndUpdate(machine._id, {
            $set: {
              so_id: so._id,
            },
          });

          this.stats.machinesUpdated++;
          this.stats.machinesProcessed++;
        } catch (error) {
          console.error(`❌ Error updating machine ${machine._id}:`, error);
          this.stats.errors++;
        }
      }
    } catch (error) {
      console.error(`❌ Error processing group "${groupKey}":`, error);
      this.stats.errors++;
      this.stats.machinesSkipped += machines.length;
    }
  }

  /**
   * Verify migration results
   */
  async verifyMigration(): Promise<void> {
    console.log('\n🔍 Verifying migration...\n');

    const machinesWithoutSO = await Machine.countDocuments({
      $or: [{ so_id: { $exists: false } }, { so_id: null }],
    });

    const machinesWithSO = await Machine.countDocuments({
      so_id: { $exists: true, $ne: null },
    });

    const totalMachines = await Machine.countDocuments({});
    const totalSOs = await SO.countDocuments({});

    console.log('📊 Verification Results:');
    console.log(`   Total Machines: ${totalMachines}`);
    console.log(`   Machines with SO: ${machinesWithSO}`);
    console.log(`   Machines without SO: ${machinesWithoutSO}`);
    console.log(`   Total SOs: ${totalSOs}\n`);

    if (machinesWithoutSO === 0) {
      console.log('✅ All machines have SO references!');
    } else {
      console.log(
        `⚠️  ${machinesWithoutSO} machines still need SO references.`,
      );
    }
  }

  /**
   * Print migration statistics
   */
  private printStats(): void {
    console.log('\n📊 Migration Statistics:');
    console.log(`   Machines Processed: ${this.stats.machinesProcessed}`);
    console.log(`   Machines Updated: ${this.stats.machinesUpdated}`);
    console.log(`   Machines Skipped: ${this.stats.machinesSkipped}`);
    console.log(`   SOs Created: ${this.stats.soCreated}`);
    console.log(`   SOs Reused: ${this.stats.soReused}`);
    console.log(`   Errors: ${this.stats.errors}`);
  }

  /**
   * Preview what changes will be made without actually updating
   */
  static async previewMigration(): Promise<void> {
    try {
      console.log('👀 Previewing Machine to SO Migration...\n');

      const machineCollection = mongoose.connection.collection('machines');
      const machinesToMigrate = await machineCollection
        .find({
          $or: [{ so_id: { $exists: false } }, { so_id: null }],
        })
        .toArray();

      if (machinesToMigrate.length === 0) {
        console.log('ℹ️  No machines found that need migration.');
        return;
      }

      // Group machines
      const migration = new MachineToSOMigration();
      const machineGroups =
        migration.groupMachinesBySOFields(machinesToMigrate);

      console.log(
        `📊 Would create/reuse ${machineGroups.size} SOs for ${machinesToMigrate.length} machines\n`,
      );

      // Show preview for each group
      for (const [, machines] of machineGroups.entries()) {
        const firstMachine = machines[0];
        const name = firstMachine._name;
        const partyName = firstMachine._partyName;
        const categoryId = firstMachine._categoryId;

        // Check if SO exists
        const existingSO = await SO.findOne({
          name: name,
          category_id: categoryId
            ? new mongoose.Types.ObjectId(categoryId)
            : undefined,
          party_name: partyName,
          deletedAt: null,
        });

        console.log(`📦 Group: "${name}" - ${partyName}`);
        console.log(`   Machines: ${machines.length}`);
        console.log(
          `   Action: ${existingSO ? 'Reuse existing SO' : 'Create new SO'}`,
        );
        if (existingSO) {
          console.log(`   SO ID: ${existingSO._id}`);
        }
        console.log('');
      }
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
          await MachineToSOMigration.runMigration();
          break;
        case 'preview':
          await MachineToSOMigration.previewMigration();
          break;
        default:
          console.log(
            'Usage: ts-node src/scripts/migrate-machines-to-so.migration.ts [migrate|preview]',
          );
          console.log('\nCommands:');
          console.log('  preview  - Preview changes without updating');
          console.log('  migrate  - Apply the migration');
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

export { MachineToSOMigration };
