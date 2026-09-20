import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createClient } from '@libsql/client';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Idempotent SQL Migrator for Turso Cloud (libSQL)
 * Converts generated DDL to idempotent 'IF NOT EXISTS' statements and executes them on Turso.
 */
export async function migrateTursoSchema(customClient = null) {
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;

  if (!tursoUrl && !customClient) {
    console.log('ℹ️ [Turso Migration] TURSO_DATABASE_URL not set. Skipping remote Turso migration.');
    return { success: false, reason: 'TURSO_DATABASE_URL_NOT_SET' };
  }

  console.log(`🚀 [Turso Migration] Connecting to Turso database: ${tursoUrl || 'provided client'}...`);

  const client = customClient || createClient({
    url: tursoUrl,
    authToken: tursoToken,
  });

  try {
    // Locate SQL schema file
    const possiblePaths = [
      path.resolve(__dirname, '../prisma/turso_schema.sql'),
      path.resolve(process.cwd(), 'prisma/turso_schema.sql'),
      path.resolve(process.cwd(), 'server/prisma/turso_schema.sql'),
    ];

    const schemaPath = possiblePaths.find(p => fs.existsSync(p));
    if (!schemaPath) {
      throw new Error('turso_schema.sql not found in candidate paths: ' + possiblePaths.join(', '));
    }

    const rawSql = fs.readFileSync(schemaPath, 'utf8');

    // Split SQL statements by semicolon while ignoring comments
    const statements = rawSql
      .split(/;\s*[\r\n]+/)
      .map(stmt => stmt.trim())
      .filter(stmt => {
        if (!stmt) return false;
        // Check if statement contains actual SQL command (not just comments)
        const lines = stmt.split('\n').map(l => l.trim()).filter(l => !l.startsWith('--'));
        return lines.length > 0 && lines.join(' ').trim().length > 0;
      })
      .map(stmt => {
        // Ensure statements are idempotent
        let s = stmt;
        if (/^CREATE\s+TABLE\s+/i.test(s) && !/IF\s+NOT\s+EXISTS/i.test(s)) {
          s = s.replace(/^CREATE\s+TABLE\s+/i, 'CREATE TABLE IF NOT EXISTS ');
        }
        if (/^CREATE\s+UNIQUE\s+INDEX\s+/i.test(s) && !/IF\s+NOT\s+EXISTS/i.test(s)) {
          s = s.replace(/^CREATE\s+UNIQUE\s+INDEX\s+/i, 'CREATE UNIQUE INDEX IF NOT EXISTS ');
        } else if (/^CREATE\s+INDEX\s+/i.test(s) && !/IF\s+NOT\s+EXISTS/i.test(s)) {
          s = s.replace(/^CREATE\s+INDEX\s+/i, 'CREATE INDEX IF NOT EXISTS ');
        }
        return s;
      });

    console.log(`📦 [Turso Migration] Applying ${statements.length} schema DDL statements...`);

    let executedCount = 0;
    for (const statement of statements) {
      try {
        await client.execute(statement);
        executedCount++;
      } catch (err) {
        // If table or index already exists, proceed safely
        if (err.message && (
          err.message.includes('already exists') ||
          err.message.includes('duplicate column name')
        )) {
          executedCount++;
          continue;
        }
        console.warn(`⚠️ [Turso Migration] Notice on statement (${statement.slice(0, 50)}...):`, err.message);
      }
    }

    // Verify tables count
    const tableRes = await client.execute("SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma_%';");
    const tableCount = tableRes.rows[0]?.count || tableRes.rows[0]?.[0] || 0;

    console.log(`✅ [Turso Migration] Schema applied successfully! Found ${tableCount} active application tables in Turso database.`);

    return { success: true, tableCount, executedCount };
  } catch (err) {
    console.error('❌ [Turso Migration] Migration failed:', err);
    throw err;
  }
}

// Execute directly if run via CLI: node src/migrate-turso.js
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  migrateTursoSchema()
    .then(() => {
      console.log('🏁 Turso migration process finished.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Migration failed:', err.message);
      process.exit(1);
    });
}
