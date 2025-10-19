// scripts/cleanupDuplicates.js
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function cleanupDuplicateTransactions() {
  try {
    console.log("🔍 Finding duplicate transactions...");

    // Get all transactions
    const allTransactions = await prisma.blockchain_transactions.findMany({
      orderBy: [
        { tx_hash: 'asc' },
        { transaction_id: 'asc' }
      ]
    });

    console.log(`📊 Total transactions found: ${allTransactions.length}`);

    // Group by unique key: tx_hash + action_type + entity_type + entity_id
    const uniqueMap = new Map();
    const duplicates = [];

    for (const tx of allTransactions) {
      const key = `${tx.tx_hash}-${tx.action_type}-${tx.entity_type}-${tx.entity_id}`;
      
      if (uniqueMap.has(key)) {
        // This is a duplicate, mark for deletion
        duplicates.push(tx.transaction_id);
        console.log(`🔴 Duplicate found: ID ${tx.transaction_id} (${key})`);
      } else {
        // Keep the first occurrence
        uniqueMap.set(key, tx.transaction_id);
      }
    }

    if (duplicates.length === 0) {
      console.log("✅ No duplicates found!");
      return;
    }

    console.log(`\n🗑️  Found ${duplicates.length} duplicate(s) to remove`);
    console.log("Keeping the first occurrence of each unique event...\n");

    // Delete duplicates in batches
    const batchSize = 100;
    let deleted = 0;

    for (let i = 0; i < duplicates.length; i += batchSize) {
      const batch = duplicates.slice(i, i + batchSize);
      
      const result = await prisma.blockchain_transactions.deleteMany({
        where: {
          transaction_id: {
            in: batch
          }
        }
      });

      deleted += result.count;
      console.log(`✅ Deleted batch: ${result.count} records (${deleted}/${duplicates.length})`);
    }

    console.log(`\n✨ Cleanup complete! Removed ${deleted} duplicate transaction(s)`);
    
    // Verify final count
    const finalCount = await prisma.blockchain_transactions.count();
    console.log(`📊 Final transaction count: ${finalCount}`);

  } catch (error) {
    console.error("❌ Error during cleanup:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the cleanup
cleanupDuplicateTransactions()
  .then(() => {
    console.log("\n✅ Script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Script failed:", error);
    process.exit(1);
  });