import {
  Task,
  TaskRelation,
  VikunjaConfig,
  VikunjaProject,
  VikunjaUser,
} from "../types";

type HeadersMap = Record<string, string>;

interface RawVikunjaTask {
  id: number;
  title: string;
  description?: string;
  done: boolean;
  priority?: number;
  due_date?: string;
  start_date?: string;
  assignees?: Array<{ username?: string; name?: string }>;
  labels?: Array<{ title: string }>;
  identifier?: string;
  related_tasks?: TaskRelation[];
  relations?: TaskRelation[];
}

// Helper to clean URL and ensure it doesn't end with slash or /api/v1
const cleanUrl = (url: string) => {
  if (!url) return "";
  let cleaned = url.trim().replace(/\/+$/, "");
  // Remove /api/v1 if the user accidentally added it, as we append it manually
  if (cleaned.endsWith("/api/v1")) {
    cleaned = cleaned.substring(0, cleaned.length - 7);
  }
  return cleaned.replace(/\/+$/, "");
};

// Generic fetch wrapper with DEBUG logging
async function vikunjaFetch(
  config: VikunjaConfig,
  endpoint: string,
  options: RequestInit = {},
) {
  console.group(`[Vikunja API] Request: ${endpoint}`);

  if (!config.url || !config.token) {
    console.error("Missing Configuration");
    console.groupEnd();
    throw new Error("Missing Vikunja configuration (URL or Token)");
  }

  const baseUrl = cleanUrl(config.url);
  // Ensure endpoint starts with /
  const safeEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const url = `${baseUrl}/api/v1${safeEndpoint}`;

  const token = config.token.trim();

  if (!token) {
    throw new Error("API Token is empty. Please check your settings.");
  }

  console.log("Full URL:", url);
  console.log(
    `Token Info: Length=${token.length}, Prefix=${token.substring(0, 5)}...`,
  );

  const extraHeaders: HeadersMap =
    options.headers && typeof options.headers === "object"
      ? options.headers as HeadersMap
      : {};

  const headers: HeadersMap = {
    "Authorization": `Bearer ${token}`,
    ...extraHeaders,
  };

  // Only add Content-Type for methods that typically have a body.
  // Adding Content-Type to GET requests can cause 400/401 errors on strict servers/CORS proxies.
  if (options.method && options.method !== "GET" && options.method !== "HEAD") {
    headers["Content-Type"] = "application/json";
  }

  try {
    const response = await fetch(url, { ...options, headers });
    console.log("Response Status:", response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text().catch(() =>
        "No error text returned"
      );
      console.error("Error Body:", errorText);

      if (response.status === 401) {
        throw new Error(
          `Authentication Failed (401). Check your API Token. Server said: ${errorText}`,
        );
      }
      if (response.status === 404) {
        throw new Error(
          `Not Found (404). Check your Server URL. Server said: ${errorText}`,
        );
      }

      throw new Error(`Vikunja API Error (${response.status}): ${errorText}`);
    }

    // Handle empty responses (like DELETE)
    if (response.status === 204) {
      console.log("Response: 204 No Content");
      console.groupEnd();
      return null;
    }

    const json = await response.json();
    console.log("Response Data:", json);
    console.groupEnd();
    return json;
  } catch (error) {
    console.error("Network/Fetch Error:", error);
    console.groupEnd();

    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new Error(
        "Network Error: Could not connect to server. This is likely a CORS issue. Ensure your Vikunja server allows requests from this origin, or check your URL.",
      );
    }
    throw error;
  }
}

// -- Mappers --

const mapToLocalTask = (vTask: RawVikunjaTask): Task => {
  // Vikunja often returns "0001-01-01T00:00:00Z" for null dates.
  // We must strictly filter these out.
  let validDueDate: string | undefined = undefined;
  let validStartDate: string | undefined = undefined;

  if (vTask.due_date) {
    const isZeroDate = vTask.due_date.startsWith("0001-01-01") ||
      vTask.due_date.startsWith("1970-01-01");
    if (!isZeroDate) {
      validDueDate = vTask.due_date;
    }
  }

  if (vTask.start_date) {
    const isZeroDate = vTask.start_date.startsWith("0001-01-01") ||
      vTask.start_date.startsWith("1970-01-01");
    if (!isZeroDate) {
      validStartDate = vTask.start_date;
    }
  }

  const relatedTasks: TaskRelation[] | undefined = Array.isArray(
    vTask.related_tasks,
  )
    ? vTask.related_tasks
    : Array.isArray(vTask.relations)
    ? vTask.relations
    : undefined;

  return {
    id: vTask.id,
    title: vTask.title,
    description: vTask.description || "",
    completed: vTask.done,
    priority: vTask.priority || 1,
    dueDate: validDueDate,
    startDate: validStartDate,
    assignee: vTask.assignees?.[0]?.username || vTask.assignees?.[0]?.name,
    tags: (vTask.labels || []).map((l) => l.title),
    identifier: vTask.identifier,
    relatedTasks,
  };
};

