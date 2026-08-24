import { PrismaClient } from '@prisma/client';

// Single shared singleton instance of PrismaClient
const globalForPrisma = globalThis;

export const prisma = globalForPrisma.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Enable SQLite Write-Ahead Logging (WAL) and busy timeout only when running SQLite
async function configureSqlitePragmas() {
  const dbUrl = process.env.DATABASE_URL || '';
  if (dbUrl.includes('postgres') || dbUrl.includes('postgresql')) {
    // Running on PostgreSQL, PRAGMA not needed
    return;
  }

  try {
    await prisma.$queryRawUnsafe(`PRAGMA journal_mode = WAL;`);
    await prisma.$queryRawUnsafe(`PRAGMA busy_timeout = 15000;`);
    await prisma.$queryRawUnsafe(`PRAGMA synchronous = NORMAL;`);
  } catch (err) {
    // silently ignore if not sqlite or already active
  }
}

configureSqlitePragmas();

export default prisma;
