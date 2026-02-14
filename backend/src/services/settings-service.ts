/**
 * Settings Service
 * 
 * Manages application settings in the database.
 * Handles encryption/decryption of sensitive fields (API keys, tokens).
 */

import { getDatabase } from '../database/connection';
import { encrypt, decrypt, isEncrypted } from '../utils/encryption';
import logger from '../utils/logger';
import { Errors } from '../middleware/errorHandler';
import type { 
  Settings, 
  SettingsRow, 
  JiraSettingsRequest, 
  LLMSettingsRequest,
  JiraConfig,
  LLMConfig,
} from '../types';

// Fields that should be encrypted
const ENCRYPTED_FIELDS = [
  'jira_api_token',
  'groq_api_key',
] as const;

type EncryptedField = typeof ENCRYPTED_FIELDS[number];

export class SettingsService {
  private db = getDatabase();

  /**
   * Get all settings
   */
  getSettings(): Settings {
    try {
      const row = this.db.prepare('SELECT * FROM settings WHERE id = 1').get() as SettingsRow | undefined;
      
      if (!row) {
        // Create default settings if not exists
        this.db.prepare('INSERT OR IGNORE INTO settings (id) VALUES (1)').run();
        return this.getSettings();
      }

      return this.rowToSettings(row);
    } catch (error) {
      logger.error({ error }, 'Failed to get settings');
      throw Errors.Internal('Failed to retrieve settings');
    }
  }

  /**
   * Get JIRA configuration (decrypted)
   */
  getJiraConfig(): JiraConfig {
    const settings = this.getSettings();
    
    return {
      baseUrl: settings.jira_base_url || '',
      username: settings.jira_username || '',
      apiToken: settings.jira_api_token || '',
      isConnected: settings.jira_connected,
    };
  }

  /**
   * Get LLM configuration
   */
  getLLMConfig(): LLMConfig {
    const settings = this.getSettings();
    
    return {
      provider: settings.llm_provider || 'groq',
      groq: {
        apiKey: settings.groq_api_key || '',
        model: settings.groq_model || 'llama3-70b-8192',
        temperature: settings.groq_temperature || 0.7,
      },
      ollama: {
        baseUrl: settings.ollama_base_url || 'http://localhost:11434',
        model: settings.ollama_model || 'llama3',
      },
    };
  }

  /**
   * Save JIRA settings
   */
  saveJiraSettings(data: JiraSettingsRequest): void {
    try {
      const { baseUrl, username, apiToken } = data;
      
      // Encrypt API token
      const encryptedToken = encrypt(apiToken);
      
      const stmt = this.db.prepare(`
        UPDATE settings 
        SET jira_base_url = ?,
            jira_username = ?,
            jira_api_token = ?,
            jira_connected = 0
        WHERE id = 1
      `);
      
      stmt.run(baseUrl, username, encryptedToken);
      
      logger.info('JIRA settings saved');
    } catch (error) {
      logger.error({ error }, 'Failed to save JIRA settings');
      throw Errors.Internal('Failed to save JIRA settings');
    }
  }

  /**
   * Update JIRA connection status
   */
  setJiraConnected(connected: boolean): void {
    try {
      this.db.prepare('UPDATE settings SET jira_connected = ? WHERE id = 1').run(connected ? 1 : 0);
      logger.info({ connected }, 'JIRA connection status updated');
    } catch (error) {
      logger.error({ error }, 'Failed to update JIRA connection status');
      throw Errors.Internal('Failed to update connection status');
    }
  }

  /**
   * Save LLM settings
   */
  saveLLMSettings(data: LLMSettingsRequest): void {
    try {
      const { 
        provider, 
        groqApiKey, 
        groqModel, 
        groqTemperature, 
        ollamaBaseUrl, 
        ollamaModel 
      } = data;
      
      // Encrypt Groq API key if provided
      const encryptedGroqKey = groqApiKey ? encrypt(groqApiKey) : undefined;
      
      const stmt = this.db.prepare(`
        UPDATE settings 
        SET llm_provider = ?,
            groq_api_key = COALESCE(?, groq_api_key),
            groq_model = COALESCE(?, groq_model),
            groq_temperature = COALESCE(?, groq_temperature),
            ollama_base_url = COALESCE(?, ollama_base_url),
            ollama_model = COALESCE(?, ollama_model)
        WHERE id = 1
      `);
      
      stmt.run(
        provider,
        encryptedGroqKey ?? null,
        groqModel ?? null,
        groqTemperature ?? null,
        ollamaBaseUrl ?? null,
        ollamaModel ?? null
      );
      
      logger.info({ provider }, 'LLM settings saved');
    } catch (error) {
      logger.error({ error }, 'Failed to save LLM settings');
      throw Errors.Internal('Failed to save LLM settings');
    }
  }

  /**
   * Convert database row to Settings object with decryption
   */
  private rowToSettings(row: SettingsRow): Settings {
    return {
      id: row.id,
      jira_base_url: row.jira_base_url || '',
      jira_username: row.jira_username || '',
      jira_api_token: this.decryptField(row.jira_api_token),
      jira_connected: Boolean(row.jira_connected),
      llm_provider: (row.llm_provider as 'groq' | 'ollama') || 'groq',
      groq_api_key: this.decryptField(row.groq_api_key),
      groq_model: row.groq_model || 'llama3-70b-8192',
      groq_temperature: row.groq_temperature ?? 0.7,
      ollama_base_url: row.ollama_base_url || 'http://localhost:11434',
      ollama_model: row.ollama_model || 'llama3',
      updated_at: row.updated_at,
    };
  }

  /**
   * Decrypt a field value if it's encrypted
   */
  private decryptField(value: string | null): string {
    if (!value) return '';
    
    // Check if the value is encrypted
    if (isEncrypted(value)) {
      try {
        return decrypt(value);
      } catch (error) {
        logger.warn('Failed to decrypt field, returning empty string');
        return '';
      }
    }
    
    return value;
  }
}

export default SettingsService;
