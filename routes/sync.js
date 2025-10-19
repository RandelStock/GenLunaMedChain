import express from "express";
import { PrismaClient } from "@prisma/client";

const router = express.Router();
const prisma = new PrismaClient();

// GET sync statuses
router.get("/", async (req, res, next) => {
  try {
    const syncs = await prisma.sync_status.findMany();
    res.json(syncs);
  } catch (err) {
    next(err);
  }
});

// POST new sync status
router.post("/", async (req, res, next) => {
  try {
    const sync = await prisma.sync_status.create({ data: req.body });
    res.json(sync);
  } catch (err) {
    next(err);
  }
});

export default router;