// -- API Methods --

export const api = {
  async getProjects(url: string, token: string): Promise<VikunjaProject[]> {
    console.log("Fetching projects...");
    // Depending on version, might be /projects or /lists. Trying standard /projects
    const data = await vikunjaFetch(
      { url, token, defaultProjectId: 0 },
      "/projects",
    );
    // Pagination handling or simple list
    const projects = Array.isArray(data) ? data : (data.results || []);
    console.log(`Found ${projects.length} projects`);
    return projects;
  },

  async getProjectTasks(config: VikunjaConfig): Promise<Task[]> {
    const data = await vikunjaFetch(
      config,
      `/projects/${config.defaultProjectId}/tasks`,
    );
    const tasks = Array.isArray(data) ? data : (data.results || []);
    return tasks.map(mapToLocalTask);
  },

  async getUsers(config: VikunjaConfig): Promise<VikunjaUser[]> {
    // Try to fetch users for assignment mapping
    try {
      const data = await vikunjaFetch(config, `/users`);
      return Array.isArray(data) ? data : (data.results || []);
    } catch (e) {
      console.warn("Could not fetch users, assignment might be limited", e);
      return [];
    }
  },

  async addTask(
    config: VikunjaConfig,
    task: Partial<Task>,
    allUsers: VikunjaUser[] = [],
  ): Promise<Task> {
    const payload: Record<string, unknown> = {
      title: task.title,
      description: task.description,
      priority: task.priority,
      due_date: task.dueDate,
      start_date: task.startDate,
    };

    // Handle Assignment during creation
    if (task.assignee) {
      const user = allUsers.find((u) =>
        u.username.toLowerCase() === task.assignee?.toLowerCase() ||
        u.name.toLowerCase() === task.assignee?.toLowerCase()
      );
      if (user) {
        payload.assignees = [user.id];
      }
    }

    const data = await vikunjaFetch(
      config,
      `/projects/${config.defaultProjectId}/tasks`,
      {
        method: "PUT",
        body: JSON.stringify(payload),
      },
    );
    return mapToLocalTask(data);
  },

  async updateTask(
    config: VikunjaConfig,
    task: Partial<Task> & { id: number },
    allUsers: VikunjaUser[] = [],
  ): Promise<Task> {
    const payload: Record<string, unknown> = {};
    if (task.title !== undefined) payload.title = task.title;
    if (task.description !== undefined) payload.description = task.description;
    if (task.completed !== undefined) payload.done = task.completed;
    if (task.priority !== undefined) payload.priority = task.priority;
    if (task.dueDate !== undefined) payload.due_date = task.dueDate;
    if (task.startDate !== undefined) payload.start_date = task.startDate;

    // Handle Assignment
    if (task.assignee) {
      const user = allUsers.find((u) =>
        u.username.toLowerCase() === task.assignee?.toLowerCase() ||
        u.name.toLowerCase() === task.assignee?.toLowerCase()
      );
      if (user) {
        payload.assignees = [user.id];
      }
    }

    const data = await vikunjaFetch(config, `/tasks/${task.id}`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return mapToLocalTask(data);
  },

  async deleteTask(config: VikunjaConfig, taskId: number): Promise<boolean> {
    await vikunjaFetch(config, `/tasks/${taskId}`, {
      method: "DELETE",
    });
    return true;
  },

  async addTaskRelation(
    config: VikunjaConfig,
    taskId: number,
    otherTaskId: number,
    relationKind: string = "depends_on",
  ): Promise<unknown> {
    const payload = {
      other_task_id: otherTaskId,
      relation_kind: relationKind,
    };
    const data = await vikunjaFetch(config, `/tasks/${taskId}/relations`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    return data;
  },
};
