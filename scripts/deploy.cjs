const hre = require("hardhat");

async function main() {
  console.log("🚀 Starting MedicineInventory deployment...\n");
  
  const [deployer] = await hre.ethers.getSigners();
  
  console.log("📝 Deploying contracts with account:", deployer.address);
  console.log("💰 Account balance:", (await hre.ethers.provider.getBalance(deployer.address)).toString());
  
  // Deploy the contract
  console.log("\n⏳ Deploying MedicineInventory contract...");
  const MedicineInventory = await hre.ethers.getContractFactory("MedicineInventory");
  const contract = await MedicineInventory.deploy(deployer.address);
  
  await contract.waitForDeployment();
  const contractAddress = await contract.getAddress();
  
  console.log("✅ Contract deployed to:", contractAddress);
  
  // Grant roles
  const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";
  const STAFF_ROLE = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("STAFF_ROLE"));
  
  console.log("\n🔐 Setting up roles...");
  console.log("Granting admin role to deployer:", deployer.address);
  await contract.grantRole(DEFAULT_ADMIN_ROLE, deployer.address);
  console.log("✅ Admin role granted");
  
  // ✅ ADD YOUR ACTUAL WALLET ADDRESS HERE
  const STAFF_ADDRESSES = [
    "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", // Admin (also gets staff role)
    "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", // San Jose Staff
    "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", // Malaya Staff
    "0x90F79bf6EB2c4f870365E785982E1f101E93b906"  // Sumilang Staff
  ];
  
  // Grant staff roles
  console.log("\n👥 Granting staff roles...");
  for (const staffAddress of STAFF_ADDRESSES) {
    if (staffAddress.toLowerCase() !== deployer.address.toLowerCase()) {
      console.log("Granting staff role to:", staffAddress);
      try {
        const tx = await contract.grantStaffRole(staffAddress);
        await tx.wait();
        console.log("✅ Staff role granted to", staffAddress);
        
        // Verify
        const hasRole = await contract.hasRole(STAFF_ROLE, staffAddress);
        console.log("   Verification:", hasRole ? "SUCCESS" : "FAILED");
      } catch (error) {
        console.error("❌ Failed to grant role to", staffAddress, error.message);
      }
    }
  }
  
  // Verify deployment with initial counts
  console.log("\n🔍 Verifying deployment...");
  const medicineCount = await contract.getMedicineCount();
  const receiptCount = await contract.getReceiptCount();
  const removalCount = await contract.getRemovalCount();
  const staffCount = await contract.getStaffCount();
  
  console.log("📊 Initial contract state:");
  console.log("  - Medicine hashes:", medicineCount.toString());
  console.log("  - Receipt hashes:", receiptCount.toString());
  console.log("  - Removal hashes:", removalCount.toString());
  console.log("  - Staff members:", staffCount.toString());
  
  // List all staff members
  const staffMembers = await contract.getStaffMembers();
  console.log("\n👥 Staff members:");
  staffMembers.forEach((member, index) => {
    console.log(`  ${index + 1}. ${member}`);
  });
  
  // Save deployment info to file
  const fs = require("fs");
  const path = require("path");
  
  const deploymentInfo = {
    network: hre.network.name,
    contractAddress: contractAddress,
    adminAddress: deployer.address,
    staffAddresses: staffMembers,
    deploymentTime: new Date().toISOString(),
    blockNumber: await hre.ethers.provider.getBlockNumber(),
    roles: {
      defaultAdmin: DEFAULT_ADMIN_ROLE,
      staffRole: STAFF_ROLE
    }
  };
  
  const deploymentPath = path.join(__dirname, "..", "deployment-info.json");
  fs.writeFileSync(
    deploymentPath,
    JSON.stringify(deploymentInfo, null, 2)
  );
  
  console.log("\n💾 Deployment info saved to deployment-info.json");
  
  // Display important information
  console.log("\n" + "=".repeat(60));
  console.log("📋 DEPLOYMENT SUMMARY");
  console.log("=".repeat(60));
  console.log("Contract Address:", contractAddress);
  console.log("Deployer:", deployer.address);
  console.log("Network:", hre.network.name);
  console.log("Staff Count:", staffCount.toString());
  console.log("=".repeat(60));
  
  console.log("\n✅ Deployment complete!\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Deployment failed:", error);
    process.exitCode = 1;
  });