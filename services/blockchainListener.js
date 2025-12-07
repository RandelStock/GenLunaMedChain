// backend/services/blockchainListener.js
import { ethers } from "ethers";
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load contract ABI (Node.js v22 compatible - no import assertion)
let ContractABI = { abi: [] };
try {
  const abiPath = path.join(__dirname, "../contracts/MedicineInventory.json");
  const abiData = fs.readFileSync(abiPath, "utf8");
  ContractABI = JSON.parse(abiData);
  if (!ContractABI.abi) {
    ContractABI.abi = ContractABI;
  }
} catch (err) {
  console.error("❌ Failed to load contract ABI:", err.message);
}

const prisma = new PrismaClient();

class BlockchainListener {
  constructor() {
    this.provider = null;
    this.contract = null;
    this.isListening = false;
    this.pollingInterval = null;
    this.lastBlock = 0;
  }

  /**
   * Initialize connection to blockchain
   */
  async initialize(rpcUrl, contractAddress) {
    try {
      this.provider = new ethers.providers.JsonRpcProvider(rpcUrl || "http://127.0.0.1:8545");
      this.contract = new ethers.Contract(contractAddress, ContractABI.abi || ContractABI, this.provider);
      
      console.log("✅ Blockchain listener initialized");
      console.log("📍 Contract:", contractAddress);
      console.log("🌐 RPC:", rpcUrl || "http://127.0.0.1:8545");
      
      // Get current block number
      this.lastBlock = await this.provider.getBlockNumber();
      
      return true;
    } catch (error) {
      console.error("❌ Failed to initialize blockchain listener:", error);
      return false;
    }
  }

  /**
   * Start listening to blockchain events using polling instead of filters
   */
  async startListening() {
    if (!this.contract) {
      console.error("❌ Contract not initialized. Call initialize() first.");
      return;
    }

    if (this.isListening) {
      console.log("⚠️ Already listening to blockchain events");
      return;
    }

    this.isListening = true;
    console.log("👂 Started listening to blockchain events (polling mode)...");

    // Use polling instead of event filters to avoid "filter not found" errors
    this.pollingInterval = setInterval(async () => {
      try {
        await this.pollForNewEvents();
      } catch (error) {
        // Silently handle polling errors to avoid spam
        if (!error.message?.includes('filter not found')) {
          console.error("Polling error:", error.message);
        }
      }
    }, 15000); // Poll every 15 seconds
  }

  /**
   * Poll for new events instead of using live filters
   */
  async pollForNewEvents() {
    try {
      const currentBlock = await this.provider.getBlockNumber();
      
      if (currentBlock <= this.lastBlock) {
        return; // No new blocks
      }

      // Query events from last checked block to current
      const fromBlock = this.lastBlock + 1;
      const toBlock = currentBlock;

      // Check for MedicineAddedFull events
      const medicineFilter = this.contract.filters.MedicineAddedFull();
      const medicineEvents = await this.contract.queryFilter(medicineFilter, fromBlock, toBlock);

      for (const event of medicineEvents) {
        console.log("📦 MedicineAddedFull event detected:", {
          index: event.args.index.toString(),
          name: event.args.name,
          batchNumber: event.args.batchNumber,
          tx: event.transactionHash
        });

        await this.handleMedicineAdded({
          index: parseInt(event.args.index.toString()),
          name: event.args.name,
          batchNumber: event.args.batchNumber,
          notes: event.args.notes,
          quantity: parseInt(event.args.quantity.toString()),
          expirationDate: parseInt(event.args.expirationDate.toString()),
          location: event.args.location,
          timestamp: parseInt(event.args.timestamp.toString()),
          transactionHash: event.transactionHash,
          blockNumber: event.blockNumber
        });
      }

      // Check for MedicineHistoryLog events
      const historyFilter = this.contract.filters.MedicineHistoryLog();
      const historyEvents = await this.contract.queryFilter(historyFilter, fromBlock, toBlock);

      for (const event of historyEvents) {
        console.log("📝 MedicineHistoryLog event:", {
          medicineId: event.args.medicineId.toString(),
          action: event.args.action,
          description: event.args.description
        });

        await prisma.audit_log.create({
          data: {
            table_name: "medicine_records",
            record_id: parseInt(event.args.medicineId.toString()),
            action: event.args.action,
            old_values: { [event.args.fieldChanged]: event.args.oldValue },
            new_values: { [event.args.fieldChanged]: event.args.newValue },
            changed_at: new Date(parseInt(event.args.timestamp.toString()) * 1000)
          }
        });
      }

      // Check for StaffRoleGranted events
      const staffFilter = this.contract.filters.StaffRoleGranted();
      const staffEvents = await this.contract.queryFilter(staffFilter, fromBlock, toBlock);

      for (const event of staffEvents) {
        console.log("👤 Staff role granted:", {
          staff: event.args.staff,
          admin: event.args.admin,
          tx: event.transactionHash
        });

        await prisma.blockchain_transactions.create({
          data: {
            tx_hash: event.transactionHash,
            block_number: BigInt(event.blockNumber),
            action_type: "GRANT_STAFF_ROLE",
            entity_type: "USER",
            from_address: event.args.admin,
            event_data: { staff: event.args.staff, admin: event.args.admin },
            status: "CONFIRMED",
            confirmed_at: new Date()
          }
        });
      }

      // Update last processed block
      this.lastBlock = currentBlock;

    } catch (error) {
      // Only log non-filter errors
      if (!error.message?.includes('filter not found')) {
        console.error("Error polling for events:", error.message);
      }
    }
  }

