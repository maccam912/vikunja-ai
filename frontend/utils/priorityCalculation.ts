import { Task, TaskRelationKind } from "../types";

/**
 * Calculate a custom priority score for a task based on multiple factors:
 * - Vikunja priority (1-5)
 * - Due date urgency
 * - Task dependencies (blocked tasks have lower priority, blocking tasks inherit blocked task priorities)
 */

const TASKWARRIOR_WEIGHTS = {
  // Taskwarrior urgency weights approximations
  PRIORITY_LEVELS: [0, 1, 3.9, 5.9, 7, 8], // Map Vikunja 0-5 priority to Taskwarrior urgency
  DUE_RANGE_DAYS: 14, // Window where due dates start to matter
  DUE_MAX: 12, // Max urgency contribution for due/overdue tasks
  BLOCKING_BONUS: 8, // Bonus for tasks blocking others
  BLOCKING_INHERITANCE: 0.2, // Portion of blocked tasks' urgency that flows upward
  BLOCKED_PENALTY: -5, // Penalty when a task is blocked
  START_DATE_PAST_BONUS: 1.5, // Bonus if start date has passed
  START_DATE_FUTURE_PENALTY: -3, // Penalty if start date is in the future
  AGE_DECAY_DAYS: 45, // Age urgency tapers off after ~1.5 months
  AGE_MAX: 2, // Cap age to modest urgency bump
};

function getPriorityScore(priority: number): number {
  const index = Math.max(0, Math.min(priority, TASKWARRIOR_WEIGHTS.PRIORITY_LEVELS.length - 1));
  return TASKWARRIOR_WEIGHTS.PRIORITY_LEVELS[index];
}

/**
 * Evaluate due date presence + urgency
 */
function evaluateDueDate(
  dueDate?: string,
): { score: number; hasDueDate: boolean } {
  if (!dueDate) return { score: 0, hasDueDate: false };

  const now = new Date();
  const due = new Date(dueDate);
  const isValid = !Number.isNaN(due.getTime());

  // If the API served an unparsable date, treat it as missing
  if (!isValid) return { score: 0, hasDueDate: false };

  const diffMs = due.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays <= 0) {
    return { score: TASKWARRIOR_WEIGHTS.DUE_MAX, hasDueDate: true };
  }

  if (diffDays <= TASKWARRIOR_WEIGHTS.DUE_RANGE_DAYS) {
    const ratio = 1 - (diffDays / TASKWARRIOR_WEIGHTS.DUE_RANGE_DAYS);
    return { score: ratio * TASKWARRIOR_WEIGHTS.DUE_MAX, hasDueDate: true };
  }

  return { score: 0, hasDueDate: true };
}

/**
 * Start date modifier
 * - Future start dates lower the score compared to no start date
 * - Past start dates raise the score compared to no start date
 */
function getStartDateScore(startDate?: string): number {
  if (!startDate) return 0;

  const now = new Date();
  const start = new Date(startDate);

  if (Number.isNaN(start.getTime())) return 0;

  if (start.getTime() > now.getTime()) {
    return TASKWARRIOR_WEIGHTS.START_DATE_FUTURE_PENALTY;
  }

  return TASKWARRIOR_WEIGHTS.START_DATE_PAST_BONUS;
}

function getAgeScore(updated?: string): number {
  if (!updated) return 0;

  const updatedDate = new Date(updated);
  if (Number.isNaN(updatedDate.getTime())) return 0;

  const now = new Date();
  const diffDays = (now.getTime() - updatedDate.getTime()) /
    (1000 * 60 * 60 * 24);

  if (diffDays <= 0) return 0;

  const normalizedAge = Math.min(1, diffDays / TASKWARRIOR_WEIGHTS.AGE_DECAY_DAYS);

  return normalizedAge * TASKWARRIOR_WEIGHTS.AGE_MAX;
}

/**
 * Get tasks that block this task
 */
export function getBlockingTasks(task: Task, allTasks: Task[]): Task[] {
  if (!task.relatedTasks || task.relatedTasks.length === 0) return [];

  const blockingTaskIds = task.relatedTasks
    .filter(
      (relation) =>
        relation.relation_kind === TaskRelationKind.BLOCKED ||
        relation.relation_kind === "blocked",
    )
    .map((relation) => relation.other_task_id);

  return allTasks.filter((t) => blockingTaskIds.includes(t.id));
}

/**
 * Get tasks that this task blocks
 */
export function getBlockedTasks(task: Task, allTasks: Task[]): Task[] {
  if (!task.relatedTasks || task.relatedTasks.length === 0) return [];

  const blockedTaskIds = task.relatedTasks
    .filter(
      (relation) =>
        relation.relation_kind === TaskRelationKind.BLOCKING ||
        relation.relation_kind === "blocking",
    )
    .map((relation) => relation.other_task_id);

  return allTasks.filter((t) => blockedTaskIds.includes(t.id));
}

/**
 * Check if a task is blocked by incomplete tasks
 */
export function isTaskBlocked(task: Task, allTasks: Task[]): boolean {
  if (!task.relatedTasks || task.relatedTasks.length === 0) return false;

  // Get the tasks that block this task
  const blockingTasks = getBlockingTasks(task, allTasks);

  // Only consider the task blocked if at least one blocking task is incomplete
  return blockingTasks.some((blockingTask) => !blockingTask.completed);
}

