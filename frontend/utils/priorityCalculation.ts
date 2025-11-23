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
  DUE_DATE_FUTURE: 30, // Additional points for tasks due in the future (more than 7 days)
  DUE_DATE_OVERDUE: 500, // Additional points for overdue tasks
  START_DATE_FUTURE_PENALTY: 0.1, // Multiplier for tasks starting in future
  START_DATE_PAST_BONUS: 50, // Bonus for tasks that have already started
  BLOCKED_PENALTY: 0.01, // Multiplier for blocked tasks (nearly zero priority)
};

/**
 * Get the due date urgency score
 */
function getDueDateScore(dueDate?: string): number {
  if (!dueDate) return 0;

  const now = new Date();
  const due = new Date(dueDate);
  const diffMs = due.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays < 0) {
    // Overdue
    return PRIORITY_WEIGHTS.DUE_DATE_OVERDUE;
  } else if (diffDays < 1) {
    // Due within 24 hours
    return PRIORITY_WEIGHTS.DUE_DATE_URGENT;
  } else if (diffDays < 3) {
    // Due within 3 days
    return PRIORITY_WEIGHTS.DUE_DATE_SOON;
  } else if (diffDays < 7) {
    // Due within a week
    return PRIORITY_WEIGHTS.DUE_DATE_THIS_WEEK;
  }

  // Due in future (more than 7 days)
  return PRIORITY_WEIGHTS.DUE_DATE_FUTURE;
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
  score += getDueDateScore(task.dueDate);

  // Handle start dates
  if (task.startDate) {
    const startDate = new Date(task.startDate);
    const now = new Date();
    if (startDate > now) {
      // Future start date - penalize heavily
      score *= PRIORITY_WEIGHTS.START_DATE_FUTURE_PENALTY;
    } else {
      // Past start date - small bonus
      score += PRIORITY_WEIGHTS.START_DATE_PAST_BONUS;
    }
  }

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
  startDateModifier: number;
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
      startDateModifier: 0,
      blockingBonus: 0,
      isBlocked: false,
      totalBeforeBlocked: 0,
      finalScore: 0,
    };
  }

  // Base priority from Vikunja (0-5 scale)
  const baseScore = task.priority * PRIORITY_WEIGHTS.BASE_PRIORITY;

  // Add due date urgency
  const dueDateScore = getDueDateScore(task.dueDate);

  // Calculate start date modifier
  let startDateModifier = 0;
  let scoreSoFar = baseScore + dueDateScore;

  if (task.startDate) {
    const startDate = new Date(task.startDate);
    const now = new Date();
    if (startDate > now) {
      // Future start date - penalize heavily
      const penalizedScore = scoreSoFar * PRIORITY_WEIGHTS.START_DATE_FUTURE_PENALTY;
      startDateModifier = penalizedScore - scoreSoFar;
      scoreSoFar = penalizedScore;
    } else {
      // Past start date - small bonus
      startDateModifier = PRIORITY_WEIGHTS.START_DATE_PAST_BONUS;
      scoreSoFar += startDateModifier;
    }
  }

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

  const totalBeforeBlocked = scoreSoFar + blockingBonus;
  const finalScore = isBlocked
    ? totalBeforeBlocked * PRIORITY_WEIGHTS.BLOCKED_PENALTY
    : totalBeforeBlocked;

  return {
    baseScore,
    dueDateScore,
    startDateModifier,
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
