import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Middleware to convert BigInt → string
if (typeof prisma.$use === "function") {
  prisma.$use(async (params, next) => {
    const result = await next(params);

    const replacer = (key, value) =>
      typeof value === "bigint" ? value.toString() : value;

    return JSON.parse(JSON.stringify(result, replacer));
  });
} else {
  console.warn("⚠️ Prisma middleware ($use) is not available. Please upgrade Prisma to v5+.");
}

export default prisma;