/**
 * Calculate priority for a single task (recursive helper)
 */
function calculateTaskPriority(
  task: Task,
  allTasks: Task[],
  visited: Set<number>,
): number {
  // Avoid infinite loops in case of circular dependencies
  if (visited.has(task.id)) {
    return 0;
  }
  visited.add(task.id);

  // Skip completed tasks
  if (task.completed) {
    return 0;
  }

  const baseScore = getPriorityScore(task.priority);
  const { score: dueDateScore } = evaluateDueDate(task.dueDate);
  const startDateScore = getStartDateScore(task.startDate);
  const ageScore = getAgeScore(task.updated);

  const blocked = isTaskBlocked(task, allTasks);

  const blockedTasks = getBlockedTasks(task, allTasks).filter(
    (t) => !t.completed,
  );

  let blockingBonus = 0;
  if (blockedTasks.length > 0) {
    blockingBonus += TASKWARRIOR_WEIGHTS.BLOCKING_BONUS;
  }

  for (const blockedTask of blockedTasks) {
    const blockedPriority = calculateTaskPriority(
      blockedTask,
      allTasks,
      new Set(visited),
    );
    blockingBonus += blockedPriority * TASKWARRIOR_WEIGHTS.BLOCKING_INHERITANCE;
  }

  const totalBeforeBlocked =
    baseScore + dueDateScore + startDateScore + ageScore + blockingBonus;

  return blocked
    ? totalBeforeBlocked + TASKWARRIOR_WEIGHTS.BLOCKED_PENALTY
    : totalBeforeBlocked;
}

/**
 * Breakdown of priority components for transparency
 */
export interface PriorityBreakdown {
  baseScore: number;
  dueDateScore: number;
  hasDueDate: boolean;
  startDateScore: number;
  ageScore: number;
  blockingBonus: number;
  isBlocked: boolean;
  totalBeforeBlocked: number;
  finalScore: number;
}

/**
 * Calculate priority breakdown for a single task
 */
export function calculatePriorityBreakdown(
  task: Task,
  allTasks: Task[],
): PriorityBreakdown {
  // Skip completed tasks
  if (task.completed) {
    return {
      baseScore: 0,
      dueDateScore: 0,
      hasDueDate: false,
      startDateScore: 0,
      blockingBonus: 0,
      isBlocked: false,
      totalBeforeBlocked: 0,
      finalScore: 0,
    };
  }

  // Base priority from Vikunja (0-5 scale)
  const baseScore = getPriorityScore(task.priority);

  // Add due date urgency
  const { score: dueDateScore, hasDueDate } = evaluateDueDate(task.dueDate);

  // Start date adjustment
  const startDateScore = getStartDateScore(task.startDate);

  const ageScore = getAgeScore(task.updated);

  // Check if this task is blocked by incomplete tasks
  const isBlocked = isTaskBlocked(task, allTasks);

  const blockedTasks = getBlockedTasks(task, allTasks).filter(
    (t) => !t.completed,
  );

  let blockingBonus = 0;
  if (blockedTasks.length > 0) {
    blockingBonus += TASKWARRIOR_WEIGHTS.BLOCKING_BONUS;
  }

  for (const blockedTask of blockedTasks) {
    const blockedPriority = calculateTaskPriority(
      blockedTask,
      allTasks,
      new Set<number>([task.id]),
    );
    blockingBonus += blockedPriority * TASKWARRIOR_WEIGHTS.BLOCKING_INHERITANCE;
  }

  const totalBeforeBlocked = baseScore + dueDateScore + startDateScore +
    ageScore + blockingBonus;
  const finalScore = isBlocked
    ? totalBeforeBlocked + TASKWARRIOR_WEIGHTS.BLOCKED_PENALTY
    : totalBeforeBlocked;

  return {
    baseScore,
    dueDateScore,
    hasDueDate,
    startDateScore,
    ageScore,
    blockingBonus,
    isBlocked,
    totalBeforeBlocked,
    finalScore,
  };
}

/**
 * Calculate custom priority scores for all tasks
 */
export function calculatePriorities(tasks: Task[]): Task[] {
  // Calculate priority for each task
  return tasks.map((task) => {
    const calculatedPriority = calculateTaskPriority(
      task,
      tasks,
      new Set<number>(),
    );

    return {
      ...task,
      calculatedPriority,
    };
  });
}

/**
 * Get the highest priority incomplete task
 */
export function getTopPriorityTask(tasks: Task[]): Task | null {
  const incompleteTasks = tasks.filter((t) => !t.completed);

  if (incompleteTasks.length === 0) return null;

  return incompleteTasks.reduce((top, current) => {
    const topPriority = top.calculatedPriority ?? 0;
    const currentPriority = current.calculatedPriority ?? 0;
    return currentPriority > topPriority ? current : top;
  });
}

/**
 * Sort tasks by calculated priority (highest first)
 */
export function sortByPriority(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    // Completed tasks go to the bottom
    if (a.completed !== b.completed) {
      return a.completed ? 1 : -1;
    }

    // Sort by calculated priority
    const aPriority = a.calculatedPriority ?? 0;
    const bPriority = b.calculatedPriority ?? 0;

    if (aPriority !== bPriority) {
      return bPriority - aPriority; // Higher priority first
    }

    // Fallback to ID for stable sort
    return b.id - a.id;
  });
}
