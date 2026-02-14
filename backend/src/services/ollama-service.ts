/**
 * Ollama Service
 * 
 * Handles communication with local Ollama instance.
 * Provides model listing and health checking.
 */

import axios, { AxiosError } from 'axios';
import logger from '../utils/logger';
import { Errors } from '../middleware/errorHandler';

export interface OllamaModel {
  name: string;
  model: string;
  modified_at: string;
  size: number;
  digest: string;
  details: {
    format: string;
    family: string;
    families: string[] | null;
    parameter_size: string;
    quantization_level: string;
  };
}

export interface OllamaTagsResponse {
  models: OllamaModel[];
}

export class OllamaService {
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:11434') {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
  }

  /**
   * List available models from Ollama
   */
  async listModels(): Promise<string[]> {
    try {
      logger.info({ baseUrl: this.baseUrl }, 'Fetching Ollama models');
      
      const response = await axios.get<OllamaTagsResponse>(
        `${this.baseUrl}/api/tags`,
        { timeout: 5000 }
      );
      
      const models = response.data.models || [];
      const modelNames = models.map(m => m.name).sort();
      
      logger.info({ count: modelNames.length }, 'Ollama models fetched');
      
      return modelNames;
    } catch (error) {
      this.handleError(error as AxiosError);
      return []; // Should not reach here due to throw
    }
  }

  /**
   * Test connection to Ollama
   */
  async testConnection(): Promise<{ success: boolean; message: string; models?: string[] }> {
    try {
      const models = await this.listModels();
      
      return {
        success: true,
        message: `Connected successfully. ${models.length} models available.`,
        models,
      };
    } catch (error) {
      if (error instanceof Error) {
        return {
          success: false,
          message: error.message,
        };
      }
      throw error;
    }
  }

  /**
   * Generate a test plan using Ollama
   */
  async generateTestPlan(
    model: string,
    prompt: string,
    temperature: number = 0.7
  ): Promise<string> {
    try {
      logger.info({ model }, 'Generating test plan with Ollama');
      
      const response = await axios.post(
        `${this.baseUrl}/api/generate`,
        {
          model,
          prompt,
          stream: false,
          options: {
            temperature,
          },
        },
        { timeout: 120000 } // 2 minute timeout for generation
      );
      
      return response.data.response;
    } catch (error) {
      this.handleError(error as AxiosError);
      return ''; // Should not reach here
    }
  }

  /**
   * Generate with streaming (for SSE)
   */
  async *generateStream(
    model: string,
    prompt: string,
    temperature: number = 0.7
  ): AsyncGenerator<string> {
    try {
      logger.info({ model }, 'Starting Ollama stream generation');
      
      const response = await axios.post(
        `${this.baseUrl}/api/generate`,
        {
          model,
          prompt,
          stream: true,
          options: {
            temperature,
          },
        },
        {
          responseType: 'stream',
          timeout: 120000,
        }
      );

      // Handle streaming response
      for await (const chunk of response.data) {
        const lines = chunk.toString().split('\n').filter(Boolean);
        
        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            if (data.response) {
              yield data.response;
            }
            if (data.done) {
              return;
            }
          } catch {
            // Skip invalid JSON lines
            continue;
          }
        }
      }
    } catch (error) {
      this.handleError(error as AxiosError);
    }
  }

  /**
   * Handle Ollama API errors
   */
  private handleError(error: AxiosError): void {
    if (error.code === 'ECONNREFUSED') {
      throw Errors.BadGateway(
        'Cannot connect to Ollama. Please ensure Ollama is running on the configured URL.'
      );
    }
    
    if (error.code === 'ETIMEDOUT') {
      throw Errors.BadGateway('Connection to Ollama timed out.');
    }
    
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data as { error?: string };
      
      if (status === 404) {
        throw Errors.NotFound('Ollama model not found. Please pull the model first.');
      }
      
      throw Errors.BadGateway(data.error || `Ollama error: ${status}`);
    }
    
    logger.error({ error }, 'Ollama request failed');
    throw Errors.Internal('Failed to communicate with Ollama');
  }
}

export default OllamaService;
