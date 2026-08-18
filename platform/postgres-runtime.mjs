import pg from "pg";
import { HISTORY_SCHEMA_STATEMENTS } from "../db/schema.mjs";
import { createLocalUploadStorage } from "./local-storage.mjs";

const { Pool, types } = pg;
types.setTypeParser(20, (value) => Number(value));

function postgresSql(sql) {
  let parameter = 0;
  return sql.replaceAll("window_start INTEGER", "window_start BIGINT")
    .replaceAll("processed_rows INTEGER", "processed_rows BIGINT")
    .replaceAll("upload_bytes INTEGER", "upload_bytes BIGINT")
    .replace(/\?/gu, () => `$${parameter += 1}`);
}

class PostgresStatement {
  constructor(database, sql, values = []) {
    this.database = database;
    this.sql = postgresSql(sql);
    this.values = values;
  }

  bind(...values) {
    return new PostgresStatement(this.database, this.sql, values);
  }

  async execute(queryable = this.database.pool) {
    return queryable.query(this.sql, this.values);
  }

  async all() {
    const result = await this.execute();
    return { results: result.rows };
  }

  async first() {
    const result = await this.execute();
    return result.rows[0] ?? null;
  }

  async run() {
    const result = await this.execute();
    return { success: true, changes: result.rowCount ?? 0 };
  }
}

class PostgresDatabase {
  constructor(pool) {
    this.pool = pool;
  }

  prepare(sql) {
    return new PostgresStatement(this, sql);
  }

  async batch(statements) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const results = [];
      for (const statement of statements) {
        if (!(statement instanceof PostgresStatement)) throw new Error("Invalid PostgreSQL batch statement.");
        const result = await statement.execute(client);
        results.push({ success: true, changes: result.rowCount ?? 0, results: result.rows });
      }
      await client.query("COMMIT");
      return results;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}

const DATABASE_KEY = Symbol.for("verdict.postgresDatabase");

export async function getPostgresDatabase(connectionString) {
  const root = globalThis;
  if (!root[DATABASE_KEY]) {
    root[DATABASE_KEY] = (async () => {
      const pool = new Pool({
        connectionString,
        max: 8,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 5_000,
        statement_timeout: 30_000,
        application_name: "verdict-app",
      });
      pool.on("error", (error) => console.error("PostgreSQL pool error", error));
      const database = new PostgresDatabase(pool);
      for (const statement of HISTORY_SCHEMA_STATEMENTS) await pool.query(postgresSql(statement));
      await pool.query("ALTER TABLE accounts ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'member'");
      await pool.query("CREATE INDEX IF NOT EXISTS idx_accounts_status_plan_updated_at ON accounts(status, plan, updated_at DESC)");
      await pool.query("SELECT 1");
      return database;
    })();
  }
  try {
    return await root[DATABASE_KEY];
  } catch (error) {
    delete root[DATABASE_KEY];
    throw error;
  }
}

export function getLocalUploadStorage(root) {
  return createLocalUploadStorage(root);
}
