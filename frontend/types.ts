export enum TaskPriority {
  LOW = 1,
  MEDIUM = 2,
  HIGH = 3,
  URGENT = 4,
  DO_IT_NOW = 5,
}

export enum TaskStatus {
  TODO = 'todo',
  IN_PROGRESS = 'in_progress',
  DONE = 'done',
}

export interface Task {
  id: number;
  title: string;
  description: string;
  completed: boolean; // Mapped from 'done'
  priority: TaskPriority;
  dueDate?: string; // ISO string
  assignee?: string; // Derived from assignees list for display
  tags: string[]; // Mapped from labels
  identifier?: string; // Vikunja identifier (e.g. "TASK-1")
}

export interface Message {
  id: string;
  role: 'user' | 'model';
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