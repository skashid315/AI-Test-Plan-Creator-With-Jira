/**
 * JIRA API Client Service
 * 
 * Handles all communication with JIRA REST API v3.
 * Provides methods for connection testing and ticket fetching.
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import logger from '../utils/logger';
import { ApiError, Errors } from '../middleware/errorHandler';
import type { JiraConfig, JiraTicketResponse } from '../types';

export class JiraClient {
  private client: AxiosInstance;
  private config: JiraConfig;

  constructor(config: JiraConfig) {
    this.config = config;
    
    this.client = axios.create({
      baseURL: `${config.baseUrl}/rest/api/3`,
      auth: {
        username: config.username,
        password: config.apiToken,
      },
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      timeout: 30000, // 30 second timeout
    });

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        this.handleError(error);
        return Promise.reject(error);
      }
    );
  }

  /**
   * Test connection to JIRA by fetching current user info
   */
  async testConnection(): Promise<{ success: boolean; message: string; user?: string }> {
    try {
      logger.info({ baseUrl: this.config.baseUrl }, 'Testing JIRA connection');
      
      const response = await this.client.get('/myself');
      const user = response.data as { displayName: string; emailAddress: string };
      
      logger.info({ user: user.displayName }, 'JIRA connection successful');
      
      return {
        success: true,
        message: 'Connected successfully',
        user: user.displayName,
      };
    } catch (error) {
      logger.error({ error }, 'JIRA connection test failed');
      throw error;
    }
  }

  /**
   * Fetch a JIRA ticket by ID
   */
  async fetchTicket(ticketId: string): Promise<JiraTicketResponse> {
    try {
      logger.info({ ticketId }, 'Fetching JIRA ticket');
      
      const response = await this.client.get(`/issue/${ticketId}`, {
        params: {
          fields: 'summary,description,priority,status,assignee,labels,attachment,issuetype',
          expand: 'renderedFields',
        },
      });

      const issue = response.data;
      const fields = issue.fields;

      // Parse acceptance criteria from description
      const acceptanceCriteria = this.extractAcceptanceCriteria(fields.description);

      // Parse attachments
      const attachments = (fields.attachment || []).map((att: Record<string, unknown>) => ({
        filename: att.filename as string,
        contentType: att.mimeType as string,
        size: att.size as number,
        url: att.content as string,
      }));

      const ticket: JiraTicketResponse = {
        key: issue.key,
        summary: fields.summary || '',
        description: this.extractPlainText(fields.description),
        priority: fields.priority?.name || 'Unknown',
        status: fields.status?.name || 'Unknown',
        assignee: fields.assignee?.displayName || 'Unassigned',
        labels: fields.labels || [],
        acceptanceCriteria,
        attachments,
      };

      logger.info({ ticketId, summary: ticket.summary }, 'Ticket fetched successfully');
      
      return ticket;
    } catch (error) {
      logger.error({ ticketId, error }, 'Failed to fetch JIRA ticket');
      throw error;
    }
  }

  /**
   * Extract plain text from JIRA's Atlassian Document Format (ADF)
   */
  private extractPlainText(description: unknown): string {
    if (!description) return '';
    
    // If it's already a string, return it
    if (typeof description === 'string') return description;
    
    // Handle ADF (Atlassian Document Format)
    if (typeof description === 'object' && description !== null) {
      return this.parseADF(description as Record<string, unknown>);
    }
    
    return '';
  }

  /**
   * Parse Atlassian Document Format recursively
   */
  private parseADF(node: Record<string, unknown>): string {
    if (!node) return '';

    let text = '';

    // Handle text nodes
    if (node.type === 'text' && typeof node.text === 'string') {
      return node.text;
    }

    // Handle paragraph
    if (node.type === 'paragraph') {
      const content = this.parseContent(node.content);
      return content ? content + '\n\n' : '\n';
    }

    // Handle headings
    if (node.type === 'heading') {
      const level = node.attrs && typeof node.attrs === 'object' 
        ? (node.attrs as Record<string, unknown>).level 
        : 1;
      const content = this.parseContent(node.content);
      const prefix = '#'.repeat(Number(level) || 1) + ' ';
      return prefix + content + '\n\n';
    }

    // Handle bullet list
    if (node.type === 'bulletList') {
      const items = this.parseContent(node.content, '  ');
      return items ? items + '\n' : '';
    }

    // Handle ordered list
    if (node.type === 'orderedList') {
      const items = this.parseOrderedList(node.content as unknown[]);
      return items ? items + '\n' : '';
    }

    // Handle list item
    if (node.type === 'listItem') {
      const content = this.parseContent(node.content);
      return '• ' + content.replace(/\n+$/, '') + '\n';
    }

    // Handle code block
    if (node.type === 'codeBlock') {
      const content = this.parseContent(node.content);
      return '```\n' + content + '\n```\n\n';
    }

    // Handle hard break
    if (node.type === 'hardBreak') {
      return '\n';
    }

    // Parse content array
    if (node.content && Array.isArray(node.content)) {
      text += this.parseContent(node.content);
    }

    return text;
  }

  /**
   * Parse content array
   */
  private parseContent(content: unknown, indent: string = ''): string {
    if (!Array.isArray(content)) return '';
    
    return content
      .map(item => indent + this.parseADF(item as Record<string, unknown>))
      .join('');
  }

  /**
   * Parse ordered list items
   */
  private parseOrderedList(items: unknown[]): string {
    if (!Array.isArray(items)) return '';
    
    return items
      .map((item, index) => {
        const content = this.parseContent((item as Record<string, unknown>).content);
        return `${index + 1}. ${content.replace(/\n+$/, '')}\n`;
      })
      .join('');
  }

  /**
   * Extract acceptance criteria from description
   */
  private extractAcceptanceCriteria(description: unknown): string {
    const text = this.extractPlainText(description);
    
    // Look for common acceptance criteria patterns
    const patterns = [
      /(?:acceptance criteria|acceptance criteria:|ac:|given when then)/i,
      /(?:given|when|then)/i,
    ];
    
    for (const pattern of patterns) {
      const match = text.match(new RegExp(`(${pattern.source}).*`, 'is'));
      if (match) {
        // Extract from the match to end of section (next heading or double newline)
        const section = match[0].split(/\n{2,}|(?=#{1,6} )/)[0];
        return section.trim();
      }
    }
    
    // If no explicit acceptance criteria, return empty string
    return '';
  }

  /**
   * Handle API errors
   */
  private handleError(error: AxiosError): void {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data as { errorMessages?: string[]; errors?: Record<string, unknown> };
      
      switch (status) {
        case 401:
          throw Errors.Unauthorized('Invalid JIRA credentials. Please check your API token.');
        
        case 403:
          throw Errors.Forbidden('Access denied. Please check your JIRA permissions.');
        
        case 404:
          throw Errors.NotFound('JIRA ticket');
        
        case 429:
          throw Errors.TooManyRequests('JIRA API rate limit exceeded. Please try again later.');
        
        case 500:
        case 502:
        case 503:
          throw Errors.BadGateway('JIRA server error. Please try again later.');
        
        default:
          const message = data?.errorMessages?.[0] || `JIRA API error: ${status}`;
          throw Errors.BadGateway(message);
      }
    } else if (error.code === 'ECONNREFUSED') {
      throw Errors.BadGateway('Cannot connect to JIRA server. Please check your base URL.');
    } else if (error.code === 'ETIMEDOUT') {
      throw Errors.BadGateway('Connection to JIRA timed out. Please try again.');
    }
  }
}

export default JiraClient;
