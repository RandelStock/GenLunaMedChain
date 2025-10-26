import express from "express";
import cors from "cors";
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
dotenv.config();

// Import routes
import residentsRoutes from "./routes/residents.js";
import medicinesRoutes from "./routes/medicines.js";
import stocksRoutes from "./routes/stocks.js";
import suppliersRoutes from "./routes/suppliers.js";
import syncRoutes from "./routes/sync.js";
import releasesRoutes from "./routes/releases.js";
import removalsRoutes from "./routes/removals.js";
import transactionsRoutes from "./routes/transactions.js";
import auditRoutes from "./routes/audit.js";
import verificationRoutes from "./routes/verification.js";   // ✅ Added
import usersRoutes from "./routes/users.js"; // ✅ Added users route
import stock_transactions from "./routes/stockTransaction.js";
import blockchainRoutes from "./routes/blockchain.js";
import scheduleRoutes from "./routes/schedule.js";
import consultationsRoutes from "./routes/consultations.js";
import providerProfilesRoutes from "./routes/providerProfiles.js";

// Services
import blockchainService from "./utils/blockchainUtils.js";  // ✅ Added
import { optionalAuth } from "./middleware/auth.js";
// import blockchainListener from "./services/blockchainListener.js"; // optional legacy

const app = express();
const prisma = new PrismaClient();

app.use(cors({
  origin: ["https://genluna-medchain.netlify.app"], 
  methods: ["GET", "POST", "PATCH","PUT", "DELETE"],
  credentials: true,
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "x-wallet-address",
    "x-signature",
    "x-message",
    "x-timestamp"
  ],
}));
app.use(express.json());
// Attach user from wallet header when present (no hard auth requirement for reads)
app.use(optionalAuth);

// Health check
app.get("/", (req, res) => {
  res.json({
    status: "running",
    message: "🚀 GenLunaMedChain API is running...",
    timestamp: new Date().toISOString(),
  });
});

// Register routes
app.use("/residents", residentsRoutes);
app.use("/medicines", medicinesRoutes);
app.use("/stocks", stocksRoutes);
app.use("/suppliers", suppliersRoutes);
app.use("/sync", syncRoutes);
app.use("/releases", releasesRoutes);
app.use("/removals", removalsRoutes);
app.use("/transactions", transactionsRoutes);
app.use("/audit", auditRoutes);
app.use("/verify", verificationRoutes);   // ✅ Added
app.use("/users", usersRoutes); // ✅ Added users route
app.use("/stock-transactions", stock_transactions);
app.use("/blockchain", blockchainRoutes);
app.use("/schedule", scheduleRoutes);
app.use("/consultations", consultationsRoutes);
app.use("/provider-profiles", providerProfilesRoutes);

// Error handler
app.use((err, req, res, next) => {
  console.error("❌ Error:", err);
  res.status(500).json({
    error: "Internal Server Error",
    message: err.message,
    timestamp: new Date().toISOString(),
  });
});

// Database connection test
prisma.$connect()
  .then(() => {
    console.log("✅ Database connected successfully");
  })
  .catch((err) => {
    console.error("❌ Database connection failed:", err);
  });

const PORT = process.env.PORT || 4000;
const server = app.listen(PORT, () => {
  console.log(`✅ API running on http://localhost:${PORT}`);
  console.log(
    `📊 Database: ${
      process.env.DATABASE_URL?.split("@")[1]?.split("/")[1] || "PostgreSQL"
    }`
  );

  // ✅ Blockchain event listener - DISABLED to prevent filter errors
  console.log("⚠️  Blockchain event listener disabled (prevents RPC filter errors)");
  console.log("✅ Blockchain service available for transactions");
  
  // Event listener disabled - uncomment below to re-enable
  /*
  try {
    if (process.env.BLOCKCHAIN_NETWORK && process.env.BLOCKCHAIN_NETWORK !== 'disabled') {
      blockchainService.listenToBlockchainEvents();
      console.log("👂 Blockchain service listener active");
    } else {
      console.log("⚠️ Blockchain service disabled (BLOCKCHAIN_NETWORK=disabled or not set)");
    }
  } catch (error) {
    console.log("⚠️ Blockchain service failed to start:", error.message);
  }
  */

  // --- OPTIONAL: Old blockchainListener style ---
  // const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
  // const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8545";
  // if (CONTRACT_ADDRESS) {
  //   blockchainListener.initialize(RPC_URL, CONTRACT_ADDRESS)
  //     .then((success) => {
  //       if (success) {
  //         blockchainListener.startListening();
  //         console.log("👂 Blockchain event listener started");
  //       }
  //     })
  //     .catch((err) => {
  //       console.error("⚠️ Blockchain listener failed to start:", err);
  //     });
  // } else {
  //   console.log("⚠️ No CONTRACT_ADDRESS found. Blockchain listener not started.");
  // }
});

// Graceful shutdown
const shutdown = async (signal) => {
  console.log(`${signal} received, closing server...`);
  server.close(async () => {
    console.log("Server closed");

    // Stop blockchain service if needed
    if (blockchainService.stopListening) {
      blockchainService.stopListening();
      console.log("⛔ Blockchain service listener stopped");
    }

    await prisma.$disconnect();
    console.log("Database disconnected");
    process.exit(0);
  });
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

export default app;