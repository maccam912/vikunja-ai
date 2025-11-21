import { FunctionDeclaration, Type } from "@google/genai";

export const tools: FunctionDeclaration[] = [
  {
    name: "addTask",
    description:
      "Add a new task to the list. Returns the created task object with ID.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: "The title of the task" },
        description: {
          type: Type.STRING,
          description: "Detailed description of the task",
        },
        priority: {
          type: Type.NUMBER,
          description: "Priority level: 1 (Low) to 4 (Urgent)",
        },
        dueDate: {
          type: Type.STRING,
          description: "Due date in YYYY-MM-DD format",
        },
        assignee: {
          type: Type.STRING,
          description: "Name of the person assigned to this task",
        },
        tags: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "List of tags associated with the task",
        },
      },
      required: ["title"],
    },
  },
  {
    name: "updateTask",
    description: "Update an existing task's details.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        id: {
          type: Type.NUMBER,
          description: "The numeric ID of the task to update",
        },
        title: { type: Type.STRING },
        description: { type: Type.STRING },
        priority: { type: Type.NUMBER },
        completed: { type: Type.BOOLEAN },
        assignee: { type: Type.STRING },
        dueDate: {
          type: Type.STRING,
          description: "YYYY-MM-DD or empty string to clear",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "deleteTask",
    description: "Permanently remove a task.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        id: {
          type: Type.NUMBER,
          description: "The numeric ID of the task to delete",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "addTaskRelation",
    description:
      "Set a dependency between two tasks (e.g. Task A depends on Task B).",
    parameters: {
      type: Type.OBJECT,
      properties: {
        taskId: {
          type: Type.NUMBER,
          description: "The ID of the task that HAS the dependency (the child)",
        },
        otherTaskId: {
          type: Type.NUMBER,
          description:
            "The ID of the task that IS the dependency (the parent/blocker)",
        },
        relationKind: {
          type: Type.STRING,
          description: "Type of relation. Defaults to 'depends_on' if unsure.",
          enum: ["depends_on", "subtask", "parent", "related", "blocks"],
        },
      },
      required: ["taskId", "otherTaskId"],
    },
  },
  {
    name: "listTasks",
    description: "Get the current list of tasks to analyze or summarize.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        filter: {
          type: Type.STRING,
          description: "Optional keyword to filter tasks",
        },
      },
    },
  },
];
