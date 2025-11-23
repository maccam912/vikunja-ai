import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "hono/deno";
import { VikunjaMCPClient } from "./mcpClient.ts";
import type { ChatMessage } from "./openrouterClient.ts";
import { OpenRouterClient } from "./openrouterClient.ts";
import { VikunjaClient, type VikunjaTask } from "./vikunjaClient.ts";
import { initializePhoenix } from "./phoenix.ts";

const app = new Hono();

// Environment variables
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") || "";
const OPENROUTER_MODEL = Deno.env.get("OPENROUTER_MODEL") ||
  "anthropic/claude-3.5-sonnet";
const PORT = parseInt(Deno.env.get("PORT") || "8000", 10);
const PHOENIX_ENDPOINT = Deno.env.get("PHOENIX_ENDPOINT") ||
  "https://phoenix.rackspace.koski.co";
const PHOENIX_API_KEY = Deno.env.get("PHOENIX_API_KEY");

interface ChatRequestBody {
  messages: ChatMessage[];
  projectId: number;
  vikunjaUrl: string;
  vikunjaToken: string;
  sessionId?: string;
  userTimezone?: string; // Optional user timezone (e.g., "America/New_York")
}

interface TasksRequestBody {
  vikunjaUrl: string;
  vikunjaToken: string;
  projectId: number;
}

interface UpdateTaskRequestBody {
  vikunjaUrl: string;
  vikunjaToken: string;
  updates: Partial<VikunjaTask>;
}

// Initialize Phoenix tracing
try {
  initializePhoenix(PHOENIX_ENDPOINT, PHOENIX_API_KEY);
} catch (error) {
  console.error(
    "[Phoenix] Failed to initialize, continuing without tracing:",
    error,
  );
}

// Middleware
app.use("/*", cors());

// Simple health check - just returns 200
app.get("/health", (c) => {
  return c.text("OK", 200);
});

// Detailed health check endpoint
app.get("/api/health", (c) => {
  return c.json({
    status: "ok",
    version: "1.0.0",
    model: OPENROUTER_MODEL,
  });
});

// Chat endpoint - Handle AI conversations with tool calling
app.post("/api/chat", async (c) => {
  try {
    const body = await c.req.json() as ChatRequestBody;
    const {
      messages,
      projectId,
      vikunjaUrl,
      vikunjaToken,
      sessionId,
      userTimezone,
    } = body;

    if (!messages || !projectId || !vikunjaUrl || !vikunjaToken) {
      return c.json({ error: "Missing required fields" }, 400);
    }

    if (!OPENROUTER_API_KEY) {
      return c.json({ error: "OPENROUTER_API_KEY not configured" }, 500);
    }

    // Generate session ID if not provided
    const chatSessionId = sessionId || crypto.randomUUID();

    console.log(
      `[API] Chat request received for project ${projectId}, session: ${chatSessionId}`,
    );

    // Initialize MCP client - this is what MCP is for!
    const mcpClient = new VikunjaMCPClient(vikunjaUrl, vikunjaToken);
    await mcpClient.connect();

    // Get tools from MCP server - let it define what's available
    const tools = mcpClient.getOpenAIFunctions();
    console.log(`[API] MCP tools available: ${tools.length}`);

    // Initialize OpenRouter client
    const openRouterClient = new OpenRouterClient(
      OPENROUTER_API_KEY,
      OPENROUTER_MODEL,
    );

    // System prompt with temporal context
    const now = new Date();
    const timezone = userTimezone ||
      Intl.DateTimeFormat().resolvedOptions().timeZone;

    const dateOptions: Intl.DateTimeFormatOptions = {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: timezone,
    };
    const timeOptions: Intl.DateTimeFormatOptions = {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZoneName: "short",
      timeZone: timezone,
    };

    const formattedDate = now.toLocaleDateString("en-US", dateOptions);
    const formattedTime = now.toLocaleTimeString("en-US", timeOptions);
    const isoDateTime = now.toISOString();

    const systemPrompt = `You are a helpful Vikunja Task Manager assistant.
You are connected to the user's Vikunja instance (Project ID: ${projectId}).

## Current Date and Time Context
- Current Date and Time: ${formattedDate} at ${formattedTime}
- ISO Format: ${isoDateTime}
- User Timezone: ${timezone}

When users mention relative dates like "tomorrow", "next week", "in 3 days", etc.,
calculate the actual date based on the current date and time above.

## CRITICAL: Date Format Requirements for Vikunja

Vikunja's backend (written in Go) requires RFC3339 format with timezone information.
ALL dates MUST include a timezone suffix - never send bare datetime strings.

**REQUIRED FORMAT**: YYYY-MM-DDTHH:MM:SS + timezone suffix

**Correct formats:**
- "2025-12-07T09:00:00Z" (UTC time)
- "2025-12-07T09:00:00-06:00" (Central Time with offset)
- "2025-12-07T09:00:00+01:00" (CET with offset)

**WRONG - Will cause errors:**
- "2025-12-07T09:00:00" (missing timezone - DO NOT USE)
- "2025-12-07" (missing time and timezone)

**Implementation:**
- For due_date, start_date, end_date, and any date fields in Vikunja tasks
- When creating or updating tasks, append "Z" for UTC times
- Or append the timezone offset (e.g., "-06:00" for Central Time USA)
- Use JavaScript's toISOString() method which automatically includes "Z"

**Example:**
- User says: "Set due date to December 7th at 9 AM"
- You send: { "due_date": "2025-12-07T09:00:00-06:00" } (for Central Time)
- OR: { "due_date": "2025-12-07T15:00:00Z" } (converted to UTC)

You have access to Vikunja MCP tools. When using vikunja_tasks:
- Always include the "subcommand" parameter (e.g., "list", "create", "update", "delete")
- For listing tasks, use: { subcommand: "list", projectId: ${projectId} }
- For creating tasks, use: { subcommand: "create", projectId: ${projectId}, title: "...", ...otherFields }
- For updating tasks, use: { subcommand: "update", id: taskId, ...fieldsToUpdate }

Be helpful, use the tools to accomplish the user's requests, and confirm when actions complete.`;

    // Execute chat with tool calling - LLM calls MCP tools
    const result = await openRouterClient.chatWithTools(
      messages,
      tools,
      async (name: string, args: Record<string, unknown>) => {
        // Let MCP handle the tool execution
        console.log(`[API] LLM calling MCP tool: ${name}`, args);
        const mcpResult = await mcpClient.executeTool(name, args);

        // MCP returns { content: [{ type: "text", text: "..." }], isError: bool }
        // Extract the actual result for the LLM
        const mcpResponse = mcpResult as {
          isError?: boolean;
          content?: Array<{ text?: string }>;
        };

        if (mcpResponse.isError) {
          const errorText = mcpResponse.content?.[0]?.text || "Unknown error";
          throw new Error(errorText);
        }

        const resultText = mcpResponse.content?.[0]?.text || "{}";

        // Try to parse as JSON, otherwise return as-is
        try {
          return JSON.parse(resultText);
        } catch {
          return { result: resultText };
        }
      },
      systemPrompt,
      10, // Max 10 steps
      chatSessionId, // Pass session ID for Phoenix tracing
    );

    // Disconnect MCP client
    await mcpClient.disconnect();

    return c.json({
      message: result.finalMessage,
      toolCalls: result.allToolCalls,
      sessionId: chatSessionId, // Return session ID to frontend
    });
  } catch (error) {
    console.error("[API] Chat error:", error);
    return c.json(
      { error: `Failed to process chat: ${(error as Error).message}` },
      500,
    );
  }
});

