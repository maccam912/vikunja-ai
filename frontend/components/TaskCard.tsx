import React from "react";
import { Task, TaskPriority } from "../types";

interface TaskCardProps {
  task: Task;
  onToggle: (id: number) => void;
  onSelect: (task: Task) => void;
}

const PriorityBadge: React.FC<{ priority: TaskPriority }> = ({ priority }) => {
  switch (priority) {
    case TaskPriority.URGENT:
      return (
        <span className="px-2 py-0.5 text-xs font-bold bg-red-100 text-red-700 rounded-full">
          Urgent
        </span>
      );
    case TaskPriority.HIGH:
      return (
        <span className="px-2 py-0.5 text-xs font-bold bg-orange-100 text-orange-700 rounded-full">
          High
        </span>
      );
    case TaskPriority.MEDIUM:
      return (
        <span className="px-2 py-0.5 text-xs font-bold bg-blue-100 text-blue-700 rounded-full">
          Medium
        </span>
      );
    default:
      return (
        <span className="px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-600 rounded-full">
          Low
        </span>
      );
  }
};

// Helper to strip HTML tags for the preview text
const stripHtml = (html: string) => {
  const tmp = document.createElement("DIV");
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || "";
};

export const TaskCard: React.FC<TaskCardProps> = (
  { task, onToggle, onSelect },
) => {
  const handleCardClick = () => {
    // Prevent triggering select when clicking the checkbox
    onSelect(task);
  };

  return (
    <div
      onClick={handleCardClick}
      className={`group flex items-start gap-4 p-4 bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md hover:border-vikunja-200 transition-all duration-200 cursor-pointer ${
        task.completed ? "opacity-60 bg-slate-50" : ""
      }`}
    >
      {/* Checkbox */}
      <div className="pt-1">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggle(task.id);
          }}
          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors duration-200 ${
            task.completed
              ? "bg-vikunja-500 border-vikunja-500"
              : "border-slate-300 hover:border-vikunja-500"
          }`}
          aria-label={task.completed
            ? "Mark as incomplete"
            : "Mark as complete"}
        >
          {task.completed && (
            <svg
              className="w-3.5 h-3.5 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={3}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          )}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h3
            className={`text-base font-medium text-slate-900 leading-snug ${
              task.completed ? "line-through text-slate-500" : ""
            }`}
          >
            {task.title}
          </h3>
          <PriorityBadge priority={task.priority} />
        </div>

        {task.description && (
          <p
            className={`mt-1 text-sm text-slate-600 line-clamp-2 ${
              task.completed ? "line-through text-slate-400" : ""
            }`}
          >
            {stripHtml(task.description)}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-slate-500">
          {task.dueDate && (
            <div
              className={`flex items-center gap-1 ${
                new Date(task.dueDate) < new Date() && !task.completed
                  ? "text-red-600 font-medium"
                  : ""
              }`}
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              {new Date(task.dueDate).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}
            </div>
          )}

          {task.assignee && (
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-[9px]">
                {task.assignee.charAt(0).toUpperCase()}
              </div>
              <span>{task.assignee}</span>
            </div>
          )}

          <div className="flex gap-1">
            {task.tags.map((tag) => (
              <span
                key={tag}
                className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-600"
              >
                #{tag}
              </span>
            ))}
          </div>

          <span className="ml-auto text-slate-300 text-[10px] font-mono">
            ID: {task.id}
          </span>
        </div>
      </div>
    </div>
  );
};
