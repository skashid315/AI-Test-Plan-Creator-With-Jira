# Findings

## Discovery Questions - ANSWERED

### 1. What is the goal/purpose of this project?
Build a full-stack web application that automates test plan creation by integrating JIRA ticket data with LLM-powered analysis using customizable templates.

### 2. What problem does it solve?
QA Engineers spend significant time manually writing test plans from JIRA tickets. This tool automates that process by:
- Fetching ticket data from JIRA API
- Analyzing the content using LLMs (Groq cloud or Ollama local)
- Generating structured test plans based on uploaded PDF templates
- Providing export capabilities (Markdown/PDF)

### 3. Who are the users?
Primary users: QA Engineers, Test Managers who need to create comprehensive test plans from JIRA tickets.

### 4. What are the key features?
- **Settings Module**: JIRA credentials, LLM provider config (Groq/Ollama), Template management
- **JIRA Integration**: Fetch ticket data, display formatted info, recent history
- **LLM Integration**: Test plan generation with streaming, dual provider support
- **Template System**: PDF upload, structure extraction, fallback default
- **Export**: Markdown, PDF, Copy to clipboard
- **History**: Save and retrieve past test plans

### 5. Technology preferences and constraints?
**Frontend**: React (Vite) + TypeScript + Tailwind CSS + shadcn/ui
**Backend**: Need to choose between Node.js (Express) or Python (FastAPI)
**Storage**: SQLite for settings/history, File system for templates
**LLM Providers**: Groq API (cloud) + Ollama (local REST API)
**Security**: OS keychain or encrypted storage for API keys

## Research & Discoveries
<!-- Document research, discoveries, and insights here -->

## Constraints
<!-- Document technical or business constraints -->

## Assumptions
<!-- Document assumptions made during the project -->

## Risks
<!-- Identify potential risks -->

## Decisions
<!-- Record key decisions and their rationale -->

