/**
 * Clear All AURA Data from MongoDB
 *
 * Deletes all documents from the main collections for a fresh testing start.
 * Uses MONGODB_URI from server/.env
 *
 * Usage:
 *   node server/scripts/clear-all-data.js
 *   node server/scripts/clear-all-data.js --dry-run
 *   node server/scripts/clear-all-data.js --uri "mongodb://localhost:27017/mydb"
 *
 * Or from server dir:
 *   npm run clear-data
 *   npm run clear-data -- --dry-run
 *
 * Environment:
 *   MONGODB_URI - MongoDB connection string (from server/.env)
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const { MongoClient } = require('mongodb');

const uriArg = process.argv.find(a => a.startsWith('--uri='));
const MONGO_URI = (uriArg ? uriArg.replace('--uri=', '') : process.env.MONGODB_URI)?.trim();

const COLLECTIONS = [
  'users',
  'stats',
  'interactions',
  'aggregatedinteractionbatches',
  'onboardingsessions',
  'onboardingliteracyresults',
  'onboardingvisionresults',
  'onboardingmotorresults',
  'impairmentprofiles',
  'motorattemptbuckets',
  'motorpointertracebuckets',
  'motorroundsummaries',
  'motorsessionsummaries',
  'globalinteractionbuckets', // legacy, if it exists
];

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  if (dryRun) {
    console.log('🔍 DRY RUN – no documents will be deleted\n');
  }

  if (!MONGO_URI) {
    console.error('❌ Set MONGODB_URI in server/.env');
    process.exit(1);
  }

  let client;
  try {
    client = new MongoClient(MONGO_URI);
    await client.connect();
    console.log('✅ Connected to MongoDB\n');

    const db = client.db();
    let totalDeleted = 0;

    for (const name of COLLECTIONS) {
      try {
        const coll = db.collection(name);
        const count = await coll.countDocuments();
        if (count === 0) continue;

        if (dryRun) {
          console.log(`  [DRY RUN] ${name}: would delete ${count}`);
        } else {
          const result = await coll.deleteMany({});
          console.log(`  ✓ ${name}: deleted ${result.deletedCount}`);
          totalDeleted += result.deletedCount;
        }
      } catch (err) {
        if (err.code === 26) {
          // Collection does not exist
          continue;
        }
        console.warn(`  ⚠ ${name}: ${err.message}`);
      }
    }

    if (dryRun) {
      console.log('\n[DRY RUN] Run without --dry-run to actually delete');
    } else {
      console.log(`\n✅ Done. Total documents deleted: ${totalDeleted}`);
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    if (client) await client.close();
    console.log('\n🔌 Disconnected');
  }
}

main();
