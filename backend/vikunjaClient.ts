/**
 * Direct Vikunja API client - no MCP nonsense
 */

export interface VikunjaTask {
  id: number;
  title: string;
  description: string;
  done: boolean;
  priority: number;
  due_date?: string | null;
  start_date?: string | null;
  created: string;
  updated: string;
}

interface TaskRelation {
  id: number;
  task_id: number;
  other_task_id: number;
  relation_kind: string;
  created_by: {
    id: number;
    username: string;
  };
  created: string;
}

interface RawVikunjaTask {
  id: number;
  title: string;
  description?: string;
  done?: boolean;
  priority?: number;
  due_date?: string | null;
  start_date?: string | null;
  assignees?: Array<{ username?: string }>;
  labels?: Array<{ title?: string } | string>;
  identifier?: string;
  related_tasks?: { [key: string]: TaskRelation[] };
  relations?: TaskRelation[];
  updated?: string;
}

interface FormattedTask {
  id: number;
  title: string;
  description: string;
  completed: boolean;
  priority: number;
  dueDate?: string | null;
  startDate?: string | null;
  assignee?: string;
  tags: string[];
  identifier?: string;
  updated?: string;
  relatedTasks?: TaskRelation[];
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

  /**
   * Ensures a date string has RFC3339 timezone format required by Vikunja.
   * Appends "Z" (UTC) if timezone is missing.
   * Preserves explicit null values to allow clearing dates.
   */
  private ensureTimezone(
    dateStr: string | null | undefined,
  ): string | null | undefined {
    // Preserve explicit null (used to clear dates)
    if (dateStr === null) return null;

    // Return undefined if not provided
    if (!dateStr) return undefined;

    // Check if already has timezone (ends with Z or +/-HH:MM)
    const hasTimezone = /Z$|[+-]\d{2}:\d{2}$/.test(dateStr);

    if (hasTimezone) {
      return dateStr;
    }

    // Append Z for UTC if missing
    return `${dateStr}Z`;
  }

  private formatTask(task: RawVikunjaTask): FormattedTask {
    const relatedTasks = this.getRelations(task);

    return {
      id: task.id,
      title: task.title,
      description: task.description || "",
      completed: task.done || false,
      priority: task.priority || 1, // Treat unset (0) as low priority (1)
      dueDate: task.due_date && !task.due_date.startsWith("0001-01-01")
        ? task.due_date
        : undefined,
      startDate: task.start_date && !task.start_date.startsWith("0001-01-01")
        ? task.start_date
        : undefined,
      assignee: task.assignees?.[0]?.username || undefined,
      tags: (task.labels || []).map((label) =>
        typeof label === "string" ? label : label.title || String(label)
      ),
      identifier: task.identifier,
      updated: task.updated,
      relatedTasks: relatedTasks.length > 0 ? relatedTasks : undefined,
    };
  }

  private getRelations(task: RawVikunjaTask): TaskRelation[] {
    const relatedTasks: TaskRelation[] = [];

    if (task.related_tasks) {
      for (const relations of Object.values(task.related_tasks)) {
        if (Array.isArray(relations)) {
          relatedTasks.push(...relations);
        }
      }
    }

    if (Array.isArray(task.relations)) {
      relatedTasks.push(...task.relations);
    }

    return relatedTasks;
  }

  private async request(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<unknown> {
    const url = `${this.baseUrl}/api/v1${endpoint}`;

    const mergedHeaders: HeadersInit = {
      Authorization: `Bearer ${this.apiToken}`,
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
      ? (data as RawVikunjaTask[])
      : (data as { results?: RawVikunjaTask[] }).results || [];

    // Transform to frontend format
    const formattedTasks = tasks.map((task) => this.formatTask(task));

    // If the list endpoint did not include relations, fetch them individually
    const tasksWithRelations = await Promise.all(
      formattedTasks.map(async (task) => {
        if (task.relatedTasks && task.relatedTasks.length > 0) {
          return task;
        }

        try {
          const detailedTask = await this.request(`/tasks/${task.id}`) as RawVikunjaTask;
          const relations = this.getRelations(detailedTask);

          if (relations.length === 0) {
            return task;
          }

          return {
            ...task,
            updated: detailedTask.updated || task.updated,
            relatedTasks: relations,
          };
        } catch (error) {
          console.error(
            `[VikunjaClient] Failed to fetch relations for task ${task.id}:`,
            error,
          );
          return task;
        }
      }),
    );

    return tasksWithRelations;
  }

  async createTask(
    projectId: number,
    task: {
      title: string;
      description?: string;
      priority?: number;
      due_date?: string | null;
      start_date?: string | null;
    },
  ): Promise<VikunjaTask> {
    // Ensure due_date has timezone suffix (preserves null for clearing)
    const taskWithTimezone = {
      ...task,
      due_date: this.ensureTimezone(task.due_date),
      start_date: this.ensureTimezone(task.start_date),
    };

    return (await this.request(`/projects/${projectId}/tasks`, {
      method: "POST",
      body: JSON.stringify(taskWithTimezone),
    })) as VikunjaTask;
  }

  async updateTask(
    taskId: number,
    updates: Partial<VikunjaTask>,
  ): Promise<FormattedTask> {
    // Ensure due_date has timezone suffix if present
    const updatesWithTimezone = {
      ...updates,
      due_date: this.ensureTimezone(updates.due_date),
      start_date: this.ensureTimezone(updates.start_date),
    };

    const updated = (await this.request(`/tasks/${taskId}`, {
      method: "POST",
      body: JSON.stringify(updatesWithTimezone),
    })) as RawVikunjaTask;

    return this.formatTask(updated);
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
              description:
                "Due date in RFC3339 format with timezone (e.g., '2025-12-07T09:00:00Z' or '2025-12-07T09:00:00-06:00')",
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
            due_date: {
              type: "string",
              description:
                "Due date in RFC3339 format with timezone (e.g., '2025-12-07T09:00:00Z' or '2025-12-07T09:00:00-06:00')",
            },
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
