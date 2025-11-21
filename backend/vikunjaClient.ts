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
  ): Promise<any> {
    const url = `${this.baseUrl}/api/v1${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        "Authorization": `Bearer ${this.apiToken}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
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

  async listTasks(projectId: number): Promise<any[]> {
    const data = await this.request(`/projects/${projectId}/tasks`);
    const tasks = Array.isArray(data) ? data : (data.results || []);

    // Transform to frontend format
    return tasks.map((task: any) => ({
      id: task.id,
      title: task.title,
      description: task.description || "",
      completed: task.done || false,
      priority: task.priority || 0,
      dueDate: task.due_date && !task.due_date.startsWith("0001-01-01")
        ? task.due_date
        : undefined,
      assignee: task.assignees?.[0]?.username || undefined,
      tags: (task.labels || []).map((label: any) => label.title || label),
      identifier: task.identifier,
    }));
  }

  async createTask(projectId: number, task: {
    title: string;
    description?: string;
    priority?: number;
    due_date?: string;
  }): Promise<VikunjaTask> {
    return this.request(`/projects/${projectId}/tasks`, {
      method: "POST",
      body: JSON.stringify(task),
    });
  }

  async updateTask(
    taskId: number,
    updates: Partial<VikunjaTask>,
  ): Promise<VikunjaTask> {
    return this.request(`/tasks/${taskId}`, {
      method: "POST",
      body: JSON.stringify(updates),
    });
  }

  async deleteTask(taskId: number): Promise<void> {
    await this.request(`/tasks/${taskId}`, { method: "DELETE" });
  }

  async getProjects() {
    return this.request("/projects");
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
