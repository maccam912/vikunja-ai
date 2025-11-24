import { describe, expect, it } from "vitest";

import { Task, TaskPriority, TaskRelationKind } from "../types";
import {
  calculatePriorities,
  calculatePriorityBreakdown,
} from "./priorityCalculation";

function buildRelation(
  taskId: number,
  otherTaskId: number,
  relation: TaskRelationKind,
) {
  return {
    id: taskId,
    task_id: taskId,
    other_task_id: otherTaskId,
    relation_kind: relation,
    created_by: { id: 1, username: "tester" },
    created: new Date().toISOString(),
  };
}

describe("priority calculation", () => {
  it("applies a blocking bonus when a task blocks other active tasks", () => {
    const tasks: Task[] = [
      {
        id: 1,
        title: "Blocker",
        description: "",
        completed: false,
        priority: TaskPriority.MEDIUM,
        tags: [],
        relatedTasks: [
          buildRelation(1, 2, TaskRelationKind.BLOCKING),
        ],
      },
      {
        id: 2,
        title: "Blocked task",
        description: "",
        completed: false,
        priority: TaskPriority.HIGH,
        tags: [],
        relatedTasks: [
          buildRelation(2, 1, TaskRelationKind.BLOCKED),
        ],
      },
    ];

    const [calculatedBlocker] = calculatePriorities(tasks).filter(
      (task) => task.id === 1,
    );

    const breakdown = calculatePriorityBreakdown(calculatedBlocker, tasks);
    const baseScore = breakdown.baseScore + breakdown.dueDateScore +
      breakdown.startDateScore;

    expect(breakdown.blockingBonus).toBeGreaterThan(0);
    expect(calculatedBlocker.calculatedPriority ?? 0).toBeGreaterThan(baseScore);
  });

  it("retains the blocking bonus even if the blocker is itself blocked", () => {
    const tasks: Task[] = [
      {
        id: 1,
        title: "Blocker", // Blocks task 2 but is blocked by task 3
        description: "",
        completed: false,
        priority: TaskPriority.MEDIUM,
        tags: [],
        relatedTasks: [
          buildRelation(1, 2, TaskRelationKind.BLOCKING),
          buildRelation(1, 3, TaskRelationKind.BLOCKED),
        ],
      },
      {
        id: 2,
        title: "Blocked task",
        description: "",
        completed: false,
        priority: TaskPriority.HIGH,
        tags: [],
        relatedTasks: [
          buildRelation(2, 1, TaskRelationKind.BLOCKED),
        ],
      },
      {
        id: 3,
        title: "Upstream blocker",
        description: "",
        completed: false,
        priority: TaskPriority.URGENT,
        tags: [],
        relatedTasks: [
          buildRelation(3, 1, TaskRelationKind.BLOCKING),
        ],
      },
    ];

    const blocker = calculatePriorities(tasks).find((task) => task.id === 1)!;
    const breakdown = calculatePriorityBreakdown(blocker, tasks);

    const scoreWithoutBonus =
      breakdown.baseScore + breakdown.dueDateScore + breakdown.startDateScore +
      breakdown.ageScore + (breakdown.isBlocked ? -5 : 0);

    expect(breakdown.isBlocked).toBe(true);
    expect(breakdown.blockingBonus).toBeGreaterThan(0);
    expect(breakdown.finalScore).toBeGreaterThan(scoreWithoutBonus);
  });

  it("inherits urgency from blocked tasks instead of only adding a flat bonus", () => {
    const now = Date.now();
    const soon = new Date(now + 2 * 24 * 60 * 60 * 1000).toISOString();

    const tasks: Task[] = [
      {
        id: 10,
        title: "Root blocker",
        description: "",
        completed: false,
        priority: TaskPriority.MEDIUM,
        dueDate: soon,
        updated: new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString(),
        tags: [],
        relatedTasks: [
          buildRelation(10, 11, TaskRelationKind.BLOCKING),
        ],
      },
      {
        id: 11,
        title: "High urgency child",
        description: "",
        completed: false,
        priority: TaskPriority.DO_IT_NOW,
        dueDate: new Date(now + 12 * 60 * 60 * 1000).toISOString(),
        tags: [],
        relatedTasks: [
          buildRelation(11, 10, TaskRelationKind.BLOCKED),
        ],
      },
    ];

    const blocker = calculatePriorities(tasks).find((task) => task.id === 10)!;
    const breakdown = calculatePriorityBreakdown(blocker, tasks);

    // The inheritance should contribute more than the fixed blocking bonus alone
    expect(breakdown.blockingBonus).toBeGreaterThan(8);
    expect(breakdown.finalScore).toBeGreaterThan(
      breakdown.baseScore + breakdown.dueDateScore +
      breakdown.startDateScore + breakdown.ageScore,
    );
  });
});