// Tasks endpoint - Fetch tasks directly from Vikunja
app.post("/api/tasks", async (c) => {
  try {
    const body = await c.req.json() as TasksRequestBody;
    const { vikunjaUrl, vikunjaToken, projectId } = body;

    if (!vikunjaUrl || !vikunjaToken || !projectId) {
      return c.json({ error: "Missing required fields" }, 400);
    }

    console.log(`[API] Fetching tasks for project ${projectId}`);

    // Use direct Vikunja API client
    const vikunjaClient = new VikunjaClient(vikunjaUrl, vikunjaToken);
    const tasks = await vikunjaClient.listTasks(projectId);

    return c.json(tasks);
  } catch (error) {
    console.error("[API] Tasks error:", error);
    return c.json(
      { error: `Failed to fetch tasks: ${(error as Error).message}` },
      500,
    );
  }
});

// Update a single task
app.post("/api/tasks/:taskId", async (c) => {
  try {
    const body = await c.req.json() as UpdateTaskRequestBody;
    const { vikunjaUrl, vikunjaToken, updates } = body;
    const taskId = Number(c.req.param("taskId"));

    if (!vikunjaUrl || !vikunjaToken || !taskId || !updates) {
      return c.json({ error: "Missing required fields" }, 400);
    }

    console.log(`[API] Updating task ${taskId}`);

    const vikunjaClient = new VikunjaClient(vikunjaUrl, vikunjaToken);
    const updated = await vikunjaClient.updateTask(taskId, updates);

    return c.json(updated);
  } catch (error) {
    console.error("[API] Task update error:", error);
    return c.json(
      { error: `Failed to update task: ${(error as Error).message}` },
      500,
    );
  }
});

// Serve frontend static files
app.use("/*", serveStatic({ root: "../frontend/dist" }));

// Fallback to index.html for SPA routing
app.get("/*", serveStatic({ path: "../frontend/dist/index.html" }));

console.log(`🚀 Server starting on http://localhost:${PORT}`);
console.log(`📦 Model: ${OPENROUTER_MODEL}`);
console.log(
  `🔧 OpenRouter API Key: ${OPENROUTER_API_KEY ? "✓ Configured" : "✗ Missing"}`,
);
console.log(`📊 Phoenix Tracing: ${PHOENIX_ENDPOINT}`);

Deno.serve({ port: PORT }, app.fetch);
