import React, { useState, useEffect } from 'react';
import { VikunjaConfig, VikunjaProject } from '../types';
import { api } from '../services/vikunjaApi';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: VikunjaConfig) => void;
  currentConfig: VikunjaConfig | null;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onSave, currentConfig }) => {
  // Pre-filled with test credentials as requested
  const [url, setUrl] = useState('https://vikunja.rackspace.koski.co');
  const [token, setToken] = useState('tk_598288a0fb2cc9a123b8ddcef59946b3cc4fae2e');
  const [projectId, setProjectId] = useState<number | null>(null);
  const [customInstructions, setCustomInstructions] = useState('');
  
  const [projects, setProjects] = useState<VikunjaProject[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [error, setError] = useState('');
  const [showToken, setShowToken] = useState(false);

  useEffect(() => {
    // Helper to fetch projects that we can call from inside the effect
    const loadProjects = async (targetUrl: string, targetToken: string, targetProjectId?: number) => {
      if (!targetUrl || !targetToken) return;
      console.log("Auto-loading projects on mount...");
      setIsLoadingProjects(true);
      setError('');
      try {
        const list = await api.getProjects(targetUrl, targetToken);
        setProjects(list);
        
        if (targetProjectId) {
          setProjectId(targetProjectId);
        } else if (list.length > 0 && !projectId) {
          setProjectId(list[0].id);
        }
      } catch (e) {
        console.error("Auto-load failed", e);
        setError((e as Error).message);
      } finally {
        setIsLoadingProjects(false);
      }
    };

    if (currentConfig) {
      setUrl(currentConfig.url);
      setToken(currentConfig.token);
      setCustomInstructions(currentConfig.customInstructions || '');
      loadProjects(currentConfig.url, currentConfig.token, currentConfig.defaultProjectId);
    } else {
      // If no config exists, try to auto-connect with the defaults (test credentials)
      loadProjects(url, token);
    }
  }, [currentConfig]);

  const handleConnect = async () => {
    if (!url || !token) return;
    console.log("Manual connect triggered...");
    setIsLoadingProjects(true);
    setError('');
    try {
      const list = await api.getProjects(url.trim(), token.trim());
      setProjects(list);
      if (list.length > 0) {
        setProjectId(list[0].id);
      } else {
        setError("Connected, but no projects/lists found.");
      }
    } catch (e) {
      console.error("Manual connect failed", e);
      setError((e as Error).message);
    } finally {
      setIsLoadingProjects(false);
    }
  };

  const handleSave = () => {
    if (!url || !token || !projectId) {
      setError("Please fill in all fields and select a project.");
      return;
    }
    onSave({ 
      url: url.trim(), 
      token: token.trim(), 
      defaultProjectId: projectId,
      customInstructions: customInstructions.trim()
    });
    onClose();
  };

  const handleReset = () => {
    if(confirm("This will clear your stored settings. Continue?")) {
      localStorage.removeItem('vikunja_config');
      window.location.reload();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200 max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Vikunja Configuration</h2>
            <p className="text-sm text-slate-500 mt-1">Connect to your Vikunja instance</p>
          </div>
          <button onClick={handleReset} className="text-xs text-red-500 hover:text-red-700 underline">
            Reset Data
          </button>
        </div>
        
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200 flex flex-col gap-2">
              <div className="flex items-center gap-2 font-bold">
                <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <span>Connection Failed</span>
              </div>
              <p className="font-mono text-xs break-all">{error}</p>
              <p className="text-xs text-slate-600 mt-1">Check console (F12) for full details.</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Server URL</label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://vikunja.yourdomain.com"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-vikunja-500 focus:border-vikunja-500 outline-none transition-all"
            />
            <p className="text-xs text-slate-500 mt-1">Just the base URL, don't include /api/v1</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">API Token</label>
            <div className="relative">
              <input
                type={showToken ? "text" : "password"}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="vk_..."
                className="w-full pl-3 pr-10 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-vikunja-500 focus:border-vikunja-500 outline-none transition-all font-mono text-sm"
              />
              <button 
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
              >
                {showToken ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7 9.97 9.97 0 01-1.563 3.029m-5.858.908a3 3 0 11-4.243-4.243M15.121 15.121l-4.242-4.242m4.242 4.242l3.29 3.29m-7.532-7.532l-3.29-3.29" /></svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                )}
              </button>
            </div>
          </div>

          <button
            onClick={handleConnect}
            disabled={!url || !token || isLoadingProjects}
            className="w-full px-4 py-2 bg-vikunja-500 text-white rounded-lg hover:bg-vikunja-600 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-all"
          >
            {isLoadingProjects ? 'Connecting...' : 'Connect & Load Projects'}
          </button>

          {projects.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Select Project</label>
              <select
                value={projectId || ''}
                onChange={(e) => setProjectId(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-vikunja-500 focus:border-vikunja-500 outline-none transition-all"
              >
                <option value="">-- Choose a project --</option>
                {projects.map(proj => (
                  <option key={proj.id} value={proj.id}>{proj.title}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Custom Instructions (Optional)</label>
            <textarea
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              placeholder="e.g., Always mark tasks as urgent, prefer start dates over due dates..."
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-vikunja-500 focus:border-vikunja-500 outline-none transition-all resize-none"
            />
          </div>
        </div>

        <div className="p-6 border-t border-slate-100 flex gap-3 flex-shrink-0">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!projectId}
            className="flex-1 px-4 py-2 bg-vikunja-500 text-white rounded-lg hover:bg-vikunja-600 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-all"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};
