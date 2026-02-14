/**
 * Database Connection Singleton
 * 
 * Provides a singleton instance of the SQLite database connection.
 * Uses better-sqlite3 for synchronous, high-performance operations.
 */

import Database from 'better-sqlite3';
import path from 'path';
import logger from '../utils/logger';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = process.env.DATABASE_PATH || path.join(DATA_DIR, 'app.db');

let db: Database.Database | null = null;

/**
 * Get the database connection instance (singleton)
 */
export function getDatabase(): Database.Database {
  if (!db) {
    try {
      db = new Database(DB_PATH);
      
      // Enable WAL mode for better concurrency
      db.pragma('journal_mode = WAL');
      
      // Enable foreign keys
      db.pragma('foreign_keys = ON');
      
      logger.info(`Database connected: ${DB_PATH}`);
    } catch (error) {
      logger.error('Failed to connect to database:', error);
      throw new Error('Database connection failed');
    }
  }
  
  return db;
}

/**
 * Close the database connection
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
    logger.info('Database connection closed');
  }
}

/**
 * Check if database is connected
 */
export function isConnected(): boolean {
  return db !== null;
}

export default getDatabase;
