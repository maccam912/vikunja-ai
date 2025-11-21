# Vikunja AI Assistant

An AI-powered task management assistant for Vikunja, built with React, Deno,
Hono, and OpenRouter.

## Architecture

```
Frontend (React + Vite)
    ↓
Backend (Deno + Hono)
    ↓
OpenRouter API (LLM) + MCP Server (Vikunja Tools)
    ↓
Vikunja API
```

### Key Features

- **Modern Full-Stack Architecture**: React frontend with Deno + Hono backend
- **AI Provider Flexibility**: Uses OpenRouter for easy model switching
- **MCP Integration**: Leverages Model Context Protocol for Vikunja operations
- **Tool Calling**: AI can directly interact with Vikunja through function
  calling
- **Mobile Responsive**: Works on desktop and mobile devices

## Prerequisites

- [Deno](https://deno.land/) v2.0+
- [Node.js](https://nodejs.org/) v20+ (for frontend build)
- OpenRouter API key ([get one here](https://openrouter.ai/keys))
- Vikunja instance with API access

## Setup

### 1. Clone and Install

```bash
# Install frontend dependencies
cd frontend
npm install
cd ..
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Required: Get your API key from https://openrouter.ai/keys
OPENROUTER_API_KEY=sk-or-v1-your-api-key-here

# Optional: Change the model (see available models below)
OPENROUTER_MODEL=anthropic/claude-3.5-sonnet

# Optional: Change server port
PORT=8000
```

### 3. Available Models

You can switch models by changing `OPENROUTER_MODEL` in `.env`:

**Recommended:**

- `anthropic/claude-3.5-sonnet` - Best quality, excellent tool calling
- `anthropic/claude-3-haiku` - Fast and cost-effective
- `google/gemini-2.0-flash-exp` - Fast, may have free tier

**Other Options:**

- `openai/gpt-4o` - OpenAI's flagship model
- `meta-llama/llama-3.1-70b-instruct` - Open source option
- See [OpenRouter Models](https://openrouter.ai/models) for full list

### 4. Vikunja Configuration

You'll configure your Vikunja connection in the app's Settings modal:

- **Vikunja URL**: Your instance URL (e.g., `https://vikunja.example.com`)
- **API Token**: Generate from your Vikunja account settings
- **Project**: Select which project to manage

## Development

### Running Locally

**Terminal 1 - Backend:**

```bash
deno task dev
```

This starts the backend on `http://localhost:8000`

**Terminal 2 - Frontend:**

```bash
cd frontend
npm run dev
```

This starts the frontend on `http://localhost:3000`

The frontend proxies API requests to the backend automatically.

### Project Structure

```
vikunja-ai/
├── backend/
│   ├── main.ts              # Hono server with API routes
│   ├── mcpClient.ts         # MCP client for Vikunja integration
│   └── openrouterClient.ts  # OpenRouter API client
├── frontend/
│   ├── src/
│   │   ├── App.tsx          # Main application
│   │   ├── components/      # React components
│   │   │   ├── Chat.tsx     # AI chat interface
│   │   │   ├── TaskCard.tsx # Task display
│   │   │   ├── TaskDetailsModal.tsx
│   │   │   └── SettingsModal.tsx
│   │   ├── services/
│   │   │   └── apiClient.ts # Backend API client
│   │   └── types.ts         # TypeScript types
│   ├── index.html
│   ├── package.json
│   └── vite.config.ts
├── .env                     # Environment variables (create from .env.example)
├── .env.example            # Example environment config
├── deno.json               # Deno configuration
└── README.md
```

## Production Deployment

### 1. Build Frontend

```bash
deno task build:frontend
```

This creates an optimized build in `frontend/dist/`.

### 2. Run Production Server

```bash
deno task start
```

The backend serves both the API and the static frontend files.

### 3. Docker (Optional)

```bash
docker build -t vikunja-ai .
docker run -p 8000:8000 --env-file .env vikunja-ai
```

## Usage

1. **Configure Connection**: Open Settings and enter your Vikunja URL and API
   token
2. **Select Project**: Choose which Vikunja project to manage
3. **Chat with AI**: Use natural language to manage tasks:
   - "Create a task called 'Write documentation'"
   - "Show me all high-priority tasks"
   - "Mark task 123 as complete"
   - "Create task A, then task B that depends on A"

### Example Commands

- **Create Tasks**: "Add a task to review the pull request"
- **Update Tasks**: "Change the priority of task 45 to urgent"
- **Query Tasks**: "What tasks are due this week?"
- **Bulk Operations**: "Mark all completed tasks as archived"
- **Dependencies**: "Make task 10 depend on task 9"

## MCP Server

This project uses the
[Vikunja MCP Server](https://github.com/democratize-technology/vikunja-mcp) to
interact with Vikunja. The MCP server is automatically spawned by the backend
and provides:

- Task management (CRUD operations)
- Project management
- Label/tag operations
- Task relations and dependencies
- Bulk import capabilities

## Troubleshooting

### "MCP connection failed"

- Check Vikunja URL and API token are correct
- Verify Vikunja API is accessible from your machine
- Ensure Deno can access npm packages (should work by default)

### "OpenRouter API failed"

- Verify `OPENROUTER_API_KEY` is set in `.env`
- Check your OpenRouter account has credits
- Try a different model (some models may have rate limits)

### Frontend can't connect to backend

- Ensure backend is running on port 8000
- Check Vite proxy config in `frontend/vite.config.ts`
- Verify CORS is enabled in backend

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## License

MIT

## Credits

Built with:

- [Deno](https://deno.land/) - Modern JavaScript runtime
- [Hono](https://hono.dev/) - Fast web framework
- [React](https://react.dev/) - UI library
- [OpenRouter](https://openrouter.ai/) - Unified LLM API
- [Model Context Protocol](https://modelcontextprotocol.io/) - Tool integration
- [Vikunja MCP Server](https://github.com/democratize-technology/vikunja-mcp) -
  Vikunja integration
