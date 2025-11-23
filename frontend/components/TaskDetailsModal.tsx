import React from "react";
import { Task, TaskPriority, TaskRelationKind } from "../types";
import { calculatePriorityBreakdown } from "../utils/priorityCalculation";

interface TaskDetailsModalProps {
  task: Task | null;
  onClose: () => void;
  allTasks?: Task[]; // Optional: needed to show blocking/blocked task details
}

const PriorityBadge: React.FC<{ priority: TaskPriority }> = ({ priority }) => {
  const config = {
    [TaskPriority.URGENT]: {
      label: "Urgent",
      class: "bg-red-100 text-red-700",
    },
    [TaskPriority.HIGH]: {
      label: "High",
      class: "bg-orange-100 text-orange-700",
    },
    [TaskPriority.MEDIUM]: {
      label: "Medium",
      class: "bg-blue-100 text-blue-700",
    },
    [TaskPriority.LOW]: { label: "Low", class: "bg-slate-100 text-slate-600" },
    [TaskPriority.DO_IT_NOW]: {
      label: "Do It Now",
      class: "bg-purple-100 text-purple-700",
    },
  }[priority] || { label: "Low", class: "bg-slate-100 text-slate-600" };

  return (
    <span
      className={`px-3 py-1 text-sm font-bold rounded-full ${config.class}`}
    >
      {config.label}
    </span>
  );
};

