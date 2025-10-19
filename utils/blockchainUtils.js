// utils/blockchainUtils.js
import { ethers } from "ethers";
import { createRequire } from "module";
import crypto from "crypto";
import dotenv from "dotenv";
import prisma from "../config/prismaClient.js";

// ✅ CRITICAL: Load environment variables FIRST
dotenv.config();

const require = createRequire(import.meta.url);
const contractJson = require("../abi/ContractABI.json");
const contractABI = contractJson.abi || contractJson;

class BlockchainService {
  constructor() {
    try {
      // ✅ Validate environment variables
      const privateKey = process.env.PRIVATE_KEY;
      const rpcUrl = process.env.RPC_URL;
      const contractAddress = process.env.CONTRACT_ADDRESS;

      if (!privateKey) {
        throw new Error("❌ PRIVATE_KEY is not set in environment variables");
      }

      if (!privateKey.startsWith('0x') || privateKey.length !== 66) {
        throw new Error(
          `❌ Invalid PRIVATE_KEY format. Expected 0x + 64 hex characters. Got length: ${privateKey.length}`
        );
      }

      if (!rpcUrl) {
        throw new Error("❌ RPC_URL is not set in environment variables");
      }

      if (!contractAddress) {
        throw new Error("❌ CONTRACT_ADDRESS is not set in environment variables");
      }

      console.log("✅ Environment variables validated");
      console.log("📡 RPC URL:", rpcUrl);
      console.log("📝 Contract Address:", contractAddress);

      // Initialize provider, wallet, and contract
      this.provider = new ethers.JsonRpcProvider(rpcUrl);
      this.wallet = new ethers.Wallet(privateKey, this.provider);
      this.contract = new ethers.Contract(
        contractAddress,
        contractABI,
        this.wallet
      );

      console.log("✅ Blockchain service initialized successfully");
      console.log("👛 Wallet Address:", this.wallet.address);

    } catch (error) {
      console.error("❌ BlockchainService initialization failed:", error.message);
      throw error;
    }
  }

  async getUserIdByWallet(walletAddress) {
    try {
      const user = await prisma.users.findUnique({
        where: { wallet_address: walletAddress.toLowerCase() },
      });
      return user ? user.user_id : null;
    } catch (err) {
      console.error("❌ Error resolving wallet to user:", err.message);
      return null;
    }
  }

  // ✅ Generate hash for removal data
  generateRemovalHash(removalData) {
    const dataString = JSON.stringify({
      removal_id: removalData.removal_id,
      stock_id: removalData.stock_id,
      medicine_id: removalData.medicine_id,
      quantity_removed: removalData.quantity_removed,
      reason: removalData.reason,
      date_removed: removalData.date_removed?.toISOString() || removalData.date_removed,
      notes: removalData.notes || ''
    });
    
    return '0x' + crypto.createHash('sha256').update(dataString).digest('hex');
  }

  // ✅ Sync removal to blockchain
  async syncRemovalToBlockchain(removalData) {
    try {
      const dataHash = this.generateRemovalHash(removalData);
      
      console.log(`📝 Syncing removal ${removalData.removal_id} to blockchain...`);
      
      const tx = await this.contract.storeRemovalHash(
        removalData.removal_id,
        dataHash
      );
      
      console.log(`⏳ Transaction sent: ${tx.hash}`);
      
      const receipt = await tx.wait();
      console.log(`✅ Removal synced to blockchain. Block: ${receipt.blockNumber}`);
      
      // Update database with blockchain info
      await prisma.stock_removals.update({
        where: { removal_id: removalData.removal_id },
        data: {
          blockchain_hash: dataHash,
          blockchain_tx_hash: receipt.hash,
          removed_by_wallet: this.wallet.address,
          last_synced_at: new Date()
        }
      });
      
      // Log blockchain transaction
      await prisma.blockchain_transactions.create({
        data: {
          tx_hash: receipt.hash,
          block_number: BigInt(receipt.blockNumber),
          contract_address: process.env.CONTRACT_ADDRESS,
          action_type: 'STORE',
          entity_type: 'REMOVAL',
          entity_id: removalData.removal_id,
          from_address: this.wallet.address,
          gas_used: receipt.gasUsed ? BigInt(receipt.gasUsed.toString()) : null,
          event_data: {
            removal_id: removalData.removal_id,
            medicine_id: removalData.medicine_id,
            stock_id: removalData.stock_id,
            quantity_removed: removalData.quantity_removed,
            reason: removalData.reason,
            data_hash: dataHash
          },
          status: 'CONFIRMED',
          confirmed_at: new Date()
        }
      });
      
      return { success: true, txHash: receipt.hash, dataHash };
    } catch (err) {
      console.error("❌ Error syncing removal to blockchain:", err.message);
      throw err;
    }
  }

