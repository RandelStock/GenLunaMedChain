import express from "express";
import { PrismaClient } from "@prisma/client";

const router = express.Router();
const prisma = new PrismaClient();

// GET all suppliers
router.get("/", async (req, res, next) => {
  try {
    const suppliers = await prisma.suppliers.findMany();
    res.json(suppliers);
  } catch (err) {
    next(err);
  }
});

// POST new supplier
router.post("/", async (req, res, next) => {
  try {
    const supplier = await prisma.suppliers.create({ data: req.body });
    res.json(supplier);
  } catch (err) {
    next(err);
  }
});

export default router;
