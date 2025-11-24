import React from "react";
import { Task, TaskPriority, TaskRelation, TaskRelationKind } from "../types";
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

  const relationDisplayOrder: (TaskRelationKind | string)[] = [
    TaskRelationKind.BLOCKED,
    TaskRelationKind.BLOCKING,
    TaskRelationKind.SUBTASK,
    TaskRelationKind.PARENT_TASK,
    TaskRelationKind.RELATED,
    TaskRelationKind.DUPLICATE_OF,
    TaskRelationKind.DUPLICATES,
    TaskRelationKind.PRECEDES,
    TaskRelationKind.FOLLOWS,
    TaskRelationKind.COPIED_FROM,
    TaskRelationKind.COPIED_TO,
  ];

  const relationMetadata: Record<
    TaskRelationKind | string,
    {
      label: string;
      accentClasses: string;
      borderClasses: string;
      helperText?: string | ((count: number) => string);
      icon: React.ReactNode;
    }
  > = {
    [TaskRelationKind.BLOCKED]: {
      label: "Blocked By",
      accentClasses: "text-red-700",
      borderClasses: "bg-red-50 border-red-200",
      helperText:
        "This task cannot be started until the blocking tasks are completed.",
      icon: (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z"
            clipRule="evenodd"
          />
        </svg>
      ),
    },
    [TaskRelationKind.BLOCKING]: {
      label: "Blocks",
      accentClasses: "text-amber-700",
      borderClasses: "bg-amber-50 border-amber-200",
      helperText: (count: number) =>
        `Completing this task will unblock ${count} other task${count !== 1 ? "s" : ""}.`,
      icon: (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>
      ),
    },
    [TaskRelationKind.SUBTASK]: {
      label: "Subtasks",
      accentClasses: "text-slate-800",
      borderClasses: "bg-slate-50 border-slate-200",
      helperText: "Work items that roll up into this task.",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 9l6 6 6-6" />
        </svg>
      ),
    },
    [TaskRelationKind.PARENT_TASK]: {
      label: "Parent Task",
      accentClasses: "text-slate-800",
      borderClasses: "bg-slate-50 border-slate-200",
      helperText: "The parent item this task belongs to.",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      ),
    },
    [TaskRelationKind.RELATED]: {
      label: "Related",
      accentClasses: "text-blue-700",
      borderClasses: "bg-blue-50 border-blue-200",
      helperText: "Tasks that are connected or share context.",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-3-3v6m-7 5h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
    [TaskRelationKind.DUPLICATE_OF]: {
      label: "Duplicate Of",
      accentClasses: "text-purple-700",
      borderClasses: "bg-purple-50 border-purple-200",
      helperText: "This task duplicates another.",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16h8m-8-4h8m-8-4h8M5 6h14a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2z" />
        </svg>
      ),
    },
    [TaskRelationKind.DUPLICATES]: {
      label: "Duplicates",
      accentClasses: "text-purple-700",
      borderClasses: "bg-purple-50 border-purple-200",
      helperText: "Other tasks that duplicate this one.",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5h12M9 9h12M9 13h12M5 9h.01M5 13h.01M5 17h.01" />
        </svg>
      ),
    },
    [TaskRelationKind.PRECEDES]: {
      label: "Precedes",
      accentClasses: "text-emerald-700",
      borderClasses: "bg-emerald-50 border-emerald-200",
      helperText: "This task should happen before the related ones.",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5-5 5M6 5v14" />
        </svg>
      ),
    },
    [TaskRelationKind.FOLLOWS]: {
      label: "Follows",
      accentClasses: "text-emerald-700",
      borderClasses: "bg-emerald-50 border-emerald-200",
      helperText: "This task depends on the completion of the listed tasks.",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5 5-5M18 19V5" />
        </svg>
      ),
    },
    [TaskRelationKind.COPIED_FROM]: {
      label: "Copied From",
      accentClasses: "text-slate-800",
      borderClasses: "bg-slate-50 border-slate-200",
      helperText: "This task was copied from the listed tasks.",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12M8 11h12M8 15h12M4 7h.01M4 11h.01M4 15h.01" />
        </svg>
      ),
    },
    [TaskRelationKind.COPIED_TO]: {
      label: "Copied To",
      accentClasses: "text-slate-800",
      borderClasses: "bg-slate-50 border-slate-200",
      helperText: "This task was duplicated into other tasks.",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7H8m0 0L4 11m4-4l4 4m0 4h8m0 0l-4-4m4 4l-4 4" />
        </svg>
      ),
    },
  };

  const groupedRelations = (task.relatedTasks || []).reduce(
    (acc, relation) => {
      const key = relation.relation_kind;
      if (!acc[key]) acc[key] = [];
      acc[key].push(relation);
      return acc;
    },
    {} as Record<TaskRelationKind | string, TaskRelation[]>,
  );

  const resolveRelatedTask = (relation: TaskRelation) =>
    allTasks?.find((t) => t.id === relation.other_task_id);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-700 flex items-start justify-between bg-slate-50 dark:bg-slate-800">
          <div className="pr-8">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <span className="font-mono text-xs text-slate-400 dark:text-slate-300">
                #{task.identifier || task.id}
              </span>
              {task.completed && (
                <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-200 text-xs font-bold rounded">
                  COMPLETED
                </span>
              )}
              {task.webUrl && (
                <a
                  href={task.webUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-vikunja-700 hover:text-vikunja-800"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M14 3h7v7m0-7L10 14m-4 7h7m-7 0v-7m0 7L21 3"
                    />
                  </svg>
                  Open in Vikunja
                </a>
              )}
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 leading-tight">
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
                const startDate = task.startDate
                  ? new Date(task.startDate)
                  : null;
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

                    {/* Start Date Score */}
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            breakdown.startDateScore !== 0
                              ? breakdown.startDateScore > 0
                                ? "bg-emerald-500"
                                : "bg-purple-500"
                              : "bg-slate-300"
                          }`}
                        >
                        </div>
                        <span className="text-slate-700">
                          Start Date Alignment
                        </span>
                        {!startDate && (
                          <span className="text-xs text-slate-500">
                            (no start date)
                          </span>
                        )}
                        {startDate && breakdown.startDateScore > 0 && (
                          <span className="text-xs text-emerald-600 font-medium">
                            (already started)
                          </span>
                        )}
                        {startDate && breakdown.startDateScore < 0 && (
                          <span className="text-xs text-purple-600 font-medium">
                            (starts later)
                          </span>
                        )}
                      </div>
                      <span className="font-mono font-semibold text-slate-900">
                        {breakdown.startDateScore > 0
                          ? `+${breakdown.startDateScore}`
                          : breakdown.startDateScore}
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
                        {breakdown.dueDateScore === 0 &&
                          !breakdown.hasDueDate && (
                          <span className="text-xs text-slate-500">
                            (no due date)
                          </span>
                        )}
                        {breakdown.dueDateScore === 0 && breakdown.hasDueDate &&
                          (
                            <span className="text-xs text-slate-500">
                              (due later)
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
          <div className="mb-6">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3 border-b border-slate-100 pb-2">
              Task Relationships
            </h3>

            {task.relatedTasks && task.relatedTasks.length > 0
              ? (
                <div className="space-y-4">
                  {[...
                    relationDisplayOrder.filter((kind) => groupedRelations[kind]?.length),
                    ...Object.keys(groupedRelations).filter((key) =>
                      !relationDisplayOrder.includes(key),
                    ),
                  ].map((kind) => {
                    const relations = groupedRelations[kind];
                    if (!relations) return null;

                    const metadata =
                      relationMetadata[kind] || {
                        label: `Relation (${kind})`,
                        accentClasses: "text-slate-700",
                        borderClasses: "bg-slate-50 border-slate-200",
                        icon: (
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 4v16m8-8H4"
                            />
                          </svg>
                        ),
                      };

                    const helperText =
                      typeof metadata.helperText === "function"
                        ? metadata.helperText(relations.length)
                        : metadata.helperText;

                    return (
                      <div key={kind}>
                        <div className="flex items-center gap-2 mb-2">
                          <span
                            className={`inline-flex items-center justify-center w-8 h-8 rounded-full border ${metadata.borderClasses}`}
                          >
                            <span className={metadata.accentClasses}>
                              {metadata.icon}
                            </span>
                          </span>
                          <span className={`text-sm font-semibold ${metadata.accentClasses}`}>
                            {metadata.label} ({relations.length})
                          </span>
                        </div>

                        <div className="space-y-2 pl-6">
                          {relations.map((relation) => {
                            const relatedTask = resolveRelatedTask(relation);
                            return (
                              <div
                                key={relation.id}
                                className={`p-2 border rounded text-sm ${metadata.borderClasses}`}
                              >
                                <div className="font-medium text-slate-900">
                                  {relatedTask?.title || `Task #${relation.other_task_id}`}
                                </div>
                                <div className="text-xs text-slate-600 mt-1 flex flex-wrap gap-2">
                                  <span>ID: {relation.other_task_id}</span>
                                  {relatedTask && (
                                    <span>
                                      Status: {relatedTask.completed
                                        ? "✓ Completed"
                                        : "In progress"}
                                    </span>
                                  )}
                                  {!relatedTask && <span>Not loaded</span>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        {helperText && (
                          <p className={`text-xs mt-2 pl-6 ${metadata.accentClasses}`}>
                            {helperText}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )
              : <p className="text-sm text-slate-500">No relationships found.</p>}
          </div>

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