  async saveEventToDb({ tx_hash, action_type, entity_type, entity_id, from_address, event_data }) {
    try {
      const walletAddr = from_address?.toLowerCase();
      const userId = await this.getUserIdByWallet(walletAddr);

      const existing = await prisma.blockchain_transactions.findFirst({
        where: { tx_hash, action_type, entity_type, entity_id },
      });

      if (existing) {
        console.log(`⏭️ Event already processed: ${action_type} ${entity_type} ${entity_id}`);
        return;
      }

      await prisma.blockchain_transactions.create({
        data: {
          tx_hash,
          action_type,
          entity_type,
          entity_id,
          from_address: walletAddr,
          event_data,
          status: "CONFIRMED",
        },
      });

      await prisma.audit_log.create({
        data: {
          table_name: entity_type.toLowerCase(),
          record_id: entity_id,
          action: action_type,
          old_values: event_data.oldHash ? { hash: event_data.oldHash } : null,
          new_values: event_data.newHash ? { hash: event_data.newHash } : event_data,
          changed_by_wallet: walletAddr,
          changed_at: new Date(event_data.timestamp * 1000),
          ...(userId && {
            changed_by_user: { connect: { user_id: userId } }
          }),
        },
      });

      console.log(`✅ Saved event: ${action_type} ${entity_type} ${entity_id}`);
    } catch (err) {
      console.error("❌ Error saving event to DB:", err.message);
    }
  }

