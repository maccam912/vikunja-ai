import React, { useEffect, useRef, useState } from "react";
import { Message } from "../types";

interface ChatProps {
  messages: Message[];
  onSendMessage: (text: string) => void;
  isLoading: boolean;
  statusMessage?: string;
}

export const Chat: React.FC<ChatProps> = (
  { messages, onSendMessage, isLoading, statusMessage },
) => {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading, statusMessage]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSendMessage(input);
    setInput("");
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-800 shadow-xl lg:shadow-none">
      {/* Header - Only show on desktop/large view or when it acts as a sidebar header */}
      <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-vikunja-100 dark:bg-vikunja-900/40 rounded-lg text-vikunja-600 dark:text-vikunja-200">
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          </div>
          <div>
            <h2 className="font-bold text-slate-800 dark:text-slate-100">AI Assistant</h2>
            <p className="text-xs text-slate-500 dark:text-slate-300">Powered by Gemini 2.5</p>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div
        className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-900"
        ref={scrollRef}
      >
        {messages.length === 0 && (
          <div className="text-center py-10 px-6">
            <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-full shadow-sm mx-auto flex items-center justify-center mb-4 text-vikunja-400">
              <svg
                className="w-8 h-8"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                />
              </svg>
            </div>
            <p className="text-slate-600 dark:text-slate-200 font-medium mb-1">
              How can I help you manage tasks?
            </p>
            <p className="text-sm text-slate-400 dark:text-slate-300">
              Try "Add a high priority task to buy milk" or "Reschedule task 2
              for tomorrow".
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${
              msg.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                msg.role === "user"
                  ? "bg-vikunja-600 text-white rounded-tr-none"
                  : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-100 dark:border-slate-700 rounded-tl-none"
              }`}
            >
              {msg.role === "model" && msg.isToolOutput
                ? (
                  <div className="font-mono text-xs text-slate-500 dark:text-slate-300 border-l-2 border-vikunja-200 dark:border-vikunja-500/50 pl-2 py-1 my-1">
                    <div className="flex items-center gap-1.5 mb-1 text-vikunja-600 dark:text-vikunja-200 font-bold uppercase tracking-wider text-[10px]">
                      <svg
                        className="w-3 h-3"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 10V3L4 14h7v7l9-11h-7z"
                        />
                      </svg>
                      System Action
                    </div>
                    {msg.text}
                  </div>
                )
                : (
                  <div className="whitespace-pre-wrap break-words">
                    {msg.text}
                  </div>
                )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl rounded-tl-none px-4 py-3 shadow-sm flex items-center gap-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-vikunja-400 rounded-full animate-bounce">
                </div>
                <div className="w-2 h-2 bg-vikunja-400 rounded-full animate-bounce delay-75">
                </div>
                <div className="w-2 h-2 bg-vikunja-400 rounded-full animate-bounce delay-150">
                </div>
              </div>
              {statusMessage && (
                <span className="text-xs text-slate-500 dark:text-slate-300 font-mono border-l border-slate-200 dark:border-slate-700 pl-3">
                  {statusMessage}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-3 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 flex-shrink-0 pb-[env(safe-area-inset-bottom)]">
        <form onSubmit={handleSubmit} className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your command..."
            className="w-full pl-4 pr-12 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-vikunja-500/20 focus:border-vikunja-500 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-300 text-sm text-slate-900 dark:text-slate-100"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-vikunja-600 text-white rounded-lg hover:bg-vikunja-700 disabled:opacity-50 disabled:hover:bg-vikunja-600 transition-colors"
          >
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
                d="M5 12h14M12 5l7 7-7 7"
              />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
};