  /**
   * Stop listening to events
   */
  stopListening() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    
    if (this.contract) {
      this.contract.removeAllListeners();
    }
    
    this.isListening = false;
    console.log("🛑 Stopped listening to blockchain events");
  }

  /**
   * Handle MedicineAdded event - sync to database
   */
  async handleMedicineAdded(eventData) {
    try {
      // Check if already exists in database
      const existing = await prisma.medicine_records.findUnique({
        where: { medicine_id: eventData.index }
      });

      if (existing) {
        console.log("Medicine already exists in database, skipping...");
        return;
      }

      // Log blockchain transaction
      await prisma.blockchain_transactions.create({
        data: {
          tx_hash: eventData.transactionHash,
          block_number: BigInt(eventData.blockNumber),
          action_type: "ADD_MEDICINE",
          entity_type: "MEDICINE",
          entity_id: eventData.index,
          event_data: eventData,
          status: "CONFIRMED",
          confirmed_at: new Date()
        }
      });

      console.log("✅ Blockchain transaction logged for medicine:", eventData.index);

      // Update medicine record to reflect on-chain confirmation
      try {
        await prisma.medicine_records.update({
          where: { medicine_id: eventData.index },
          data: {
            blockchain_tx_hash: eventData.transactionHash,
            last_synced_at: new Date(),
            blockchain_status: 'CONFIRMED'
          }
        });

        console.log(`🔁 medicine_records#${eventData.index} marked CONFIRMED`);
      } catch (updateErr) {
        // Log but don't throw; we'll still have the blockchain_transactions record
        console.error('❌ Failed to mark medicine as CONFIRMED:', updateErr.message);
      }

    } catch (error) {
      console.error("❌ Error handling medicine added event:", error);
      throw error;
    }
  }

  /**
   * Sync all past events from a specific block
   */
  async syncPastEvents(fromBlock = 0) {
    if (!this.contract) {
      console.error("Contract not initialized");
      return;
    }

    try {
      console.log(`🔄 Syncing past events from block ${fromBlock}...`);

      const filter = this.contract.filters.MedicineAddedFull();
      const events = await this.contract.queryFilter(filter, fromBlock, "latest");

      console.log(`Found ${events.length} past MedicineAddedFull events`);

      for (const event of events) {
        const { index, name, batchNumber, notes, quantity, expirationDate, location, timestamp } = event.args;

        await this.handleMedicineAdded({
          index: parseInt(index.toString()),
          name,
          batchNumber,
          notes,
          quantity: parseInt(quantity.toString()),
          expirationDate: parseInt(expirationDate.toString()),
          location,
          timestamp: parseInt(timestamp.toString()),
          transactionHash: event.transactionHash,
          blockNumber: event.blockNumber
        });
      }

      console.log("✅ Past events synced successfully");
    } catch (error) {
      console.error("❌ Error syncing past events:", error);
    }
  }

  /**
   * Get current block number
   */
  async getCurrentBlock() {
    if (!this.provider) {
      console.error("Provider not initialized");
      return null;
    }

    try {
      const blockNumber = await this.provider.getBlockNumber();
      return blockNumber;
    } catch (error) {
      console.error("Error getting block number:", error);
      return null;
    }
  }

  /**
   * Verify a transaction exists on blockchain
   */
  async verifyTransaction(txHash) {
    if (!this.provider) {
      console.error("Provider not initialized");
      return null;
    }

    try {
      const receipt = await this.provider.getTransactionReceipt(txHash);
      return receipt !== null;
    } catch (error) {
      console.error("Error verifying transaction:", error);
      return false;
    }
  }
}

// Export singleton instance
const blockchainListener = new BlockchainListener();
export default blockchainListener;