  async listenToBlockchainEvents() {
    console.log("✅ Blockchain event listener started");

    // Medicine events
    this.contract.on("MedicineHashStored", async (medicineId, dataHash, addedBy, timestamp, event) => {
      console.log("📦 MedicineHashStored:", medicineId.toString());
      await this.saveEventToDb({
        tx_hash: event.log.transactionHash,
        action_type: "STORE",
        entity_type: "MEDICINE",
        entity_id: Number(medicineId),
        from_address: addedBy,
        event_data: { dataHash, timestamp: Number(timestamp) },
      });
    });

    this.contract.on("MedicineHashUpdated", async (medicineId, oldHash, newHash, updatedBy, timestamp, event) => {
      console.log("✏️ MedicineHashUpdated:", medicineId.toString());
      await this.saveEventToDb({
        tx_hash: event.log.transactionHash,
        action_type: "UPDATE",
        entity_type: "MEDICINE",
        entity_id: Number(medicineId),
        from_address: updatedBy,
        event_data: { oldHash, newHash, timestamp: Number(timestamp) },
      });
    });

    this.contract.on("MedicineHashDeleted", async (medicineId, deletedBy, timestamp, event) => {
      console.log("🗑️ MedicineHashDeleted:", medicineId.toString());
      await this.saveEventToDb({
        tx_hash: event.log.transactionHash,
        action_type: "DELETE",
        entity_type: "MEDICINE",
        entity_id: Number(medicineId),
        from_address: deletedBy,
        event_data: { timestamp: Number(timestamp) },
      });
    });

    // Receipt events
    this.contract.on("ReceiptHashStored", async (receiptId, dataHash, addedBy, timestamp, event) => {
      console.log("📥 ReceiptHashStored:", receiptId.toString());
      await this.saveEventToDb({
        tx_hash: event.log.transactionHash,
        action_type: "STORE",
        entity_type: "RECEIPT",
        entity_id: Number(receiptId),
        from_address: addedBy,
        event_data: { dataHash, timestamp: Number(timestamp) },
      });
    });

    this.contract.on("ReceiptHashUpdated", async (receiptId, oldHash, newHash, updatedBy, timestamp, event) => {
      console.log("✏️ ReceiptHashUpdated:", receiptId.toString());
      await this.saveEventToDb({
        tx_hash: event.log.transactionHash,
        action_type: "UPDATE",
        entity_type: "RECEIPT",
        entity_id: Number(receiptId),
        from_address: updatedBy,
        event_data: { oldHash, newHash, timestamp: Number(timestamp) },
      });
    });

    this.contract.on("ReceiptHashDeleted", async (receiptId, deletedBy, timestamp, event) => {
      console.log("🗑️ ReceiptHashDeleted:", receiptId.toString());
      await this.saveEventToDb({
        tx_hash: event.log.transactionHash,
        action_type: "DELETE",
        entity_type: "RECEIPT",
        entity_id: Number(receiptId),
        from_address: deletedBy,
        event_data: { timestamp: Number(timestamp) },
      });
    });

    // ✅ Removal events
    this.contract.on("RemovalHashStored", async (removalId, dataHash, removedBy, timestamp, event) => {
      console.log("🗑️ RemovalHashStored:", removalId.toString());
      await this.saveEventToDb({
        tx_hash: event.log.transactionHash,
        action_type: "STORE",
        entity_type: "REMOVAL",
        entity_id: Number(removalId),
        from_address: removedBy,
        event_data: { dataHash, timestamp: Number(timestamp) },
      });
    });

    this.contract.on("RemovalHashUpdated", async (removalId, oldHash, newHash, updatedBy, timestamp, event) => {
      console.log("✏️ RemovalHashUpdated:", removalId.toString());
      await this.saveEventToDb({
        tx_hash: event.log.transactionHash,
        action_type: "UPDATE",
        entity_type: "REMOVAL",
        entity_id: Number(removalId),
        from_address: updatedBy,
        event_data: { oldHash, newHash, timestamp: Number(timestamp) },
      });
    });

    this.contract.on("RemovalHashDeleted", async (removalId, deletedBy, timestamp, event) => {
      console.log("🗑️ RemovalHashDeleted:", removalId.toString());
      await this.saveEventToDb({
        tx_hash: event.log.transactionHash,
        action_type: "DELETE",
        entity_type: "REMOVAL",
        entity_id: Number(removalId),
        from_address: deletedBy,
        event_data: { timestamp: Number(timestamp) },
      });
    });

    // Staff Role events
    this.contract.on("StaffRoleGranted", async (staff, admin, timestamp, event) => {
      console.log("👤 StaffRoleGranted:", staff);
      await this.saveEventToDb({
        tx_hash: event.log.transactionHash,
        action_type: "GRANT_ROLE",
        entity_type: "STAFF",
        entity_id: null,
        from_address: admin,
        event_data: { staff, timestamp: Number(timestamp) },
      });
    });

    this.contract.on("StaffRoleRevoked", async (staff, admin, timestamp, event) => {
      console.log("🚫 StaffRoleRevoked:", staff);
      await this.saveEventToDb({
        tx_hash: event.log.transactionHash,
        action_type: "REVOKE_ROLE",
        entity_type: "STAFF",
        entity_id: null,
        from_address: admin,
        event_data: { staff, timestamp: Number(timestamp) },
      });
    });
  }

  stopListening() {
    if (this.contract) {
      this.contract.removeAllListeners();
      console.log("⛔ Blockchain event listeners stopped");
    }
  }
}

export default new BlockchainService();