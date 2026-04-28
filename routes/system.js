import express from "express";
import prisma from "../config/prismaClient.js";

const router = express.Router();
const bootTimeMs = Date.now();

const formatUptime = (totalSeconds) => {
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
};

router.get("/status", async (req, res) => {
  const startedAt = new Date(bootTimeMs).toISOString();
  const uptimeSeconds = process.uptime();
  const now = new Date().toISOString();

  let database = {
    healthy: false,
    latencyMs: null,
    error: null,
  };

  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    database = {
      healthy: true,
      latencyMs: Date.now() - dbStart,
      error: null,
    };
  } catch (error) {
    database = {
      healthy: false,
      latencyMs: null,
      error: error.message || "Database health check failed",
    };
  }

  const payload = {
    success: true,
    system: {
      status: database.healthy ? "online" : "degraded",
      environment: process.env.NODE_ENV || "development",
      version: process.env.APP_VERSION || process.env.npm_package_version || "1.0.0",
      startedAt,
      now,
      uptimeSeconds: Math.floor(uptimeSeconds),
      uptimeHuman: formatUptime(uptimeSeconds),
    },
    database,
  };

  const statusCode = database.healthy ? 200 : 503;
  return res.status(statusCode).json(payload);
});

export default router;
