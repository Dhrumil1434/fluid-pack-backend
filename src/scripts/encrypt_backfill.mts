// ts-node script: Backfill-encrypt existing machine records
import mongoose from 'mongoose';
import { Machine } from '../models/machine.model';
import { encryptObject, encryptString, hmacDeterministic } from '../utils/crypto.util';

async function run() {
  const MONGO_URI = process.env['MONGO_URI'] || 'mongodb://localhost:27017/fluid-pack';
  await mongoose.connect(MONGO_URI);
  const cursor = Machine.find({}).cursor();
  let count = 0;
  for await (const doc of cursor) {
    const anyDoc: any = doc as any;
    let changed = false;
    if (anyDoc.name && typeof anyDoc.name === 'string' && !anyDoc.name.includes(':')) {
      // looks like plaintext name; encrypt
      anyDoc.nameHash = hmacDeterministic(String(anyDoc.name).trim().toLowerCase());
      anyDoc.name = encryptString(String(anyDoc.name));
      changed = true;
    }
    if (anyDoc.metadata && typeof anyDoc.metadata !== 'string') {
      anyDoc.metadata = encryptObject(anyDoc.metadata || {});
      changed = true;
    }
    if (changed) {
      await anyDoc.save();
      count += 1;
    }
  }
  console.log(`Backfill completed. Encrypted ${count} records.`);
  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});


