import express from "express";
import prisma from "../config/prismaClient.js";

const router = express.Router();

// GET blockchain transactions
router.get("/", async (req, res, next) => {
  try {
    const txs = await prisma.blockchain_transactions.findMany();
    res.json(txs); // ✅ BigInt already converted
  } catch (err) {
    next(err);
  }
});

// POST new blockchain transaction
router.post("/", async (req, res, next) => {
  try {
    const tx = await prisma.blockchain_transactions.create({
      data: req.body,
    });
    res.json(tx); // ✅ No BigInt issues
  } catch (err) {
    next(err);
  }
});

export default router;
