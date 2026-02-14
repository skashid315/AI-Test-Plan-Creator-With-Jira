import crypto from 'crypto';
import logger from './logger';

// Generate a 32-byte key from environment or create a fallback
// In production, this should be set via environment variable
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 
  crypto.scryptSync('default-key-change-in-production', 'salt', 32);

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

export interface EncryptedData {
  iv: string;
  authTag: string;
  encryptedData: string;
}

/**
 * Encrypt sensitive data (API keys, tokens)
 */
export function encrypt(text: string): string {
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // Combine iv:authTag:encryptedData for storage
    const result = `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
    return result;
  } catch (error) {
    logger.error('Encryption failed:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypt sensitive data
 */
export function decrypt(encryptedString: string): string {
  try {
    const parts = encryptedString.split(':');
    
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }
    
    const [ivHex, authTagHex, encrypted] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    logger.error('Decryption failed:', error);
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Check if a string is encrypted (contains the delimiter pattern)
 */
export function isEncrypted(text: string): boolean {
  if (!text) return false;
  const parts = text.split(':');
  return parts.length === 3 && 
         parts[0].length === 32 && // IV is 16 bytes = 32 hex chars
         parts[1].length === 32;    // Auth tag is 16 bytes = 32 hex chars
}

/**
 * Generate a secure random key for production use
 * Run this once and set the result as ENCRYPTION_KEY env variable
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

export default {
  encrypt,
  decrypt,
  isEncrypted,
  generateEncryptionKey,
};
