// scripts/checkRoles.js
import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

const CONTRACT_ABI = [
  "function hasRole(bytes32 role, address account) public view returns (bool)",
  "function DEFAULT_ADMIN_ROLE() public view returns (bytes32)",
  "function STAFF_ROLE() public view returns (bytes32)",
  "function getStaffMembers() public view returns (address[])",
  "function isStaffMember(address) public view returns (bool)"
];

const CONTRACT_ADDRESS = "0xb00597076d75C504DEcb69c55B146f83819e61C1";
const RPC_URL = "https://rpc-amoy.polygon.technology";
const TARGET_WALLET = "0x7EDe510897C82b9469853a46cF5f431F04F081a9";

async function checkRoles() {
  try {
    console.log("🔗 Connecting to Polygon Amoy...");
    
    // Ethers v6 syntax - note the difference!
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

    console.log("📋 Contract Address:", CONTRACT_ADDRESS);
    console.log("🎯 Checking wallet:", TARGET_WALLET);
    console.log("━".repeat(60));

    // Get role identifiers
    const DEFAULT_ADMIN_ROLE = await contract.DEFAULT_ADMIN_ROLE();
    const STAFF_ROLE = await contract.STAFF_ROLE();

    console.log("🔑 DEFAULT_ADMIN_ROLE:", DEFAULT_ADMIN_ROLE);
    console.log("🔑 STAFF_ROLE:", STAFF_ROLE);
    console.log("━".repeat(60));

    // Check if wallet has admin role
    const hasAdmin = await contract.hasRole(DEFAULT_ADMIN_ROLE, TARGET_WALLET);
    console.log("👑 Has Admin Role:", hasAdmin ? "✅ YES" : "❌ NO");

    // Check if wallet has staff role
    const hasStaff = await contract.hasRole(STAFF_ROLE, TARGET_WALLET);
    console.log("👥 Has Staff Role:", hasStaff ? "✅ YES" : "❌ NO");

    // Check staff member list
    const isStaff = await contract.isStaffMember(TARGET_WALLET);
    console.log("📝 Is in Staff List:", isStaff ? "✅ YES" : "❌ NO");

    console.log("━".repeat(60));

    if (!hasAdmin && !hasStaff) {
      console.log("⚠️  WARNING: Wallet has NO roles!");
      console.log("📝 You need to grant either ADMIN or STAFF role to this wallet");
    } else if (hasAdmin) {
      console.log("✅ Wallet has ADMIN access - can perform all operations");
    } else if (hasStaff) {
      console.log("✅ Wallet has STAFF access - can perform staff operations");
    }

    // List all staff members
    const staffMembers = await contract.getStaffMembers();
    console.log("\n👥 Current Staff Members:", staffMembers.length);
    staffMembers.forEach((member, i) => {
      console.log(`   ${i + 1}. ${member}`);
    });

  } catch (error) {
    console.error("❌ Error:", error.message);
    if (error.stack) console.error("Stack:", error.stack);
  }
}

checkRoles();