export enum TaskPriority {
  LOW = 1,
  MEDIUM = 2,
  HIGH = 3,
  URGENT = 4,
  DO_IT_NOW = 5,
}

export enum TaskStatus {
  TODO = "todo",
  IN_PROGRESS = "in_progress",
  DONE = "done",
}

export enum TaskRelationKind {
  SUBTASK = "subtask",
  PARENT_TASK = "parenttask",
  RELATED = "related",
  DUPLICATE_OF = "duplicateof",
  DUPLICATES = "duplicates",
  BLOCKING = "blocking",
  BLOCKED = "blocked",
  PRECEDES = "precedes",
  FOLLOWS = "follows",
  COPIED_FROM = "copiedfrom",
  COPIED_TO = "copiedto",
}

export interface TaskRelation {
  id: number;
  task_id: number;
  other_task_id: number;
  relation_kind: TaskRelationKind | string;
  created_by: {
    id: number;
    username: string;
  };
  created: string;
}

export interface Task {
  id: number;
  title: string;
  description: string;
  completed: boolean; // Mapped from 'done'
  priority: TaskPriority;
  dueDate?: string; // ISO string
  startDate?: string; // ISO string
  assignee?: string; // Derived from assignees list for display
  tags: string[]; // Mapped from labels
  identifier?: string; // Vikunja identifier (e.g. "TASK-1")
  updated?: string;
  relatedTasks?: TaskRelation[]; // All task relations
  calculatedPriority?: number; // Custom calculated priority score
  webUrl?: string; // Direct link to the task in Vikunja
}

export interface Message {
  id: string;
  role: "user" | "model";
  text: string;
  isToolOutput?: boolean;
}

export interface VikunjaConfig {
  url: string;
  token: string;
  defaultProjectId: number;
  customInstructions?: string;
}

export interface VikunjaProject {
  id: number;
  title: string;
}

export interface VikunjaUser {
  id: number;
  username: string;
  name: string;
}
