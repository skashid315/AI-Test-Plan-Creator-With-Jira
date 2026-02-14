/**
 * LLM Provider Interface
 * 
 * Abstract interface for LLM providers.
 * Implementations: GroqProvider, OllamaProvider
 */

import type { TestPlanContext, GenerationStreamEvent } from '../../types';

export interface LLMProvider {
  /**
   * Generate a test plan from context
   * Returns an async generator for streaming responses
   */
  generateTestPlan(context: TestPlanContext): AsyncGenerator<GenerationStreamEvent>;
  
  /**
   * Test connection to the provider
   */
  testConnection(): Promise<{ success: boolean; message: string; models?: string[] }>;
  
  /**
   * List available models
   */
  listModels(): Promise<string[]>;
}

export interface LLMProviderConfig {
  temperature: number;
  maxTokens?: number;
}

// Re-export implementations
export { GroqProvider } from './groq-provider';
export { OllamaProvider } from './ollama-provider';

// Factory function
import SettingsService from '../settings-service';
import { Errors } from '../../middleware/errorHandler';

export function createLLMProvider(provider: 'groq' | 'ollama'): LLMProvider {
  const settingsService = new SettingsService();
  const config = settingsService.getLLMConfig();
  
  if (provider === 'groq') {
    return new GroqProvider({
      apiKey: config.groq.apiKey,
      model: config.groq.model,
      temperature: config.groq.temperature,
    });
  } else if (provider === 'ollama') {
    return new OllamaProvider({
      baseUrl: config.ollama.baseUrl,
      model: config.ollama.model,
      temperature: config.groq.temperature, // Use same temp for consistency
    });
  }
  
  throw Errors.BadRequest(`Unknown provider: ${provider}`);
}