export const TaskDetailsModal: React.FC<TaskDetailsModalProps> = (
  { task, onClose, allTasks },
) => {
  if (!task) return null;

  // Calculate blocking/blocked relationships
  const blockingRelations = task.relatedTasks?.filter(
    (r) =>
      r.relation_kind === TaskRelationKind.BLOCKED ||
      r.relation_kind === "blocked",
  ) || [];

  const blockedRelations = task.relatedTasks?.filter(
    (r) =>
      r.relation_kind === TaskRelationKind.BLOCKING ||
      r.relation_kind === "blocking",
  ) || [];

  // Get actual task objects if allTasks is provided
  const blockingTasks = allTasks
    ? allTasks.filter((t) =>
      blockingRelations.some((r) => r.other_task_id === t.id)
    )
    : [];

  const blockedTasks = allTasks
    ? allTasks.filter((t) =>
      blockedRelations.some((r) => r.other_task_id === t.id)
    )
    : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-start justify-between bg-slate-50">
          <div className="pr-8">
            <div className="flex items-center gap-3 mb-2">
              <span className="font-mono text-xs text-slate-400">
                #{task.identifier || task.id}
              </span>
              {task.completed && (
                <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-bold rounded">
                  COMPLETED
                </span>
              )}
            </div>
            <h2 className="text-2xl font-bold text-slate-900 leading-tight">
              {task.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Priority
              </div>
              <PriorityBadge priority={task.priority} />
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Due Date
              </div>
              <div
                className={`font-medium ${
                  task.dueDate && new Date(task.dueDate) < new Date() &&
                    !task.completed
                    ? "text-red-600"
                    : "text-slate-700"
                }`}
              >
                {task.dueDate
                  ? new Date(task.dueDate).toLocaleDateString(undefined, {
                    weekday: "short",
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })
                  : "No Date"}
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Assignee
              </div>
              {task.assignee
                ? (
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs">
                      {task.assignee.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-slate-700 font-medium truncate">
                      {task.assignee}
                    </span>
                  </div>
                )
                : <span className="text-slate-400 text-sm">Unassigned</span>}
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Tags
              </div>
              {task.tags.length > 0
                ? (
                  <div className="flex flex-wrap gap-1">
                    {task.tags.map((t) => (
                      <span
                        key={t}
                        className="px-1.5 py-0.5 bg-white border border-slate-200 text-xs rounded text-slate-600"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )
                : <span className="text-slate-400 text-sm">No Tags</span>}
            </div>
          </div>

          {/* Calculated Priority Score with Breakdown */}
          {task.calculatedPriority !== undefined && allTasks && (
            <div className="mb-6 p-4 bg-vikunja-50 border border-vikunja-200 rounded-lg">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-xs font-semibold text-vikunja-600 uppercase tracking-wider mb-1">
                    Calculated Priority Score
                  </div>
                  <div className="text-2xl font-bold text-vikunja-700">
                    {Math.round(task.calculatedPriority)}
                  </div>
                </div>
                <svg
                  className="w-8 h-8 text-vikunja-400"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              </div>

              {/* Priority Breakdown */}
              {(() => {
                const breakdown = calculatePriorityBreakdown(task, allTasks);
                return (
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-vikunja-700 uppercase tracking-wider mb-2">
                      Score Components:
                    </div>

                    {/* Base Priority */}
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                        <span className="text-slate-700">Base Priority</span>
                        <span className="text-xs text-slate-500">
                          (Level {task.priority} × 100)
                        </span>
                      </div>
                      <span className="font-mono font-semibold text-slate-900">
                        {breakdown.baseScore}
                      </span>
                    </div>

                    {/* Due Date Score */}
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            breakdown.dueDateScore > 0
                              ? "bg-orange-500"
                              : "bg-slate-300"
                          }`}
                        >
                        </div>
                        <span className="text-slate-700">Due Date Urgency</span>
                        {breakdown.dueDateScore === 0 && (
                          <span className="text-xs text-slate-500">
                            (no due date)
                          </span>
                        )}
                        {breakdown.dueDateScore === 75 && (
                          <span className="text-xs text-slate-500">
                            (due within 7 days)
                          </span>
                        )}
                        {breakdown.dueDateScore === 150 && (
                          <span className="text-xs text-slate-500">
                            (due within 3 days)
                          </span>
                        )}
                        {breakdown.dueDateScore === 300 && (
                          <span className="text-xs text-orange-600 font-medium">
                            (due within 24 hours)
                          </span>
                        )}
                        {breakdown.dueDateScore === 500 && (
                          <span className="text-xs text-red-600 font-bold">
                            (OVERDUE!)
                          </span>
                        )}
                      </div>
                      <span className="font-mono font-semibold text-slate-900">
                        +{breakdown.dueDateScore}
                      </span>
                    </div>

                    {/* Blocking Bonus */}
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            breakdown.blockingBonus > 0
                              ? "bg-amber-500"
                              : "bg-slate-300"
                          }`}
                        >
                        </div>
                        <span className="text-slate-700">Blocking Bonus</span>
                        {breakdown.blockingBonus > 0 && (
                          <span className="text-xs text-slate-500">
                            (unblocks other tasks)
                          </span>
                        )}
                      </div>
                      <span className="font-mono font-semibold text-slate-900">
                        +{Math.round(breakdown.blockingBonus)}
                      </span>
                    </div>

                    {/* Blocked Penalty */}
                    {breakdown.isBlocked && (
                      <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded">
                        <div className="flex items-center gap-2 text-sm">
                          <svg
                            className="w-4 h-4 text-red-600"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                          <span className="text-red-700 font-semibold">
                            BLOCKED - Priority reduced to ~1%
                          </span>
                        </div>
                        <div className="text-xs text-red-600 mt-1 ml-6">
                          Score before penalty: {Math.round(
                            breakdown.totalBeforeBlocked,
                          )}
                        </div>
                      </div>
                    )}

                    {/* Final Score */}
                    <div className="mt-3 pt-3 border-t border-vikunja-300 flex items-center justify-between text-sm font-bold">
                      <span className="text-vikunja-700">TOTAL SCORE</span>
                      <span className="font-mono text-lg text-vikunja-800">
                        {Math.round(breakdown.finalScore)}
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Task Relationships */}
          {(blockingTasks.length > 0 || blockedTasks.length > 0) && (
            <div className="mb-6">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3 border-b border-slate-100 pb-2">
                Task Dependencies
              </h3>

              {/* Blocked By */}
              {blockingTasks.length > 0 && (
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <svg
                      className="w-4 h-4 text-red-600"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="text-sm font-semibold text-red-700">
                      Blocked By ({blockingTasks.length})
                    </span>
                  </div>
                  <div className="space-y-2 pl-6">
                    {blockingTasks.map((blockingTask) => (
                      <div
                        key={blockingTask.id}
                        className="p-2 bg-red-50 border border-red-200 rounded text-sm"
                      >
                        <div className="font-medium text-slate-900">
                          {blockingTask.title}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          ID: {blockingTask.id} • {blockingTask.completed
                            ? (
                              <span className="text-green-600 font-medium">
                                ✓ Completed
                              </span>
                            )
                            : <span className="text-red-600">Incomplete</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-red-600 mt-2 pl-6">
                    This task cannot be started until the blocking tasks are
                    completed.
                  </p>
                </div>
              )}

              {/* Blocks */}
              {blockedTasks.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <svg
                      className="w-4 h-4 text-amber-600"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="text-sm font-semibold text-amber-700">
                      Blocks ({blockedTasks.length})
                    </span>
                  </div>
                  <div className="space-y-2 pl-6">
                    {blockedTasks.map((blockedTask) => (
                      <div
                        key={blockedTask.id}
                        className="p-2 bg-amber-50 border border-amber-200 rounded text-sm"
                      >
                        <div className="font-medium text-slate-900">
                          {blockedTask.title}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          ID: {blockedTask.id} • Priority:{" "}
                          {blockedTask.calculatedPriority
                            ? Math.round(blockedTask.calculatedPriority)
                            : "N/A"}
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-amber-600 mt-2 pl-6">
                    Completing this task will unblock {blockedTasks.length}{" "}
                    other task{blockedTasks.length !== 1 ? "s" : ""}.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Description */}
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3 border-b border-slate-100 pb-2">
              Description
            </h3>
            {task.description
              ? (
                <div
                  className="prose prose-slate prose-sm max-w-none text-slate-700"
                  dangerouslySetInnerHTML={{ __html: task.description }}
                />
              )
              : (
                <p className="text-slate-400 italic">
                  No description provided.
                </p>
              )}
          </div>
        </div>
      </div>
    </div>
  );
};
