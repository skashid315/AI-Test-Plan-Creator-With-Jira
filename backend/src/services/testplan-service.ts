/**
 * Test Plan Service
 * 
 * Orchestrates the test plan generation workflow:
 * - Retrieves ticket and template
 * - Builds context for LLM
 * - Generates test plan using selected provider
 * - Saves to history
 */

import { getDatabase } from '../database/connection';
import JiraTicketService from './jira-ticket-service';
import TemplateService from './template-service';
import SettingsService from './settings-service';
import { createLLMProvider } from './llm';
import logger from '../utils/logger';
import { Errors } from '../middleware/errorHandler';
import type { 
  GenerateTestPlanRequest, 
  JiraTicketResponse, 
  TestPlanContext, 
  GenerationStreamEvent,
  TestPlanHistory,
} from '../types';

export interface GenerationOptions {
  ticketId: string;
  templateId?: number;
  provider: 'groq' | 'ollama';
}

export class TestPlanService {
  private db = getDatabase();
  private ticketService = new JiraTicketService();
  private templateService = new TemplateService();
  private settingsService = new SettingsService();

  /**
   * Generate a test plan
   * Returns an async generator for streaming responses
   */
  async *generate(options: GenerationOptions): AsyncGenerator<GenerationStreamEvent> {
    try {
      const { ticketId, templateId, provider } = options;

      logger.info({ ticketId, provider, templateId }, 'Starting test plan generation');

      // Step 1: Get ticket
      yield { type: 'progress', data: 'Fetching JIRA ticket...', progress: 5 };
      
      const ticket = await this.getTicket(ticketId);
      if (!ticket) {
        throw Errors.NotFound('JIRA ticket');
      }

      yield { type: 'progress', data: `Ticket found: ${ticket.summary}`, progress: 15 };

      // Step 2: Get template
      yield { type: 'progress', data: 'Loading template...', progress: 20 };
      
      const template = await this.getTemplate(templateId);
      
      yield { type: 'progress', data: 'Template loaded', progress: 25 };

      // Step 3: Build context
      const context: TestPlanContext = {
        ticket,
        template: template.content,
        temperature: this.getTemperature(provider),
      };

      // Step 4: Generate with LLM
      yield { type: 'progress', data: `Generating with ${provider}...`, progress: 30 };

      const llmProvider = createLLMProvider(provider);
      let fullContent = '';

      for await (const event of llmProvider.generateTestPlan(context)) {
        // Accumulate content
        if (event.type === 'content') {
          fullContent += event.data;
        }

        // Forward event to client
        yield event;
      }

      // Step 5: Save to history
      if (fullContent) {
        yield { type: 'progress', data: 'Saving to history...', progress: 95 };
        
        await this.saveToHistory({
          ticketKey: ticket.key,
          templateId: template.id,
          provider,
          content: fullContent,
        });

        logger.info({ ticketKey: ticket.key, provider }, 'Test plan generated and saved');
      }

      yield { type: 'complete', data: fullContent, progress: 100 };

    } catch (error) {
      logger.error({ error, options }, 'Test plan generation failed');
      
      if (error instanceof Error && 'status' in error) {
        throw error; // Already an ApiError
      }
      
      yield {
        type: 'error',
        data: error instanceof Error ? error.message : 'Generation failed',
      };
    }
  }

  /**
   * Get ticket from cache or throw error
   */
  private async getTicket(ticketId: string): Promise<JiraTicketResponse | null> {
    // First try cache
    let ticket = this.ticketService.getTicket(ticketId);
    
    if (ticket) {
      logger.info({ ticketId }, 'Using cached ticket');
      return ticket;
    }

    // If not in cache, we need to fetch it
    // This requires JIRA to be configured
    const jiraConfig = this.settingsService.getJiraConfig();
    
    if (!jiraConfig.baseUrl || !jiraConfig.apiToken) {
      throw Errors.BadRequest(
        'Ticket not in cache and JIRA not configured. Please configure JIRA settings first.'
      );
    }

    // Import JiraClient dynamically to avoid circular dependency
    const { default: JiraClient } = await import('./jira-client');
    const jiraClient = new JiraClient(jiraConfig);
    
    ticket = await jiraClient.fetchTicket(ticketId);
    await this.ticketService.saveTicket(ticket);
    
    return ticket;
  }

