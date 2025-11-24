
import { describe, it, expect } from 'vitest';
import { calculatePriorityBreakdown } from './priorityCalculation';
import { Task, TaskPriority } from '../types';

// Helper to create a basic task
function createTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 1,
    title: 'Test Task',
    description: '',
    completed: false,
    priority: TaskPriority.MEDIUM,
    tags: [],
    ...overrides,
  };
}

describe('Priority Calculation', () => {

    // Test case 1: Task with future start date vs Task with no start date.
    it('should assign lower priority to task with future start date compared to no start date', () => {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 5);

        const taskWithFutureStart = createTask({
            id: 1,
            startDate: futureDate.toISOString()
        });

        const taskWithNoStart = createTask({
            id: 2
        });

        const breakdown1 = calculatePriorityBreakdown(taskWithFutureStart, [taskWithFutureStart, taskWithNoStart]);
        const breakdown2 = calculatePriorityBreakdown(taskWithNoStart, [taskWithFutureStart, taskWithNoStart]);

        console.log('Future Start Score:', breakdown1.finalScore);
        console.log('No Start Score:', breakdown2.finalScore);

        expect(breakdown1.finalScore).toBeLessThan(breakdown2.finalScore);
    });

    // Test case 2: Task with past start date vs Task with no start date.
    it('should assign higher priority to task with past start date compared to no start date', () => {
        const pastDate = new Date();
        pastDate.setDate(pastDate.getDate() - 5);

        const taskWithPastStart = createTask({
            id: 1,
            startDate: pastDate.toISOString()
        });

        const taskWithNoStart = createTask({
            id: 2
        });

        const breakdown1 = calculatePriorityBreakdown(taskWithPastStart, [taskWithPastStart, taskWithNoStart]);
        const breakdown2 = calculatePriorityBreakdown(taskWithNoStart, [taskWithPastStart, taskWithNoStart]);

        console.log('Past Start Score:', breakdown1.finalScore);
        console.log('No Start Score:', breakdown2.finalScore);

        expect(breakdown1.finalScore).toBeGreaterThan(breakdown2.finalScore);
    });

    // Test case 3: Task with due date should have a due date score > 0.
    it('should calculate due date score correctly for future due date', () => {
        const futureDueDate = new Date();
        futureDueDate.setDate(futureDueDate.getDate() + 20); // 20 days in future

        // This date corresponds to the example in the issue: Sun, Nov 30, 2025
        // Assuming current date is before that.

        const taskWithDueDate = createTask({
            id: 1,
            dueDate: futureDueDate.toISOString()
        });

        const breakdown = calculatePriorityBreakdown(taskWithDueDate, [taskWithDueDate]);

        console.log('Due Date:', taskWithDueDate.dueDate);
        console.log('Due Date Score:', breakdown.dueDateScore);

        // We expect it to be non-zero or at least handled, but currently it fails because logic returns 0.
        // We will assert current behavior first.
        expect(breakdown.dueDateScore).toBe(30);
    });
});
