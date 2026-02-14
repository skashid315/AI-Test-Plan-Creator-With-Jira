/**
 * Groq LLM Provider
 * 
 * Implementation of LLMProvider for Groq API.
 * Supports streaming responses for real-time generation.
 */

import Groq from 'groq-sdk';
import logger from '../../utils/logger';
import { Errors } from '../../middleware/errorHandler';
import type { LLMProvider, LLMProviderConfig, TestPlanContext, GenerationStreamEvent } from '../../types';

export interface GroqConfig extends LLMProviderConfig {
  apiKey: string;
  model: string;
}

export class GroqProvider implements LLMProvider {
  private client: Groq;
  private config: GroqConfig;

  constructor(config: GroqConfig) {
    this.config = config;
    this.client = new Groq({
      apiKey: config.apiKey,
    });
  }

  /**
   * Generate test plan using Groq API
   */
  async *generateTestPlan(context: TestPlanContext): AsyncGenerator<GenerationStreamEvent> {
    try {
      logger.info({ 
        model: this.config.model, 
        ticket: context.ticket.key,
        temperature: context.temperature ?? this.config.temperature,
      }, 'Starting Groq generation');

      const prompt = this.buildPrompt(context);
      
      // Yield progress update
      yield {
        type: 'progress',
        data: 'Generating test plan with Groq...',
        progress: 10,
      };

      const stream = await this.client.chat.completions.create({
        model: this.config.model,
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt(),
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: context.temperature ?? this.config.temperature,
        max_tokens: 4096,
        stream: true,
      });

      let fullContent = '';
      let chunkCount = 0;

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        
        if (content) {
          fullContent += content;
          chunkCount++;
          
          // Yield content update every few chunks
          if (chunkCount % 5 === 0) {
            yield {
              type: 'content',
              data: content,
              progress: Math.min(10 + (fullContent.length / 100), 90),
            };
          } else {
            yield {
              type: 'content',
              data: content,
            };
          }
        }
      }

      logger.info({ 
        model: this.config.model,
        chunks: chunkCount,
        contentLength: fullContent.length,
      }, 'Groq generation complete');

      // Yield completion
      yield {
        type: 'complete',
        data: fullContent,
        progress: 100,
      };

    } catch (error) {
      logger.error({ error }, 'Groq generation failed');
      this.handleError(error);
      
      yield {
        type: 'error',
        data: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Test connection to Groq
   */
  async testConnection(): Promise<{ success: boolean; message: string; models?: string[] }> {
    try {
      if (!this.config.apiKey) {
        return {
          success: false,
          message: 'Groq API key not configured',
        };
      }

      // Try to list models as a connection test
      const models = await this.listModels();
      
      return {
        success: true,
        message: `Connected to Groq. ${models.length} models available.`,
        models,
      };
    } catch (error) {
      logger.error({ error }, 'Groq connection test failed');
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to connect to Groq',
      };
    }
  }

  /**
   * List available Groq models
   */
  async listModels(): Promise<string[]> {
    // Groq has a fixed set of models, return the commonly used ones
    // In a real implementation, you might fetch from their API
    return [
      'llama3-70b-8192',
      'llama3-8b-8192',
      'mixtral-8x7b-32768',
      'gemma-7b-it',
      'llama2-70b-4096',
    ];
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
   * Handle Groq API errors
   */
  private handleError(error: unknown): void {
    if (error instanceof Groq.APIError) {
      const status = error.status;
      
      if (status === 401) {
        throw Errors.Unauthorized('Invalid Groq API key');
      }
      
      if (status === 429) {
        throw Errors.TooManyRequests('Groq rate limit exceeded. Please try again later.');
      }
      
      if (status >= 500) {
        throw Errors.BadGateway('Groq service error. Please try again later.');
      }
      
      throw Errors.BadGateway(error.message);
    }
    
    if (error instanceof Error) {
      if (error.message.includes('timeout')) {
        throw Errors.BadGateway('Request to Groq timed out');
      }
    }
  }
}

export default GroqProvider;
