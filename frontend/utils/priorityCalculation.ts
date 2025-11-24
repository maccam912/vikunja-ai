import { Task, TaskRelationKind } from "../types";

/**
 * Calculate a custom priority score for a task based on multiple factors:
 * - Vikunja priority (1-5)
 * - Due date urgency
 * - Task dependencies (blocked tasks have lower priority, blocking tasks inherit blocked task priorities)
 */

const PRIORITY_WEIGHTS = {
  BASE_PRIORITY: 100, // Weight for Vikunja priority (1-5 becomes 100-500)
  DUE_DATE_URGENT: 300, // Additional points for tasks due within 24 hours
  DUE_DATE_SOON: 150, // Additional points for tasks due within 3 days
  DUE_DATE_THIS_WEEK: 75, // Additional points for tasks due within 7 days
  DUE_DATE_OVERDUE: 500, // Additional points for overdue tasks
  START_DATE_PAST_BONUS: 50, // Additional points if the start date is in the past
  START_DATE_FUTURE_PENALTY: 50, // Penalty if the start date is in the future
  BLOCKED_PENALTY: 0.01, // Multiplier for blocked tasks (nearly zero priority)
};

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

  if (diffDays < 0) {
    // Overdue
    return { score: PRIORITY_WEIGHTS.DUE_DATE_OVERDUE, hasDueDate: true };
  } else if (diffDays < 1) {
    // Due within 24 hours
    return { score: PRIORITY_WEIGHTS.DUE_DATE_URGENT, hasDueDate: true };
  } else if (diffDays < 3) {
    // Due within 3 days
    return { score: PRIORITY_WEIGHTS.DUE_DATE_SOON, hasDueDate: true };
  } else if (diffDays < 7) {
    // Due within a week
    return { score: PRIORITY_WEIGHTS.DUE_DATE_THIS_WEEK, hasDueDate: true };
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
    return -PRIORITY_WEIGHTS.START_DATE_FUTURE_PENALTY;
  }

  return PRIORITY_WEIGHTS.START_DATE_PAST_BONUS;
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

  // Base priority from Vikunja (0-5 scale)
  let score = task.priority * PRIORITY_WEIGHTS.BASE_PRIORITY;

  // Add due date urgency
  score += evaluateDueDate(task.dueDate).score;

  // Start date adjustments
  score += getStartDateScore(task.startDate);

  // Check if this task is blocked by incomplete tasks
  const blocked = isTaskBlocked(task, allTasks);

  if (blocked) {
    // Blocked tasks get very low priority
    score *= PRIORITY_WEIGHTS.BLOCKED_PENALTY;
  } else {
    // If not blocked, add priorities from tasks that this task blocks
    const blockedTasks = getBlockedTasks(task, allTasks);

    for (const blockedTask of blockedTasks) {
      if (!blockedTask.completed) {
        // Add the blocked task's priority to this task
        const blockedPriority = calculateTaskPriority(
          blockedTask,
          allTasks,
          new Set(visited),
        );
        score += blockedPriority * 0.5; // Add 50% of blocked task's priority
      }
    }
  }

  return score;
}

/**
 * Breakdown of priority components for transparency
 */
export interface PriorityBreakdown {
  baseScore: number;
  dueDateScore: number;
  hasDueDate: boolean;
  startDateScore: number;
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
  const baseScore = task.priority * PRIORITY_WEIGHTS.BASE_PRIORITY;

  // Add due date urgency
  const { score: dueDateScore, hasDueDate } = evaluateDueDate(task.dueDate);

  // Start date adjustment
  const startDateScore = getStartDateScore(task.startDate);

  // Check if this task is blocked by incomplete tasks
  const isBlocked = isTaskBlocked(task, allTasks);

  let blockingBonus = 0;
  if (!isBlocked) {
    // If not blocked, add priorities from tasks that this task blocks
    const blockedTasks = getBlockedTasks(task, allTasks);

    for (const blockedTask of blockedTasks) {
      if (!blockedTask.completed) {
        // Add the blocked task's priority to this task
        const blockedPriority = calculateTaskPriority(
          blockedTask,
          allTasks,
          new Set<number>([task.id]),
        );
        blockingBonus += blockedPriority * 0.5; // Add 50% of blocked task's priority
      }
    }
  }

  const totalBeforeBlocked = baseScore + dueDateScore + startDateScore +
    blockingBonus;
  const finalScore = isBlocked
    ? totalBeforeBlocked * PRIORITY_WEIGHTS.BLOCKED_PENALTY
    : totalBeforeBlocked;

  return {
    baseScore,
    dueDateScore,
    hasDueDate,
    startDateScore,
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
