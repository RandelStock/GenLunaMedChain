// scripts/test-removal-blockchain.js
// Run this after deploying to test removal blockchain integration

require("dotenv").config();  // <-- load .env
const hre = require("hardhat");

async function main() {
  console.log("🧪 Testing Removal Blockchain Integration\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Testing with account:", deployer.address);

  // ✅ Load from .env only
  const contractAddress = process.env.CONTRACT_ADDRESS;
  if (!contractAddress) {
    throw new Error("❌ CONTRACT_ADDRESS not found in .env");
  }

  const MedicineInventory = await hre.ethers.getContractFactory("MedicineInventory");
  const contract = MedicineInventory.attach(contractAddress);

  console.log("Contract address:", contractAddress);

  // Test 1: Store a test removal hash
  console.log("\n📝 Test 1: Storing removal hash...");
  const testRemovalId = 999;
  const testHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("test_removal_data"));
  
  try {
    const tx = await contract.storeRemovalHash(testRemovalId, testHash);
    console.log("Transaction sent:", tx.hash);
    
    const receipt = await tx.wait();
    console.log("✅ Removal hash stored! Gas used:", receipt.gasUsed.toString());
    console.log("Block number:", receipt.blockNumber);
  } catch (err) {
    console.error("❌ Failed to store removal hash:", err);
    return;
  }

  // Test 2: Retrieve the removal hash
  console.log("\n🔍 Test 2: Retrieving removal hash...");
  try {
    const [hash, removedBy, timestamp, exists] = await contract.getRemovalHash(testRemovalId);
    console.log("✅ Removal hash retrieved!");
    console.log("  Hash:", hash);
    console.log("  Removed by:", removedBy);
    console.log("  Timestamp:", new Date(Number(timestamp) * 1000).toISOString());
    console.log("  Exists:", exists);
  } catch (err) {
    console.error("❌ Failed to retrieve removal hash:", err);
  }

  // Test 3: Verify the removal hash
  console.log("\n✔️  Test 3: Verifying removal hash...");
  try {
    const isValid = await contract.verifyRemovalHash(testRemovalId, testHash);
    console.log("✅ Hash verification result:", isValid);
  } catch (err) {
    console.error("❌ Failed to verify removal hash:", err);
  }

  // Test 4: Check removal count
  console.log("\n📊 Test 4: Checking removal count...");
  try {
    const count = await contract.getRemovalCount();
    console.log("✅ Total removals on blockchain:", count.toString());
  } catch (err) {
    console.error("❌ Failed to get removal count:", err);
  }

  // Test 5: Update removal hash
  console.log("\n✏️  Test 5: Updating removal hash...");
  const newTestHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("updated_test_removal_data"));
  try {
    const tx = await contract.updateRemovalHash(testRemovalId, newTestHash);
    console.log("Transaction sent:", tx.hash);
    
    await tx.wait();
    console.log("✅ Removal hash updated!");
    
    // Verify new hash
    const [hash] = await contract.getRemovalHash(testRemovalId);
    console.log("New hash:", hash);
    console.log("Matches expected:", hash === newTestHash);
  } catch (err) {
    console.error("❌ Failed to update removal hash:", err);
  }

  // Test 6: Delete removal hash (cleanup)
  console.log("\n🗑️  Test 6: Deleting test removal hash...");
  try {
    const tx = await contract.deleteRemovalHash(testRemovalId);
    await tx.wait();
    console.log("✅ Test removal hash deleted!");
    
    // Verify deletion
    const [, , , exists] = await contract.getRemovalHash(testRemovalId);
    console.log("Exists after deletion:", exists);
  } catch (err) {
    console.error("❌ Failed to delete removal hash:", err);
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("📋 TEST SUMMARY");
  console.log("=".repeat(60));
  console.log("✅ All basic removal blockchain functions are working!");
  console.log("=".repeat(60));
  
  console.log("\n📝 Next steps:");
  console.log("1. Test from your backend API:");
  console.log("   POST http://localhost:4000/removals");
  console.log("   with removal data");
  console.log("\n2. Check blockchain sync in database:");
  console.log("   SELECT * FROM stock_removals WHERE blockchain_hash IS NOT NULL;");
  console.log("\n3. Verify on blockchain:");
  console.log("   GET http://localhost:4000/verify/removal/:id");
  
  console.log("\n✅ Testing complete!\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Testing failed:", error);
    process.exitCode = 1;
  });
