/**
 * Direct Vikunja API client - no MCP nonsense
 */

export interface VikunjaTask {
  id: number;
  title: string;
  description: string;
  done: boolean;
  priority: number;
  due_date?: string;
  created: string;
  updated: string;
}

interface RawVikunjaTask {
  id: number;
  title: string;
  description?: string;
  done?: boolean;
  priority?: number;
  due_date?: string;
  assignees?: Array<{ username?: string }>;
  labels?: Array<{ title?: string } | string>;
  identifier?: string;
}

interface FormattedTask {
  id: number;
  title: string;
  description: string;
  completed: boolean;
  priority: number;
  dueDate?: string;
  assignee?: string;
  tags: string[];
  identifier?: string;
}

export class VikunjaClient {
  constructor(
    private baseUrl: string,
    private apiToken: string,
  ) {
    // Clean URL
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    if (this.baseUrl.endsWith("/api/v1")) {
      this.baseUrl = this.baseUrl.substring(0, this.baseUrl.length - 7);
    }
  }

  private async request(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<unknown> {
    const url = `${this.baseUrl}/api/v1${endpoint}`;

    const mergedHeaders: HeadersInit = {
      "Authorization": `Bearer ${this.apiToken}`,
      "Content-Type": "application/json",
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers: mergedHeaders,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Vikunja API error (${response.status}): ${error}`);
    }

    if (response.status === 204) {
      return null;
    }

    return response.json();
  }

  async listTasks(projectId: number): Promise<FormattedTask[]> {
    const data = await this.request(`/projects/${projectId}/tasks`);
    const tasks = Array.isArray(data)
      ? data as RawVikunjaTask[]
      : ((data as { results?: RawVikunjaTask[] }).results || []);

    // Transform to frontend format
    return tasks.map((task) => ({
      id: task.id,
      title: task.title,
      description: task.description || "",
      completed: task.done || false,
      priority: task.priority || 0,
      dueDate: task.due_date && !task.due_date.startsWith("0001-01-01")
        ? task.due_date
        : undefined,
      assignee: task.assignees?.[0]?.username || undefined,
      tags: (task.labels || []).map((label) =>
        typeof label === "string" ? label : (label.title || String(label))
      ),
      identifier: task.identifier,
    }));
  }

  async createTask(projectId: number, task: {
    title: string;
    description?: string;
    priority?: number;
    due_date?: string;
  }): Promise<VikunjaTask> {
    return await this.request(`/projects/${projectId}/tasks`, {
      // Vikunja expects PUT for creation
      method: "PUT",
      body: JSON.stringify(task),
    }) as VikunjaTask;
  }

  async updateTask(
    taskId: number,
    updates: Partial<VikunjaTask>,
  ): Promise<VikunjaTask> {
    return await this.request(`/tasks/${taskId}`, {
      // Vikunja uses PUT to update an existing task
      method: "PUT",
      body: JSON.stringify(updates),
    }) as VikunjaTask;
  }

  async deleteTask(taskId: number): Promise<void> {
    await this.request(`/tasks/${taskId}`, { method: "DELETE" });
  }

  async getProjects(): Promise<unknown> {
    return await this.request("/projects");
  }
}

/**
 * Get Vikunja tools in OpenAI function calling format
 */
export function getVikunjaTools() {
  return [
    {
      type: "function",
      function: {
        name: "list_tasks",
        description: "List all tasks in a Vikunja project",
        parameters: {
          type: "object",
          properties: {
            projectId: {
              type: "number",
              description: "The project ID to list tasks from",
            },
          },
          required: ["projectId"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "create_task",
        description: "Create a new task in Vikunja",
        parameters: {
          type: "object",
          properties: {
            projectId: {
              type: "number",
              description: "The project ID to create the task in",
            },
            title: {
              type: "string",
              description: "Task title",
            },
            description: {
              type: "string",
              description: "Task description (optional)",
            },
            priority: {
              type: "number",
              description:
                "Priority: 0=unset, 1=low, 2=medium, 3=high, 4=urgent, 5=do now",
              minimum: 0,
              maximum: 5,
            },
            due_date: {
              type: "string",
              description: "Due date in ISO format (YYYY-MM-DD)",
            },
          },
          required: ["projectId", "title"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "update_task",
        description: "Update an existing task",
        parameters: {
          type: "object",
          properties: {
            taskId: {
              type: "number",
              description: "The task ID to update",
            },
            title: { type: "string" },
            description: { type: "string" },
            done: { type: "boolean" },
            priority: { type: "number", minimum: 0, maximum: 5 },
            due_date: { type: "string" },
          },
          required: ["taskId"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "delete_task",
        description: "Delete a task",
        parameters: {
          type: "object",
          properties: {
            taskId: {
              type: "number",
              description: "The task ID to delete",
            },
          },
          required: ["taskId"],
        },
      },
    },
  ];
}
