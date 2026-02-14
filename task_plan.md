# Task Plan - Intelligent Test Plan Generator

## Project Overview
A full-stack web application that automates test plan creation by integrating JIRA ticket data with LLM-powered analysis using customizable PDF templates.

**Tech Stack:**
- Frontend: React (Vite) + TypeScript + Tailwind CSS + shadcn/ui
- Backend: Node.js + Express + TypeScript
- Database: SQLite (better-sqlite3)
- Storage: File system for PDFs, OS keychain for secrets
- LLM: Groq API SDK + Ollama REST API
- PDF Processing: pdf-parse

---

## Phase Status

### Phase 0: Initialization ✅ COMPLETE
- [x] Create `task_plan.md`
- [x] Create `findings.md` with Discovery Answers
- [x] Create `progress.md`
- [x] Create `gemini.md` with Data Schemas

### Phase 1: Project Setup ✅ COMPLETE
**Goal:** Initialize project structure and install dependencies

**Checklist:**
- [x] Create root directory structure
- [x] Initialize backend (package.json, tsconfig)
- [x] Initialize frontend (Vite + React + TypeScript)
- [x] Install backend dependencies (express, better-sqlite3, keytar, pdf-parse, groq-sdk, etc.)
- [x] Install frontend dependencies (tailwind, shadcn/ui, axios)
- [x] Setup shadcn/ui components
- [x] Create environment files (.env.example)

**Status:** All configuration files created. Ready to run `npm install` in both directories.

### Phase 2: Backend Foundation ✅ COMPLETE
**Goal:** Database, config, and core services

**Checklist:**
- [x] Database initialization script (SQLite schema)
- [x] Encryption utility (for API keys)
- [x] Configuration service
- [x] Logger utility
- [x] Error handling middleware
- [x] Basic Express server setup

**Status:** Backend infrastructure complete. Can start server with `npm run dev` after installing dependencies.

### Phase 3: Settings & Configuration Module ✅ COMPLETE
**Goal:** JIRA and LLM configuration endpoints

**Checklist:**
- [x] JIRA settings routes (POST/GET/TEST)
- [x] LLM settings routes (POST/GET)
- [x] Ollama models listing endpoint
- [x] Secure credential storage (encryption-based)
- [x] Settings validation middleware

**API Endpoints:**
- `GET/POST /api/settings/jira` - JIRA configuration
- `POST /api/settings/jira/test` - Test JIRA connection
- `GET/POST /api/settings/llm` - LLM configuration
- `GET /api/settings/llm/models` - List Ollama models
- `POST /api/settings/llm/test` - Test LLM connection

### Phase 4: JIRA Integration ✅ COMPLETE
**Goal:** Fetch and cache JIRA tickets

**Checklist:**
- [x] JIRA client service (axios-based)
- [x] Fetch ticket endpoint
- [x] Recent tickets endpoint
- [x] Ticket data parser (extract acceptance criteria)
- [x] Ticket caching in database

**API Endpoints:**
- `GET/POST /api/jira/fetch/:ticketId` - Fetch from JIRA
- `GET /api/jira/ticket/:ticketId` - Get from cache or JIRA
- `GET /api/jira/recent` - Recently fetched tickets
- `GET /api/jira/search?q=query` - Search cached tickets
- `DELETE /api/jira/ticket/:ticketId` - Remove from cache

### Phase 5: Template Management ✅ COMPLETE
**Goal:** PDF upload and structure extraction

**Checklist:**
- [x] PDF upload endpoint (multer)
- [x] PDF text extraction service
- [x] Template CRUD endpoints
- [x] Default template creation
- [x] Template storage service

**API Endpoints:**
- `GET /api/templates` - List templates
- `GET /api/templates/default` - Get default
- `GET /api/templates/:id` - Get by ID
- `POST /api/templates/upload` - Upload PDF
- `PUT /api/templates/:id` - Update
- `POST /api/templates/:id/default` - Set default
- `DELETE /api/templates/:id` - Delete
- `GET /api/templates/:id/download` - Download PDF

### Phase 6: LLM Integration ✅ COMPLETE
**Goal:** Generate test plans using LLMs

**Checklist:**
- [x] LLM provider abstraction interface
- [x] Groq provider implementation (streaming)
- [x] Ollama provider implementation (streaming)
- [x] Context builder service (ticket + template)
- [x] SSE streaming endpoint
- [x] Test plan history storage

**Services Created:**
- `src/services/llm/index.ts` - Provider interface & factory
- `src/services/llm/groq-provider.ts` - Groq API integration
- `src/services/llm/ollama-provider.ts` - Ollama local LLM
- `src/services/testplan-service.ts` - Generation orchestration

**API Endpoints:**
- `POST /api/testplan/generate` - SSE streaming
- `POST /api/testplan/generate-sync` - Synchronous
- `GET /api/testplan/history` - Get history
- `GET /api/testplan/history/:id` - Get specific
- `DELETE /api/testplan/history/:id` - Delete
- `GET /api/testplan/history/:id/export` - Export Markdown

