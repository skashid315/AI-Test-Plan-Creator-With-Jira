/**
 * Ollama LLM Provider
 * 
 * Implementation of LLMProvider for local Ollama instance.
 * Supports streaming responses for real-time generation.
 */

import axios, { AxiosError } from 'axios';
import logger from '../../utils/logger';
import { Errors } from '../../middleware/errorHandler';
import type { LLMProvider, LLMProviderConfig, TestPlanContext, GenerationStreamEvent } from '../../types';

export interface OllamaProviderConfig extends LLMProviderConfig {
  baseUrl: string;
  model: string;
}

interface OllamaModel {
  name: string;
  model: string;
  modified_at: string;
  size: number;
}

interface OllamaTagsResponse {
  models: OllamaModel[];
}

interface OllamaGenerateRequest {
  model: string;
  prompt: string;
  system?: string;
  stream: boolean;
  options?: {
    temperature?: number;
  };
}

interface OllamaGenerateResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
}

export class OllamaProvider implements LLMProvider {
  private config: OllamaProviderConfig;
  private baseUrl: string;

  constructor(config: OllamaProviderConfig) {
    this.config = config;
    this.baseUrl = config.baseUrl.replace(/\/$/, ''); // Remove trailing slash
  }

  /**
   * Generate test plan using Ollama API
   */
  async *generateTestPlan(context: TestPlanContext): AsyncGenerator<GenerationStreamEvent> {
    try {
      logger.info({ 
        model: this.config.model, 
        ticket: context.ticket.key,
        baseUrl: this.baseUrl,
      }, 'Starting Ollama generation');

      const prompt = this.buildPrompt(context);
      const systemPrompt = this.getSystemPrompt();
      
      // Yield progress update
      yield {
        type: 'progress',
        data: 'Generating test plan with Ollama (local)...',
        progress: 10,
      };

      // Use streaming API
      const response = await axios.post(
        `${this.baseUrl}/api/generate`,
        {
          model: this.config.model,
          prompt: prompt,
          system: systemPrompt,
          stream: true,
          options: {
            temperature: context.temperature ?? this.config.temperature,
          },
        } as OllamaGenerateRequest,
        {
          responseType: 'stream',
          timeout: 180000, // 3 minute timeout for local generation
        }
      );

      let fullContent = '';
      let buffer = '';

      for await (const chunk of response.data) {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const data: OllamaGenerateResponse = JSON.parse(line);
            
            if (data.response) {
              fullContent += data.response;
              
              yield {
                type: 'content',
                data: data.response,
                progress: data.done ? 100 : Math.min(10 + (fullContent.length / 100), 95),
              };
            }

            if (data.done) {
              logger.info({ 
                model: this.config.model,
                contentLength: fullContent.length,
              }, 'Ollama generation complete');

              yield {
                type: 'complete',
                data: fullContent,
                progress: 100,
              };
              return;
            }
          } catch (parseError) {
            // Skip invalid JSON lines
            logger.debug({ line, error: parseError }, 'Skipping invalid JSON line');
          }
        }
      }

      // If we exit the loop without 'done', consider it complete anyway
      yield {
        type: 'complete',
        data: fullContent,
        progress: 100,
      };

    } catch (error) {
      logger.error({ error }, 'Ollama generation failed');
      this.handleError(error);
      
      yield {
        type: 'error',
        data: error instanceof Error ? error.message : 'Unknown error',
      };
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
        message: `Connected to Ollama. ${models.length} models available.`,
        models,
      };
    } catch (error) {
      logger.error({ error }, 'Ollama connection test failed');
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to connect to Ollama',
      };
    }
  }

  /**
   * List available Ollama models
   */
  async listModels(): Promise<string[]> {
    try {
      const response = await axios.get<OllamaTagsResponse>(
        `${this.baseUrl}/api/tags`,
        { timeout: 5000 }
      );
      
      return response.data.models.map(m => m.name).sort();
    } catch (error) {
      this.handleError(error);
      return [];
    }
  }

  /**
   * Build the prompt from context
   */
  private buildPrompt(context: TestPlanContext): string {
    const { ticket, template } = context;
    
    return `Generate a comprehensive test plan based on the following JIRA ticket and template structure.

## JIRA Ticket Information

**Ticket ID:** ${ticket.key}
**Summary:** ${ticket.summary}
**Priority:** ${ticket.priority}
**Status:** ${ticket.status}
**Assignee:** ${ticket.assignee}

### Description
${ticket.description || 'No description provided'}

### Acceptance Criteria
${ticket.acceptanceCriteria || 'No explicit acceptance criteria provided'}

### Labels
${ticket.labels.join(', ') || 'None'}

## Template Structure

Follow this template structure for your response:

${template}

## Instructions

1. Analyze the JIRA ticket thoroughly
2. Map ticket details to appropriate sections in the template
3. Generate specific test cases based on acceptance criteria
4. Include both positive and negative test scenarios
5. Add edge cases where applicable
6. Maintain the template's formatting and structure
7. Use Markdown format for the output
8. Be comprehensive but concise

Generate the complete test plan now:`;
  }

  /**
   * Get system prompt
   */
  private getSystemPrompt(): string {
    return `You are an expert QA Engineer with extensive experience in test plan creation.

Your task is to generate comprehensive, professional test plans based on JIRA tickets and provided templates.

Guidelines:
- Be thorough and detail-oriented
- Consider both happy path and edge cases
- Include specific, actionable test steps
- Use clear, professional language
- Follow software testing best practices
- Ensure test coverage for all acceptance criteria

Output format: Markdown
Tone: Professional, technical, clear`;
  }

  /**
   * Handle Ollama API errors
   */
  private handleError(error: unknown): void {
    if (error instanceof AxiosError) {
      if (error.code === 'ECONNREFUSED') {
        throw Errors.BadGateway(
          'Cannot connect to Ollama. Please ensure Ollama is running on ' + this.baseUrl
        );
      }
      
      if (error.code === 'ETIMEDOUT') {
        throw Errors.BadGateway('Connection to Ollama timed out');
      }
      
      if (error.response?.status === 404) {
        throw Errors.NotFound('Ollama model not found. Please pull the model first with: ollama pull ' + this.config.model);
      }
    }
    
    throw Errors.BadGateway(error instanceof Error ? error.message : 'Ollama request failed');
  }
}

export default OllamaProvider;
