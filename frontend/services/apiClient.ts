import type { Task } from "../types";

const API_BASE_URL = import.meta.env.VITE_API_URL || "";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  projectId: number;
  vikunjaUrl: string;
  vikunjaToken: string;
}

export interface ChatResponse {
  message: string;
  toolCalls?: Array<{
    tool: string;
    args: Record<string, unknown>;
    result: unknown;
  }>;
}

/**
 * Send a chat message to the backend AI assistant
 */
export async function sendChatMessage(
  request: ChatRequest,
): Promise<ChatResponse> {
  const response = await fetch(`${API_BASE_URL}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Chat API error: ${error}`);
  }

  return response.json();
}

/**
 * Fetch tasks for a project via backend
 */
export async function getTasks(
  vikunjaUrl: string,
  vikunjaToken: string,
  projectId: number,
): Promise<Task[]> {
  const response = await fetch(`${API_BASE_URL}/api/tasks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ vikunjaUrl, vikunjaToken, projectId }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to fetch tasks: ${error}`);
  }

  return response.json();
}

/**
 * Update a single task
 */
export async function updateTask(
  vikunjaUrl: string,
  vikunjaToken: string,
  taskId: number,
  updates: Record<string, unknown>,
): Promise<Task> {
  const response = await fetch(`${API_BASE_URL}/api/tasks/${taskId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ vikunjaUrl, vikunjaToken, updates }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to update task: ${error}`);
  }

  return response.json();
}

/**
 * Test connection to backend
 */
export async function testConnection(): Promise<
  { status: string; version?: string }
> {
  const response = await fetch(`${API_BASE_URL}/api/health`);

  if (!response.ok) {
    throw new Error("Backend connection failed");
  }

  return response.json();
}
