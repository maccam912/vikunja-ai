import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Message, Task, VikunjaConfig } from "./types";
import { TaskCard } from "./components/TaskCard";
import { Chat } from "./components/Chat";
import { SettingsModal } from "./components/SettingsModal";
import { TaskDetailsModal } from "./components/TaskDetailsModal";
import * as apiClient from "./services/apiClient";
import {
  calculatePriorities,
  getTopPriorityTask,
  sortByPriority,
} from "./utils/priorityCalculation";

const App: React.FC = () => {
  // App State
  const [tasks, setTasks] = useState<Task[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false); // Gemini loading
  const [statusMessage, setStatusMessage] = useState(""); // Fine-grained status
  const [isRefreshing, setIsRefreshing] = useState(false); // Data loading
  const [filter, setFilter] = useState<"all" | "active" | "completed">(
    "active",
  );
  const [showCompletedList, setShowCompletedList] = useState(false);

  // Mobile View State
  const [mobileView, setMobileView] = useState<"tasks" | "chat">("tasks");

  // Config State
  const [config, setConfig] = useState<VikunjaConfig | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Selection State
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // Initialize from LocalStorage
  useEffect(() => {
    const storedConfig = localStorage.getItem("vikunja_config");
    if (storedConfig) {
      const parsed = JSON.parse(storedConfig);
      setConfig(parsed);
    } else {
      setIsSettingsOpen(true);
    }
  }, []);

  // Fetch Data when config changes
  useEffect(() => {
    if (config) {
      refreshData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  const refreshData = useCallback(async () => {
    if (!config) return;
    setIsRefreshing(true);
    try {
      const fetchedTasks = await apiClient.getTasks(
        config.url,
        config.token,
        config.defaultProjectId,
      );
      // Calculate custom priorities for all tasks
      const tasksWithPriorities = calculatePriorities(fetchedTasks);
      setTasks(tasksWithPriorities);
    } catch (error) {
      console.error("Failed to fetch Vikunja data:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "model",
          text: `⚠️ Error connecting to Vikunja: ${
            (error as Error).message
          }. Please check your settings.`,
        },
      ]);
    } finally {
      setIsRefreshing(false);
    }
  }, [config]);

  const handleSaveConfig = (newConfig: VikunjaConfig) => {
    setConfig(newConfig);
    localStorage.setItem("vikunja_config", JSON.stringify(newConfig));
  };

  // -- Backend AI Integration --

  const handleSendMessage = async (text: string) => {
    if (!config) {
      alert("Please configure your Vikunja connection first.");
      return;
    }

    const userMsg: Message = { id: Date.now().toString(), role: "user", text };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);
    setStatusMessage("Thinking...");

    try {
      // Convert messages to backend format
      const chatMessages: apiClient.ChatMessage[] = [
        ...messages.map((m) => ({
          role: m.role === "user" ? ("user" as const) : ("assistant" as const),
          content: m.text,
        })),
        { role: "user" as const, content: text },
      ];

      const response = await apiClient.sendChatMessage({
        messages: chatMessages,
        projectId: config.defaultProjectId,
        vikunjaUrl: config.url,
        vikunjaToken: config.token,
      });

      // Add AI response to messages
      const aiMsg: Message = {
        id: Date.now().toString(),
        role: "model",
        text: response.message,
      };
      setMessages((prev) => [...prev, aiMsg]);

      // Show tool calls if any
      if (response.toolCalls && response.toolCalls.length > 0) {
        response.toolCalls.forEach((tc) => {
          setMessages((prev) => [
            ...prev,
            {
              id: `tool-${Date.now()}-${Math.random()}`,
              role: "model",
              text: `🔧 ${tc.tool}: ${JSON.stringify(tc.args)}`,
              isToolOutput: true,
            },
          ]);
        });
      }

      // Refresh tasks after AI interaction
      await refreshData();
    } catch (error) {
      console.error("Backend Error:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "model",
          text: `Sorry, I encountered an error: ${(error as Error).message}`,
        },
      ]);
    } finally {
      setIsLoading(false);
      setStatusMessage("");
    }
  };

  const handleTaskToggle = async (id: number) => {
    if (!config) return;
    const task = tasks.find((t) => t.id === id);
    if (!task) return;

    const updatedLocal = { ...task, completed: !task.completed };
    setTasks((prev) => prev.map((t) => (t.id === id ? updatedLocal : t)));

    if (selectedTask?.id === id) {
      setSelectedTask(updatedLocal);
    }

    try {
      const updated = await apiClient.updateTask(config.url, config.token, id, {
        done: updatedLocal.completed,
      });

      setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
      if (selectedTask?.id === id) {
        setSelectedTask(updated);
      }
    } catch (error) {
      console.error("Failed to update task:", error);
      setTasks((prev) => prev.map((t) => (t.id === id ? task : t)));
      if (selectedTask?.id === id) {
        setSelectedTask(task);
      }
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "model",
          text: `⚠️ Could not update task: ${(error as Error).message}`,
        },
      ]);
    }
  };

  // Calculate priorities and get top task
  const topPriorityTask = useMemo(() => getTopPriorityTask(tasks), [tasks]);

  // Filtering
  const completedTasks = tasks.filter((t) => t.completed);
  const visibleTasks = tasks.filter((t) => {
    if (filter === "active") return !t.completed;
    if (filter === "completed") return t.completed;
    return true;
  });

  // Sort tasks by calculated priority
  const sortedVisibleTasks = useMemo(
    () => sortByPriority(visibleTasks),
    [visibleTasks],
  );

  return (
    // Use h-[100dvh] to solve mobile browser address bar issues
    <div className="flex flex-col lg:flex-row h-[100dvh] bg-slate-50 text-slate-900 font-sans overflow-hidden">
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSave={handleSaveConfig}
        currentConfig={config}
      />

      <TaskDetailsModal
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        allTasks={tasks}
      />

      {
        /* Main Content Area (Tasks List)
          On mobile: Only visible if mobileView === 'tasks'
          On desktop: Always visible (flex-1)
      */
      }
      <div
        className={`flex-1 flex flex-col min-w-0 overflow-hidden ${
          mobileView === "chat" ? "hidden lg:flex" : "flex"
        }`}
      >
        {/* Top Bar */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-6 flex-shrink-0 z-10">
          <div className="flex items-center gap-3">
            <div className="bg-vikunja-600 p-1.5 rounded text-white">
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h1 className="text-lg font-bold text-slate-800 tracking-tight">
              Vikunja<span className="text-vikunja-500 font-light">AI</span>
            </h1>
            {isRefreshing && (
              <span className="hidden sm:inline text-xs text-slate-400 animate-pulse ml-2">
                Syncing...
              </span>
            )}
          </div>

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 text-slate-400 hover:text-vikunja-600 hover:bg-vikunja-50 rounded-full transition-all"
              title="Settings"
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
                  strokeWidth={1.5}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </button>
            <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-vikunja-400 to-purple-500 border-2 border-white shadow-sm">
            </div>
          </div>
        </header>

        {/* Toolbar */}
        <div className="px-4 lg:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-slate-800">My Tasks</h2>
            <button
              type="button"
              onClick={refreshData}
              className="p-1.5 text-slate-400 hover:text-vikunja-600 rounded-lg transition-colors"
              title="Refresh"
            >
              <svg
                className={`w-5 h-5 ${isRefreshing ? "animate-spin" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
          </div>

          <div className="flex items-center bg-white rounded-lg p-1 border border-slate-200 shadow-sm self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                filter === "all"
                  ? "bg-slate-100 text-slate-900"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setFilter("active")}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                filter === "active"
                  ? "bg-slate-100 text-slate-900"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Active
            </button>
            <button
              type="button"
              onClick={() => setFilter("completed")}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                filter === "completed"
                  ? "bg-slate-100 text-slate-900"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Done
            </button>
          </div>
        </div>

        {/* Task List */}
        <div className="flex-1 overflow-y-auto px-4 lg:px-6 pb-4 min-h-0">
          <div className="space-y-3 max-w-4xl pb-20 lg:pb-0">
            {!config
              ? (
                <div className="text-center py-20">
                  <p className="text-slate-500 mb-4">
                    Please configure your Vikunja connection to see tasks.
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsSettingsOpen(true)}
                    className="text-vikunja-600 font-medium hover:underline"
                  >
                    Open Settings
                  </button>
                </div>
              )
              : visibleTasks.length === 0
              ? (
                <div className="text-center py-20 text-slate-400">
                  <p>No tasks found in this view.</p>
                  <p className="text-sm mt-2">Ask the AI to create one!</p>
                </div>
              )
              : (
                <>
                  {/* Top Priority Task Highlight */}
                  {topPriorityTask && filter === "active" && (
                    <div className="mb-4 p-4 bg-gradient-to-r from-vikunja-50 to-purple-50 border-2 border-vikunja-300 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <svg
                          className="w-5 h-5 text-vikunja-600"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        <span className="text-sm font-semibold text-vikunja-700">
                          Top Priority - Do This Next
                        </span>
                        {topPriorityTask.calculatedPriority && (
                          <span className="ml-auto text-xs text-vikunja-600 font-mono">
                            Score:{" "}
                            {Math.round(topPriorityTask.calculatedPriority)}
                          </span>
                        )}
                      </div>
                      <TaskCard
                        key={topPriorityTask.id}
                        task={topPriorityTask}
                        onToggle={handleTaskToggle}
                        onSelect={setSelectedTask}
                      />
                    </div>
                  )}

                  {/* All Tasks */}
                  {sortedVisibleTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onToggle={handleTaskToggle}
                      onSelect={setSelectedTask}
                    />
                  ))}
                </>
              )}
          </div>

          {/* Completed tasks quick view */}
          {config && filter !== "completed" && completedTasks.length > 0 && (
            <div className="max-w-4xl mt-6 border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={() => setShowCompletedList((prev) => !prev)}
                className="w-full flex items-center justify-between text-left text-sm font-medium text-slate-600 hover:text-slate-800"
              >
                <span>Completed tasks ({completedTasks.length})</span>
                <svg
                  className={`w-4 h-4 transition-transform ${
                    showCompletedList ? "rotate-180" : ""
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {showCompletedList && (
                <div className="mt-3 space-y-3">
                  {completedTasks
                    .sort((a, b) =>
                      (b.updated || "").localeCompare(a.updated || "")
                    )
                    .map((task) => (
                      <TaskCard
                        key={`completed-${task.id}`}
                        task={task}
                        onToggle={handleTaskToggle}
                        onSelect={setSelectedTask}
                      />
                    ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {
        /* Chat Area
          On mobile: Only visible if mobileView === 'chat'
          On desktop: Always visible (width 400px)
      */
      }
      <div
        className={`lg:w-[400px] border-l border-slate-200 bg-white flex-col ${
          mobileView === "chat"
            ? "flex flex-1 w-full overflow-hidden min-h-0"
            : "hidden lg:flex overflow-hidden min-h-0"
        }`}
      >
        <Chat
          messages={messages}
          onSendMessage={handleSendMessage}
          isLoading={isLoading}
          statusMessage={statusMessage}
        />
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="lg:hidden h-16 bg-white border-t border-slate-200 flex-shrink-0 flex justify-around items-center z-20 pb-[env(safe-area-inset-bottom)]">
        <button
          type="button"
          onClick={() => setMobileView("tasks")}
          className={`flex flex-col items-center justify-center w-full h-full ${
            mobileView === "tasks"
              ? "text-vikunja-600"
              : "text-slate-400 hover:text-slate-600"
          }`}
        >
          <svg
            className="w-6 h-6 mb-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
          <span className="text-[10px] font-bold uppercase tracking-wider">
            Tasks
          </span>
        </button>

        <button
          type="button"
          onClick={() => setMobileView("chat")}
          className={`flex flex-col items-center justify-center w-full h-full ${
            mobileView === "chat"
              ? "text-vikunja-600"
              : "text-slate-400 hover:text-slate-600"
          }`}
        >
          <svg
            className="w-6 h-6 mb-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
            />
          </svg>
          <span className="text-[10px] font-bold uppercase tracking-wider">
            Assistant
          </span>
        </button>
      </div>
    </div>
  );
};

export default App;
