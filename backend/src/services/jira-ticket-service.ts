/**
 * JIRA Ticket Service
 * 
 * Manages JIRA ticket caching in the database.
 * Provides CRUD operations for cached tickets.
 */

import { getDatabase } from '../database/connection';
import logger from '../utils/logger';
import { Errors } from '../middleware/errorHandler';
import type { JiraTicketResponse, JiraTicket, JiraTicketRow } from '../types';

export class JiraTicketService {
  private db = getDatabase();

  /**
   * Save or update a ticket in the cache
   */
  async saveTicket(ticket: JiraTicketResponse): Promise<void> {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO jira_tickets (
          ticket_key,
          summary,
          description,
          priority,
          status,
          assignee,
          labels,
          acceptance_criteria,
          attachments,
          raw_data,
          fetched_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(ticket_key) DO UPDATE SET
          summary = excluded.summary,
          description = excluded.description,
          priority = excluded.priority,
          status = excluded.status,
          assignee = excluded.assignee,
          labels = excluded.labels,
          acceptance_criteria = excluded.acceptance_criteria,
          attachments = excluded.attachments,
          raw_data = excluded.raw_data,
          fetched_at = CURRENT_TIMESTAMP
      `);

      stmt.run(
        ticket.key,
        ticket.summary,
        ticket.description,
        ticket.priority,
        ticket.status,
        ticket.assignee,
        JSON.stringify(ticket.labels),
        ticket.acceptanceCriteria,
        JSON.stringify(ticket.attachments),
        JSON.stringify(ticket)
      );

      logger.info({ ticketKey: ticket.key }, 'Ticket saved to cache');
    } catch (error) {
      logger.error({ error, ticketKey: ticket.key }, 'Failed to save ticket');
      throw Errors.Internal('Failed to save ticket to cache');
    }
  }

  /**
   * Get a ticket from cache by key
   */
  getTicket(ticketKey: string): JiraTicketResponse | null {
    try {
      const row = this.db.prepare(
        'SELECT * FROM jira_tickets WHERE ticket_key = ?'
      ).get(ticketKey) as JiraTicketRow | undefined;

      if (!row) {
        return null;
      }

      return this.rowToResponse(row);
    } catch (error) {
      logger.error({ error, ticketKey }, 'Failed to get ticket');
      return null;
    }
  }

  /**
   * Check if ticket exists in cache
   */
  exists(ticketKey: string): boolean {
    try {
      const result = this.db.prepare(
        'SELECT 1 FROM jira_tickets WHERE ticket_key = ?'
      ).get(ticketKey);
      return !!result;
    } catch (error) {
      logger.error({ error, ticketKey }, 'Failed to check ticket existence');
      return false;
    }
  }

  /**
   * Get recently fetched tickets
   */
  getRecentTickets(limit: number = 5): JiraTicketResponse[] {
    try {
      const rows = this.db.prepare(
        'SELECT * FROM jira_tickets ORDER BY fetched_at DESC LIMIT ?'
      ).all(limit) as JiraTicketRow[];

      return rows.map(row => this.rowToResponse(row));
    } catch (error) {
      logger.error({ error }, 'Failed to get recent tickets');
      return [];
    }
  }

  /**
   * Search tickets in cache
   */
  searchTickets(query: string): JiraTicketResponse[] {
    try {
      const searchPattern = `%${query}%`;
      const rows = this.db.prepare(
        `SELECT * FROM jira_tickets 
         WHERE ticket_key LIKE ? 
            OR summary LIKE ? 
            OR description LIKE ?
         ORDER BY fetched_at DESC`
      ).all(searchPattern, searchPattern, searchPattern) as JiraTicketRow[];

      return rows.map(row => this.rowToResponse(row));
    } catch (error) {
      logger.error({ error, query }, 'Failed to search tickets');
      return [];
    }
  }

  /**
   * Delete a ticket from cache
   */
  deleteTicket(ticketKey: string): void {
    try {
      const result = this.db.prepare(
        'DELETE FROM jira_tickets WHERE ticket_key = ?'
      ).run(ticketKey);

      if (result.changes === 0) {
        throw Errors.NotFound('Ticket');
      }

      logger.info({ ticketKey }, 'Ticket deleted from cache');
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        throw error;
      }
      logger.error({ error, ticketKey }, 'Failed to delete ticket');
      throw Errors.Internal('Failed to delete ticket');
    }
  }

  /**
   * Get all cached tickets (for admin/debug)
   */
  getAllTickets(limit: number = 100): JiraTicketResponse[] {
    try {
      const rows = this.db.prepare(
        'SELECT * FROM jira_tickets ORDER BY fetched_at DESC LIMIT ?'
      ).all(limit) as JiraTicketRow[];

      return rows.map(row => this.rowToResponse(row));
    } catch (error) {
      logger.error({ error }, 'Failed to get all tickets');
      return [];
    }
  }

  /**
   * Clear old tickets from cache (maintenance)
   */
  clearOldTickets(days: number = 30): number {
    try {
      const result = this.db.prepare(
        'DELETE FROM jira_tickets WHERE fetched_at < datetime("now", ?)'
      ).run(`-${days} days`);

      logger.info({ deleted: result.changes, days }, 'Cleared old tickets');
      return result.changes;
    } catch (error) {
      logger.error({ error }, 'Failed to clear old tickets');
      return 0;
    }
  }

  /**
   * Get ticket count
   */
  getCount(): number {
    try {
      const result = this.db.prepare(
        'SELECT COUNT(*) as count FROM jira_tickets'
      ).get() as { count: number };

      return result.count;
    } catch (error) {
      logger.error({ error }, 'Failed to get ticket count');
      return 0;
    }
  }

  /**
   * Convert database row to JiraTicketResponse
   */
  private rowToResponse(row: JiraTicketRow): JiraTicketResponse {
    return {
      key: row.ticket_key,
      summary: row.summary,
      description: row.description,
      priority: row.priority,
      status: row.status,
      assignee: row.assignee,
      labels: JSON.parse(row.labels || '[]'),
      acceptanceCriteria: row.acceptance_criteria,
      attachments: JSON.parse(row.attachments || '[]'),
    };
  }

  /**
   * Convert database row to full JiraTicket (with metadata)
   */
  private rowToTicket(row: JiraTicketRow): JiraTicket {
    return {
      id: row.id,
      ticket_key: row.ticket_key,
      summary: row.summary,
      description: row.description,
      priority: row.priority,
      status: row.status,
      assignee: row.assignee,
      labels: row.labels,
      acceptance_criteria: row.acceptance_criteria,
      attachments: row.attachments,
      raw_data: row.raw_data,
      fetched_at: row.fetched_at,
    };
  }
}

export default JiraTicketService;
