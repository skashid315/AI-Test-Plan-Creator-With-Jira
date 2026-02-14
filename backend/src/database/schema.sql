-- ============================================
-- Test Plan Generator - Database Schema
-- SQLite Database
-- ============================================

-- Enable foreign keys
PRAGMA foreign_keys = ON;

-- Settings table: Application configuration
-- -----------------------------------------
CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK (id = 1), -- Only one row allowed
    
    -- JIRA Configuration
    jira_base_url TEXT,
    jira_username TEXT,
    jira_api_token TEXT, -- Encrypted
    jira_connected INTEGER DEFAULT 0, -- Boolean: 0 = false, 1 = true
    
    -- LLM Configuration
    llm_provider TEXT DEFAULT 'groq', -- 'groq' or 'ollama'
    
    -- Groq Settings
    groq_api_key TEXT, -- Encrypted
    groq_model TEXT DEFAULT 'llama3-70b-8192',
    groq_temperature REAL DEFAULT 0.7,
    
    -- Ollama Settings
    ollama_base_url TEXT DEFAULT 'http://localhost:11434',
    ollama_model TEXT DEFAULT 'llama3',
    
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert default settings if not exists
INSERT OR IGNORE INTO settings (id) VALUES (1);

-- Templates table: PDF test plan templates
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    filename TEXT NOT NULL,
    filepath TEXT NOT NULL,
    content TEXT, -- Extracted text from PDF
    is_default INTEGER DEFAULT 0, -- Boolean: 0 = false, 1 = true
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Ensure only one default template
CREATE UNIQUE INDEX IF NOT EXISTS idx_default_template ON templates (is_default) WHERE is_default = 1;

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_templates_name ON templates (name);

-- JIRA Tickets table: Cached ticket data
-- --------------------------------------
CREATE TABLE IF NOT EXISTS jira_tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_key TEXT UNIQUE NOT NULL,
    summary TEXT,
    description TEXT,
    priority TEXT,
    status TEXT,
    assignee TEXT,
    labels TEXT, -- JSON array
    acceptance_criteria TEXT,
    attachments TEXT, -- JSON array
    raw_data TEXT, -- Full JIRA response JSON
    fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for ticket lookups
CREATE INDEX IF NOT EXISTS idx_tickets_key ON jira_tickets (ticket_key);
CREATE INDEX IF NOT EXISTS idx_tickets_fetched ON jira_tickets (fetched_at);

-- Test Plan History table: Generated test plans
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS test_plan_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_key TEXT NOT NULL,
    ticket_id INTEGER,
    template_id INTEGER,
    llm_provider TEXT NOT NULL,
    generated_content TEXT NOT NULL, -- Markdown content
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (ticket_id) REFERENCES jira_tickets(id) ON DELETE SET NULL,
    FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE SET NULL
);

-- Indexes for history queries
CREATE INDEX IF NOT EXISTS idx_history_ticket ON test_plan_history (ticket_key);
CREATE INDEX IF NOT EXISTS idx_history_created ON test_plan_history (created_at);

-- Triggers for automatic timestamp updates
-- -----------------------------------------
CREATE TRIGGER IF NOT EXISTS update_settings_timestamp 
AFTER UPDATE ON settings
BEGIN
    UPDATE settings SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_templates_timestamp 
AFTER UPDATE ON templates
BEGIN
    UPDATE templates SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
