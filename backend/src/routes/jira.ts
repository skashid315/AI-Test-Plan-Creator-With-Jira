/**
 * JIRA Routes
 * 
 * API endpoints for JIRA ticket operations:
 * - Fetch ticket by ID
 * - Get recently fetched tickets
 */

import { Router, Request, Response } from 'express';
import { validationResult } from 'express-validator';
import JiraClient from '../services/jira-client';
import JiraTicketService from '../services/jira-ticket-service';
import SettingsService from '../services/settings-service';
import logger from '../utils/logger';
import { asyncHandler, Errors } from '../middleware/errorHandler';
import { jiraIdValidator, jiraIdBodyValidator, paginationValidator } from '../middleware/validators';

const router = Router();
const settingsService = new SettingsService();
const ticketService = new JiraTicketService();

// ============================================
// Helper: Check JIRA Configuration
// ============================================

function getJiraClient(): JiraClient {
  const config = settingsService.getJiraConfig();
  
  if (!config.baseUrl || !config.username || !config.apiToken) {
    throw Errors.BadRequest('JIRA credentials not configured. Please configure in settings first.');
  }
  
  return new JiraClient(config);
}

// ============================================
// Routes
// ============================================

/**
 * GET /api/jira/fetch/:ticketId
 * Fetch a JIRA ticket by ID
 */
router.get(
  '/fetch/:ticketId',
  jiraIdValidator,
  asyncHandler(async (req: Request, res: Response) => {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw Errors.ValidationError('Validation failed', { errors: errors.array() });
    }

    const { ticketId } = req.params;
    
    logger.info({ ticketId }, 'Fetching JIRA ticket');
    
    // Get JIRA client
    const jiraClient = getJiraClient();
    
    // Fetch from JIRA API
    const ticket = await jiraClient.fetchTicket(ticketId);
    
    // Save to database (cache)
    await ticketService.saveTicket(ticket);
    
    logger.info({ ticketId, summary: ticket.summary }, 'Ticket fetched and cached');
    
    res.json({
      success: true,
      data: ticket,
      cached: false,
      message: 'Ticket fetched from JIRA',
    });
  })
);

/**
 * POST /api/jira/fetch
 * Fetch a JIRA ticket by ID (POST version)
 * Useful when ticket ID is sent in request body
 */
router.post(
  '/fetch',
  jiraIdBodyValidator,
  asyncHandler(async (req: Request, res: Response) => {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw Errors.ValidationError('Validation failed', { errors: errors.array() });
    }

    const { ticketId } = req.body;
    
    logger.info({ ticketId }, 'Fetching JIRA ticket (POST)');
    
    // Get JIRA client
    const jiraClient = getJiraClient();
    
    // Fetch from JIRA API
    const ticket = await jiraClient.fetchTicket(ticketId);
    
    // Save to database (cache)
    await ticketService.saveTicket(ticket);
    
    logger.info({ ticketId, summary: ticket.summary }, 'Ticket fetched and cached');
    
    res.json({
      success: true,
      data: ticket,
      cached: false,
      message: 'Ticket fetched from JIRA',
    });
  })
);

/**
 * GET /api/jira/ticket/:ticketId
 * Get cached ticket from database
 */
router.get(
  '/ticket/:ticketId',
  jiraIdValidator,
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw Errors.ValidationError('Validation failed', { errors: errors.array() });
    }

    const { ticketId } = req.params;
    
    // Try to get from cache first
    const cached = ticketService.getTicket(ticketId);
    
    if (cached) {
      logger.info({ ticketId }, 'Ticket retrieved from cache');
      return res.json({
        success: true,
        data: cached,
        cached: true,
        message: 'Ticket retrieved from cache',
      });
    }
    
    // If not in cache, fetch from JIRA
    logger.info({ ticketId }, 'Ticket not in cache, fetching from JIRA');
    
    const jiraClient = getJiraClient();
    const ticket = await jiraClient.fetchTicket(ticketId);
    await ticketService.saveTicket(ticket);
    
    res.json({
      success: true,
      data: ticket,
      cached: false,
      message: 'Ticket fetched from JIRA',
    });
  })
);

/**
 * GET /api/jira/recent
 * Get recently fetched tickets
 */
router.get(
  '/recent',
  paginationValidator,
  asyncHandler(async (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 5;
    
    logger.info({ limit }, 'Fetching recent tickets');
    
    const tickets = ticketService.getRecentTickets(limit);
    
    res.json({
      success: true,
      data: tickets,
      count: tickets.length,
    });
  })
);

/**
 * GET /api/jira/search
 * Search cached tickets
 */
router.get(
  '/search',
  asyncHandler(async (req: Request, res: Response) => {
    const query = req.query.q as string;
    
    if (!query || query.trim().length < 2) {
      throw Errors.BadRequest('Search query must be at least 2 characters');
    }
    
    logger.info({ query }, 'Searching tickets');
    
    const tickets = ticketService.searchTickets(query);
    
    res.json({
      success: true,
      data: tickets,
      count: tickets.length,
    });
  })
);

/**
 * DELETE /api/jira/ticket/:ticketId
 * Remove ticket from cache
 */
router.delete(
  '/ticket/:ticketId',
  jiraIdValidator,
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw Errors.ValidationError('Validation failed', { errors: errors.array() });
    }

    const { ticketId } = req.params;
    
    logger.info({ ticketId }, 'Deleting ticket from cache');
    
    ticketService.deleteTicket(ticketId);
    
    res.json({
      success: true,
      message: `Ticket ${ticketId} removed from cache`,
    });
  })
);

export default router;
