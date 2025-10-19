require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

module.exports = {
  solidity: {
    version: "0.8.23",
    settings: {
      viaIR: true, // ✅ Enables IR-based compilation
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545"
    },
    hardhat: {
      chainId: 31337
    },
    // 🚀 LOW-COST TESTNETS FOR STUDENTS
    mumbai: {
      url: process.env.MUMBAI_RPC_URL || "https://polygon-mumbai.infura.io/v3/YOUR_INFURA_PROJECT_ID",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 80001,
      gasPrice: 20000000000, // 20 gwei - very low cost
      gas: 500000
    },
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "https://sepolia.infura.io/v3/YOUR_INFURA_PROJECT_ID",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 11155111,
      gasPrice: 20000000000, // 20 gwei
      gas: 500000
    },
    // Even cheaper alternatives
    polygonAmoy: {
      url: "https://rpc-amoy.polygon.technology/",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 80002,
      gasPrice: 1000000000, // 1 gwei - extremely low cost
      gas: 500000
    }
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  }
};


// require("@matterlabs/hardhat-zksync-solc");
// require("@matterlabs/hardhat-zksync-verify");


// /** @type import('hardhat/config').HardhatUserConfig */
// module.exports = {
//   zksolc: {
//     version: "1.4.1",
//     compilerSource: "binary",
//     settings: {
//       optimizer: {
//         enabled: true,
//       },
//     },
//   },
//   networks: {
//     zkSyncSepoliaTestnet: {
//       url: "https://sepolia.era.zksync.dev",
//       ethNetwork: "sepolia",
//       zksync: true,
//       chainId: 300,
//       verifyURL:
//         "https://explorer.sepolia.era.zksync.dev/contract_verification",
//     },
//     zkSyncMainnet: {
//       url: "https://mainnet.era.zksync.io",
//       ethNetwork: "mainnet",
//       zksync: true,
//       chainId: 324,
//       verifyURL:
//         "https://zksync2-mainnet-explorer.zksync.io/contract_verification",
//     },
//   },
//   paths: {
//     artifacts: "./artifacts-zk",
//     cache: "./cache-zk",
//     sources: "./contracts",
//     tests: "./test",
//   },
//   solidity: {
//     version: "0.8.23",
//     defaultNetwork:'sepolia',
//     networks: {
//       hardhat: {},
//       sepolia: {
//         url: 'https://eth-sepolia.g.alchemy.com/v2/demo',
//         accounts: ['0x${process.env.PRIVATE_KEY}']
//       }
//     },
//     settings: {
//       viaIR: true,
//       optimizer: {
//         enabled: true,
//         runs: 200,
//       },
//     },
//   },
// };

