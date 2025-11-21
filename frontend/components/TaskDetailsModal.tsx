import React from "react";
import { Task, TaskPriority } from "../types";

interface TaskDetailsModalProps {
  task: Task | null;
  onClose: () => void;
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
  { task, onClose },
) => {
  if (!task) return null;

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