  /**
   * Get template by ID or default
   */
  private async getTemplate(templateId?: number): Promise<{ id: number; content: string; name: string }> {
    let template: { id: number; content: string; name: string } | null = null;

    if (templateId) {
      const t = this.templateService.getTemplate(templateId);
      if (t) {
        template = { id: t.id, content: t.content, name: t.name };
      }
    }

    if (!template) {
      const t = this.templateService.getDefaultTemplate();
      if (t) {
        template = { id: t.id, content: t.content, name: t.name };
      }
    }

    if (!template) {
      throw Errors.NotFound('Template');
    }

    return template;
  }

  /**
   * Get temperature for provider
   */
  private getTemperature(provider: 'groq' | 'ollama'): number {
    const config = this.settingsService.getLLMConfig();
    
    if (provider === 'groq') {
      return config.groq.temperature;
    }
    
    return 0.7; // Default for Ollama
  }

  /**
   * Save generated test plan to history
   */
  private async saveToHistory(data: {
    ticketKey: string;
    templateId: number;
    provider: string;
    content: string;
  }): Promise<number> {
    try {
      // Get ticket ID from database
      const ticketRow = this.db.prepare(
        'SELECT id FROM jira_tickets WHERE ticket_key = ?'
      ).get(data.ticketKey) as { id: number } | undefined;

      const stmt = this.db.prepare(`
        INSERT INTO test_plan_history (ticket_key, ticket_id, template_id, llm_provider, generated_content)
        VALUES (?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        data.ticketKey,
        ticketRow?.id || null,
        data.templateId,
        data.provider,
        data.content
      );

      return Number(result.lastInsertRowid);
    } catch (error) {
      logger.error({ error }, 'Failed to save to history');
      // Don't throw - history save is non-critical
      return 0;
    }
  }

  /**
   * Get generation history
   */
  getHistory(limit: number = 20): TestPlanHistory[] {
    try {
      const rows = this.db.prepare(`
        SELECT h.*, t.ticket_key as ticket_key_ref, t.summary as ticket_summary
        FROM test_plan_history h
        LEFT JOIN jira_tickets t ON h.ticket_id = t.id
        ORDER BY h.created_at DESC
        LIMIT ?
      `).all(limit) as Array<{
        id: number;
        ticket_key: string;
        ticket_id: number;
        template_id: number;
        llm_provider: string;
        generated_content: string;
        created_at: string;
        ticket_key_ref: string;
        ticket_summary: string;
      }>;

      return rows.map(row => ({
        id: row.id,
        ticketKey: row.ticket_key,
        ticketId: row.ticket_id,
        templateId: row.template_id,
        llmProvider: row.llm_provider,
        generatedContent: row.generated_content,
        createdAt: row.created_at,
        // Include ticket summary for display
        ticketSummary: row.ticket_summary || row.ticket_key,
      })) as TestPlanHistory[];
    } catch (error) {
      logger.error({ error }, 'Failed to get history');
      return [];
    }
  }

  /**
   * Get a specific test plan from history
   */
  getTestPlan(id: number): TestPlanHistory | null {
    try {
      const row = this.db.prepare(`
        SELECT h.*, t.summary as ticket_summary
        FROM test_plan_history h
        LEFT JOIN jira_tickets t ON h.ticket_id = t.id
        WHERE h.id = ?
      `).get(id) as {
        id: number;
        ticket_key: string;
        ticket_id: number;
        template_id: number;
        llm_provider: string;
        generated_content: string;
        created_at: string;
        ticket_summary: string;
      } | undefined;

      if (!row) {
        return null;
      }

      return {
        id: row.id,
        ticketKey: row.ticket_key,
        ticketId: row.ticket_id,
        templateId: row.template_id,
        llmProvider: row.llm_provider,
        generatedContent: row.generated_content,
        createdAt: row.created_at,
        ticketSummary: row.ticket_summary || row.ticket_key,
      } as TestPlanHistory;
    } catch (error) {
      logger.error({ error, id }, 'Failed to get test plan');
      return null;
    }
  }

  /**
   * Delete test plan from history
   */
  deleteTestPlan(id: number): void {
    try {
      const result = this.db.prepare('DELETE FROM test_plan_history WHERE id = ?').run(id);

      if (result.changes === 0) {
        throw Errors.NotFound('Test plan');
      }

      logger.info({ id }, 'Test plan deleted from history');
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        throw error;
      }
      logger.error({ error, id }, 'Failed to delete test plan');
      throw Errors.Internal('Failed to delete test plan');
    }
  }
}

export default TestPlanService;
