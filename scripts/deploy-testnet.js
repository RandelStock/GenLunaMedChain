#!/usr/bin/env node
/**
 * 🚀 Low-Cost Testnet Deployment Script
 * Deploys GenLunaMedChain to the cheapest testnet available
 */

import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Network configurations (ordered by cost)
const NETWORKS = {
  polygon_amoy: {
    name: "Polygon Amoy Testnet",
    rpcUrl: "https://rpc-amoy.polygon.technology/",
    chainId: 80002,
    explorerUrl: "https://amoy.polygonscan.com",
    gasPrice: "1000000000", // 1 gwei - extremely low cost
    costLevel: "EXTREMELY_LOW"
  },
  polygon_mumbai: {
    name: "Polygon Mumbai Testnet", 
    rpcUrl: "https://polygon-mumbai.infura.io/v3/demo",
    chainId: 80001,
    explorerUrl: "https://mumbai.polygonscan.com",
    gasPrice: "20000000000", // 20 gwei - very low cost
    costLevel: "VERY_LOW"
  },
  sepolia: {
    name: "Sepolia Testnet",
    rpcUrl: "https://sepolia.infura.io/v3/demo",
    chainId: 11155111,
    explorerUrl: "https://sepolia.etherscan.io",
    gasPrice: "20000000000", // 20 gwei
    costLevel: "LOW"
  }
};

async function deployContract() {
  try {
    console.log("🚀 Starting GenLunaMedChain Testnet Deployment...\n");

    // Check if private key is provided
    if (!process.env.BLOCKCHAIN_PRIVATE_KEY) {
      console.error("❌ Error: BLOCKCHAIN_PRIVATE_KEY not found in environment variables");
      console.log("💡 Please add your private key to .env file");
      process.exit(1);
    }

    // Get network configuration
    const networkName = process.env.BLOCKCHAIN_NETWORK || "polygon_amoy";
    const network = NETWORKS[networkName];
    
    if (!network) {
      console.error(`❌ Error: Unknown network '${networkName}'`);
      console.log("Available networks:", Object.keys(NETWORKS).join(", "));
      process.exit(1);
    }

    console.log(`📡 Deploying to: ${network.name}`);
    console.log(`💰 Cost Level: ${network.costLevel}`);
    console.log(`🔗 RPC URL: ${network.rpcUrl}\n`);

    // Create provider and wallet
    const provider = new ethers.JsonRpcProvider(network.rpcUrl);
    const wallet = new ethers.Wallet(process.env.BLOCKCHAIN_PRIVATE_KEY, provider);

    console.log(`👛 Deployer Address: ${wallet.address}`);

    // Check balance
    const balance = await provider.getBalance(wallet.address);
    const balanceInEth = ethers.formatEther(balance);
    console.log(`💰 Wallet Balance: ${balanceInEth} ETH\n`);

    if (balance === 0n) {
      console.log("⚠️  Warning: Wallet balance is 0. You need testnet tokens!");
      console.log("🔗 Get free testnet tokens from:");
      if (networkName === "polygon_amoy") {
        console.log("   - https://faucet.polygon.technology/");
      } else if (networkName === "polygon_mumbai") {
        console.log("   - https://faucet.polygon.technology/");
        console.log("   - https://mumbaifaucet.com/");
      } else if (networkName === "sepolia") {
        console.log("   - https://sepoliafaucet.com/");
        console.log("   - https://faucet.quicknode.com/ethereum/sepolia");
      }
      console.log("");
    }

    // Read contract ABI and bytecode
    const contractPath = path.join(__dirname, "../artifacts/contracts/MedicineInventory.sol/MedicineInventory.json");
    
    if (!fs.existsSync(contractPath)) {
      console.error("❌ Error: Contract artifacts not found. Please compile first:");
      console.log("   cd backend && npx hardhat compile");
      process.exit(1);
    }

    const contractArtifact = JSON.parse(fs.readFileSync(contractPath, "utf8"));
    const contractFactory = new ethers.ContractFactory(
      contractArtifact.abi,
      contractArtifact.bytecode,
      wallet
    );

    console.log("📦 Deploying MedicineInventory contract...");

    // Deploy with low gas settings
    const contract = await contractFactory.deploy({
      gasLimit: 5000000, // 5M gas limit
      gasPrice: network.gasPrice
    });

    console.log("⏳ Waiting for deployment transaction...");
    await contract.waitForDeployment();

    const contractAddress = await contract.getAddress();
    const deploymentTx = contract.deploymentTransaction();

    console.log("\n✅ Contract deployed successfully!");
    console.log(`📍 Contract Address: ${contractAddress}`);
    console.log(`🔗 Transaction Hash: ${deploymentTx?.hash}`);
    console.log(`🌐 Explorer: ${network.explorerUrl}/address/${contractAddress}`);

    // Save deployment info
    const deploymentInfo = {
      network: networkName,
      contractAddress,
      transactionHash: deploymentTx?.hash,
      blockNumber: deploymentTx?.blockNumber,
      gasUsed: deploymentTx?.gasLimit?.toString(),
      gasPrice: network.gasPrice,
      explorerUrl: `${network.explorerUrl}/address/${contractAddress}`,
      deployedAt: new Date().toISOString(),
      deployerAddress: wallet.address
    };

    fs.writeFileSync(
      path.join(__dirname, "../deployment-info.json"),
      JSON.stringify(deploymentInfo, null, 2)
    );

    console.log("\n💾 Deployment info saved to deployment-info.json");

    // Update environment file
    console.log("\n🔧 Next steps:");
    console.log("1. Update your .env file with the contract address:");
    console.log(`   BLOCKCHAIN_CONTRACT_ADDRESS="${contractAddress}"`);
    console.log("2. Update your frontend config with the new contract address");
    console.log("3. Test your contract on the explorer");

    console.log("\n🎉 Deployment completed successfully!");

  } catch (error) {
    console.error("❌ Deployment failed:", error.message);
    
    if (error.message.includes("insufficient funds")) {
      console.log("\n💡 Solution: Get testnet tokens from faucets");
    } else if (error.message.includes("network")) {
      console.log("\n💡 Solution: Check your RPC URL and network configuration");
    }
    
    process.exit(1);
  }
}

// Run deployment
deployContract();
