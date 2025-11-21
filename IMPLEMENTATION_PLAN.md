Implementation Plan - Vikunja AI Agent The goal is to containerize the
application, set up CI/CD, and refactor the architecture to serve a React
frontend from a Deno Hono backend, where the backend acts as an AI agent using
an MCP server to interact with Vikunja.

User Review Required IMPORTANT

The frontend logic will be significantly refactored. The current client-side
Gemini integration will be moved to the Deno backend. The frontend will become a
thin client for the chat and task display.

WARNING

The vikunja-ai-agent directory will be moved to frontend and the original
directory will be deleted as requested.

Proposed Changes Project Structure Move vikunja-ai-agent to frontend/. Create
Dockerfile in root. Create .github/workflows/. CI/CD [NEW]
.github/workflows/ci.yml Triggers on push/pull_request. Jobs: lint: Runs deno
lint and npm run lint (frontend). format: Runs deno fmt --check. test: Runs deno
test. [NEW] .github/workflows/deploy.yml Triggers on push to main. Jobs:
build-and-push: Builds Docker image and pushes to
ghcr.io/maccam912/vikunja-ai:latest. Docker [NEW] Dockerfile Stage 1: Build
Frontend (Node.js image). Stage 2: Run Deno App (Deno image). Copies built
frontend assets to Deno app. Exposes port 8000. Backend (Deno) [MODIFY] main.ts
Serve static files from dist/ (frontend build). Implement /api/chat endpoint.
Integrate with Vikunja MCP server. Spawn npx @democratize-technology/vikunja-mcp
(or similar). Use MCP SDK to communicate. Forward tool calls from Gemini to MCP.
[NEW] src/mcp.ts Logic to connect to MCP server. Frontend [MODIFY]
frontend/App.tsx Remove client-side Gemini code. Update handleSendMessage to
call /api/chat. Update task fetching to use /api/tasks (proxied to Vikunja via
backend or MCP). Verification Plan Automated Tests Run deno test to verify
backend logic. Run npm run build in frontend to verify build. Run docker build .
to verify containerization. Manual Verification Deploy to local Docker and check
if UI loads. Test chat functionality to ensure it connects to Vikunja via MCP.
