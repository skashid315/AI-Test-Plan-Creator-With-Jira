# Intelligent Test Plan Generator

A full-stack web application that automates test plan creation by integrating JIRA ticket data with LLM-powered analysis using customizable PDF templates.

## Features

- 🔗 **JIRA Integration**: Fetch ticket data directly from JIRA API
- 🤖 **Dual LLM Support**: Use Groq (cloud) or Ollama (local) for test plan generation
- 📄 **PDF Templates**: Upload and use custom test plan templates
- 📝 **Markdown Export**: Export generated test plans as Markdown
- 💾 **History**: Save and retrieve past test plans
- 🔒 **Secure**: API keys stored in OS keychain, never in browser

## Tech Stack

- **Frontend**: React + Vite + TypeScript + Tailwind CSS + shadcn/ui
- **Backend**: Node.js + Express + TypeScript
- **Database**: SQLite (better-sqlite3)
- **LLM Providers**: Groq API + Ollama
- **Security**: keytar (OS keychain storage)

## Project Structure

```
.
├── backend/               # Express backend
│   ├── src/
│   │   ├── config/       # Configuration management
│   │   ├── database/     # SQLite schema & migrations
│   │   ├── middleware/   # Express middleware
│   │   ├── routes/       # API routes
│   │   ├── services/     # Business logic
│   │   │   └── llm/      # LLM providers
│   │   ├── types/        # TypeScript types
│   │   └── utils/        # Utilities
│   └── templates/        # Default PDF templates
├── frontend/             # React frontend
│   └── src/
│       ├── components/   # React components
│       ├── pages/        # Page components
│       ├── hooks/        # Custom hooks
│       ├── services/     # API clients
│       └── types/        # TypeScript types
└── .env.example          # Environment template
```

## Setup Instructions

### Prerequisites

- Node.js 18+ 
- npm or yarn
- (Optional) Ollama for local LLM support

### 1. Install Dependencies

```bash
# Backend
cd backend
npm install

# Frontend (in a new terminal)
cd frontend
npm install
```

### 2. Configure Environment Variables

```bash
# Copy environment templates
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Edit the .env files with your credentials
```

Required environment variables:
- `JIRA_BASE_URL` - Your Atlassian domain
- `JIRA_USERNAME` - Your JIRA email
- `JIRA_API_TOKEN` - From https://id.atlassian.com/manage-profile/security/api-tokens
- `GROQ_API_KEY` - From https://console.groq.com (optional if using Ollama)

### 3. Initialize Database

```bash
cd backend
npm run db:init
```

### 4. Start Development Servers

```bash
# Backend (runs on http://localhost:3001)
cd backend
npm run dev

# Frontend (runs on http://localhost:3000)
cd frontend
npm run dev
```

### 5. (Optional) Setup Ollama for Local LLM

```bash
# Install Ollama: https://ollama.com

# Pull a model
ollama pull llama3

# Start Ollama server (runs on http://localhost:11434)
ollama serve
```

## Usage

1. Open http://localhost:3000 in your browser
2. Go to **Settings** and configure:
   - JIRA credentials (test the connection)
   - LLM provider (Groq or Ollama)
   - Upload a test plan template (PDF)
3. Go to **Generate** and:
   - Enter a JIRA ticket ID (e.g., "VWO-123")
   - Fetch the ticket
   - Click "Generate Test Plan"
4. Export the generated test plan as Markdown or copy to clipboard

## Development

### Backend Scripts

```bash
npm run dev       # Start development server with hot reload
npm run build     # Build for production
npm run start     # Start production server
npm run db:init   # Initialize database
npm run lint      # Run ESLint
npm run typecheck # Run TypeScript check
```

### Frontend Scripts

```bash
npm run dev       # Start development server
npm run build     # Build for production
npm run preview   # Preview production build
npm run lint      # Run ESLint
```

## License

MIT
