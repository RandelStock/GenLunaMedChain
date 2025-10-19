// Blockchain configuration for GenLunaMedChain
import { ethers } from 'ethers';

// 🚀 LOW-COST TESTNET CONFIGURATIONS FOR STUDENTS
const NETWORKS = {
  // Most cost-effective options
  polygon_mumbai: {
    name: 'Polygon Mumbai Testnet',
    chainId: 80001,
    rpcUrl: process.env.BLOCKCHAIN_RPC_URL || 'https://polygon-mumbai.infura.io/v3/YOUR_INFURA_PROJECT_ID',
    explorerUrl: 'https://mumbai.polygonscan.com',
    gasPrice: '20000000000', // 20 gwei - very low cost
    gasLimit: '500000',
    costLevel: 'VERY_LOW' // 🟢 Cheapest option
  },
  polygon_amoy: {
    name: 'Polygon Amoy Testnet',
    chainId: 80002,
    rpcUrl: 'https://rpc-amoy.polygon.technology/',
    explorerUrl: 'https://amoy.polygonscan.com',
    gasPrice: '1000000000', // 1 gwei - extremely low cost
    gasLimit: '500000',
    costLevel: 'EXTREMELY_LOW' // 🟢 Cheapest option
  },
  sepolia: {
    name: 'Sepolia Testnet',
    chainId: 11155111,
    rpcUrl: process.env.BLOCKCHAIN_RPC_URL || 'https://sepolia.infura.io/v3/YOUR_INFURA_PROJECT_ID',
    explorerUrl: 'https://sepolia.etherscan.io',
    gasPrice: '20000000000', // 20 gwei
    gasLimit: '500000',
    costLevel: 'LOW' // 🟡 Low cost
  },
  // Development networks
  localhost: {
    name: 'Local Development',
    chainId: 31337,
    rpcUrl: 'http://127.0.0.1:8545',
    explorerUrl: 'http://localhost:8545',
    gasPrice: '20000000000',
    gasLimit: '500000',
    costLevel: 'FREE' // 🟢 Free for development
  }
};

// Get current network configuration
export const getNetworkConfig = () => {
  const networkName = process.env.BLOCKCHAIN_NETWORK || 'polygon_mumbai'; // Default to cheapest option
  return NETWORKS[networkName] || NETWORKS.polygon_mumbai;
};

// Initialize blockchain provider
export const initializeProvider = () => {
  const config = getNetworkConfig();
  
  if (!process.env.BLOCKCHAIN_RPC_URL) {
    throw new Error('BLOCKCHAIN_RPC_URL environment variable is required');
  }

  const provider = new ethers.providers.JsonRpcProvider(config.rpcUrl);
  
  // Add wallet if private key is provided
  let wallet = null;
  if (process.env.BLOCKCHAIN_PRIVATE_KEY) {
    wallet = new ethers.Wallet(process.env.BLOCKCHAIN_PRIVATE_KEY, provider);
  }

  return { provider, wallet, config };
};

// Smart contract ABI (simplified for medical records)
export const MEDICAL_RECORD_ABI = [
  "function addMedicalRecord(address patient, string memory recordHash, uint256 timestamp) external",
  "function getMedicalRecord(address patient, uint256 index) external view returns (string memory, uint256)",
  "function getRecordCount(address patient) external view returns (uint256)",
  "function updateRecord(address patient, uint256 index, string memory newRecordHash) external",
  "function revokeRecord(address patient, uint256 index) external",
  "event MedicalRecordAdded(address indexed patient, string recordHash, uint256 timestamp)",
  "event MedicalRecordUpdated(address indexed patient, uint256 index, string newRecordHash)",
  "event MedicalRecordRevoked(address indexed patient, uint256 index)"
];

// Contract interaction functions
export class BlockchainService {
  constructor() {
    const { provider, wallet, config } = initializeProvider();
    this.provider = provider;
    this.wallet = wallet;
    this.config = config;
    
    if (process.env.BLOCKCHAIN_CONTRACT_ADDRESS) {
      this.contract = new ethers.Contract(
        process.env.BLOCKCHAIN_CONTRACT_ADDRESS,
        MEDICAL_RECORD_ABI,
        wallet || provider
      );
    }
  }

  // Add medical record to blockchain
  async addMedicalRecord(patientAddress, recordHash) {
    if (!this.contract || !this.wallet) {
      throw new Error('Contract or wallet not initialized');
    }

    try {
      const tx = await this.contract.addMedicalRecord(
        patientAddress,
        recordHash,
        Math.floor(Date.now() / 1000),
        {
          gasLimit: this.config.gasLimit,
          gasPrice: this.config.gasPrice
        }
      );

      const receipt = await tx.wait();
      return {
        success: true,
        transactionHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString()
      };
    } catch (error) {
      console.error('Blockchain transaction failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get medical records for a patient
  async getMedicalRecords(patientAddress) {
    if (!this.contract) {
      throw new Error('Contract not initialized');
    }

    try {
      const recordCount = await this.contract.getRecordCount(patientAddress);
      const records = [];

      for (let i = 0; i < recordCount; i++) {
        const [recordHash, timestamp] = await this.contract.getMedicalRecord(patientAddress, i);
        records.push({
          index: i,
          recordHash,
          timestamp: timestamp.toNumber()
        });
      }

      return {
        success: true,
        records
      };
    } catch (error) {
      console.error('Failed to fetch medical records:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Update medical record
  async updateMedicalRecord(patientAddress, recordIndex, newRecordHash) {
    if (!this.contract || !this.wallet) {
      throw new Error('Contract or wallet not initialized');
    }

    try {
      const tx = await this.contract.updateRecord(
        patientAddress,
        recordIndex,
        newRecordHash,
        {
          gasLimit: this.config.gasLimit,
          gasPrice: this.config.gasPrice
        }
      );

      const receipt = await tx.wait();
      return {
        success: true,
        transactionHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber
      };
    } catch (error) {
      console.error('Failed to update medical record:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get network status
  async getNetworkStatus() {
    try {
      const network = await this.provider.getNetwork();
      const blockNumber = await this.provider.getBlockNumber();
      const gasPrice = await this.provider.getGasPrice();

      return {
        success: true,
        network: {
          name: network.name,
          chainId: network.chainId,
          blockNumber,
          gasPrice: ethers.utils.formatUnits(gasPrice, 'gwei') + ' gwei'
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export default BlockchainService;