### Phase 7: Frontend - Settings UI ✅ COMPLETE
**Goal:** Configuration panels

**Checklist:**
- [x] Sidebar navigation component
- [x] JIRA settings form with test connection
- [x] LLM settings form (Groq/Ollama toggle)
- [x] Toast notifications
- [x] React Router setup

**Components Created:**
- `src/types/index.ts` - Frontend types
- `src/services/api.ts` - API client
- `src/hooks/use-settings.ts` - Settings hook
- `src/components/ui/select.tsx` - Select component
- `src/components/ui/textarea.tsx` - Textarea component
- `src/components/ui/tabs.tsx` - Tabs component
- `src/components/ui/switch.tsx` - Switch component
- `src/components/ui/badge.tsx` - Badge component
- `src/pages/Settings.tsx` - Settings page
- `src/components/layout/Sidebar.tsx` - Navigation
- `src/App.tsx` - Router setup

### Phase 8: Frontend - Main Workflow UI ✅ COMPLETE
**Goal:** Ticket fetch and test plan generation

**Checklist:**
- [x] Ticket input form
- [x] Ticket display panel
- [x] Generation controls (template, provider)
- [x] Progress indicator component
- [x] Generated content display
- [x] Export options (Copy, Download MD)

**Components Created:**
- `src/components/ui/progress.tsx` - Progress bar
- `src/components/ui/scroll-area.tsx` - Scrollable areas
- `src/components/ui/separator.tsx` - Dividers
- `src/components/ui/alert.tsx` - Alert messages
- `src/components/jira-display/TicketDisplay.tsx` - Ticket info
- `src/pages/Generate.tsx` - Main workflow page

**Workflow Steps:**
1. Enter JIRA ticket ID → Fetch
2. Select template & LLM provider → Generate
3. View output → Copy or Download

### Phase 9: Frontend - History UI ✅ COMPLETE
**Goal:** View past test plans

**Checklist:**
- [x] History list page with search/filter
- [x] Test plan detail view (modal preview)
- [x] Download action
- [x] Delete action with confirmation

**Component Created:**
- `src/pages/History.tsx` - Full history management UI

### Phase 10: Testing & Polish
**Goal:** Verify functionality and fix issues

**Checklist:**
- [ ] Test JIRA connection flow
- [ ] Test LLM providers (both)
- [ ] Test template upload
- [ ] Test generation flow end-to-end
- [ ] Add keyboard shortcuts
- [ ] Responsive testing
- [ ] Error handling verification

### Phase 11: Documentation
**Goal:** Setup and usage docs

**Checklist:**
- [ ] README with setup instructions
- [ ] API documentation
- [ ] Environment setup guide
- [ ] Ollama setup guide

---

## Blueprint Approval

**Status:** ⏳ PENDING USER REVIEW

**What I'm proposing:**

1. **Backend: Node.js + Express** (instead of Python/FastAPI)
   - Reason: Unified JS/TS stack, better PDF libs, native streaming

2. **Incremental Delivery:** 11 phases, each building on previous
   - Each phase can be tested independently
   - Allows feedback at each stage

3. **Security:** OS keychain via keytar for API keys
   - Industry standard approach
   - No keys in localStorage or env files after initial load

4. **Next Action (upon approval):** Phase 1 - Project Setup
   - Create all directory structure
   - Initialize both frontend and backend
   - Install all dependencies
   - Setup configuration files

---

## File Structure (Target)

```
/intelligent-test-plan-generator
├── /backend
│   ├── /src
│   │   ├── /config           # Configuration management
│   │   ├── /database         # SQLite schema, migrations
│   │   ├── /middleware       # Error handling, validation
│   │   ├── /routes           # API routes
│   │   │   ├── settings.ts
│   │   │   ├── jira.ts
│   │   │   ├── templates.ts
│   │   │   └── testplan.ts
│   │   ├── /services         # Business logic
│   │   │   ├── jira-client.ts
│   │   │   ├── llm/
│   │   │   │   ├── index.ts
│   │   │   │   ├── groq-provider.ts
│   │   │   │   └── ollama-provider.ts
│   │   │   ├── pdf-parser.ts
│   │   │   └── encryption.ts
│   │   ├── /types            # TypeScript types
│   │   ├── /utils            # Helpers
│   │   └── index.ts          # Entry point
│   ├── /templates            # Default PDF templates
│   ├── package.json
│   └── tsconfig.json
├── /frontend
│   ├── /src
│   │   ├── /components
│   │   │   ├── /ui           # shadcn/ui components
│   │   │   ├── /forms        # Settings forms
│   │   │   ├── /jira-display # Ticket display components
│   │   │   └── /layout       # Layout components
│   │   ├── /pages
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Settings.tsx
│   │   │   └── History.tsx
│   │   ├── /hooks            # Custom React hooks
│   │   ├── /services         # API clients
│   │   ├── /types            # TypeScript types
│   │   ├── /lib              # Utils
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   ├── tsconfig.json
│   └── tailwind.config.js
├── .env.example
└── README.md
```

---

*Last Updated: 2026-02-14*
