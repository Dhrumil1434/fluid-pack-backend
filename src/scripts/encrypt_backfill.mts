// ts-node script: Backfill-encrypt existing machine records
import mongoose from 'mongoose';
import { Machine, IMachine } from '../models/machine.model';
import {
  encryptObject,
  encryptString,
  hmacDeterministic,
} from '../utils/crypto.util.js';

interface EncryptedMachine extends Omit<IMachine, 'metadata'> {
  metadata: string | Record<string, unknown>;
}

async function run() {
  const MONGO_URI =
    process.env['MONGO_URI'] || 'mongodb://localhost:27017/fluid-pack';
  await mongoose.connect(MONGO_URI);
  const cursor = Machine.find({}).cursor();
  let count = 0;
  for await (const doc of cursor) {
    const machineDoc = doc as EncryptedMachine & mongoose.Document;
    let changed = false;
    if (
      machineDoc.name &&
      typeof machineDoc.name === 'string' &&
      !machineDoc.name.includes(':')
    ) {
      // looks like plaintext name; encrypt
      machineDoc.nameHash = hmacDeterministic(
        String(machineDoc.name).trim().toLowerCase(),
      );
      machineDoc.name = encryptString(String(machineDoc.name));
      changed = true;
    }
    if (machineDoc.metadata && typeof machineDoc.metadata === 'object') {
      machineDoc.metadata = encryptObject(
        machineDoc.metadata as Record<string, unknown>,
      );
      changed = true;
    }
    if (changed) {
      await machineDoc.save();
      count += 1;
    }
  }
  console.log(`Backfill completed. Encrypted ${count} records.`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
