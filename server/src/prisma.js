import { PrismaClient } from '@prisma/client';
import { PrismaLibSQL } from '@prisma/adapter-libsql/web';
import dotenv from 'dotenv';

dotenv.config();

// Single shared singleton instance of PrismaClient
const globalForPrisma = globalThis;

function createPrismaClient() {
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoAuthToken = process.env.TURSO_AUTH_TOKEN;

  if (tursoUrl) {
    console.log('⚡ [Prisma] Initializing connection to Turso Cloud (libSQL)...');
    const adapter = new PrismaLibSQL({
      url: tursoUrl,
      authToken: tursoAuthToken,
    });
    return new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    });
  }

  console.log('📦 [Prisma] Connecting to local database engine...');
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
}

export const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Enable SQLite Write-Ahead Logging (WAL) and busy timeout only when running local SQLite file
async function configureSqlitePragmas() {
  const tursoUrl = process.env.TURSO_DATABASE_URL || '';
  const dbUrl = process.env.DATABASE_URL || '';

  // If connected to Turso Cloud or PostgreSQL, local SQLite PRAGMA journal_mode is not needed
  if (tursoUrl || dbUrl.includes('postgres') || dbUrl.includes('postgresql')) {
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
