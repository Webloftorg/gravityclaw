import { useState, useEffect } from 'react';
import { Activity, BrainCircuit, Terminal, Save, CheckCircle2, Columns } from 'lucide-react';
import { KanbanBoard } from './components/KanbanBoard';

function App() {
  const [notepad, setNotepad] = useState({ text: '', ts: null });
  const [taskInput, setTaskInput] = useState('');
  const [memories, setMemories] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [lastTs, setLastTs] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'live' | 'kanban'>('kanban');
  const [agentStatus, setAgentStatus] = useState<'offline' | 'online' | 'working'>('offline');
  const [activeTask, setActiveTask] = useState<{ id: string, title: string } | null>(null);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000); // Poll every 3 seconds
    return () => clearInterval(interval);
  }, [lastTs]); // Add lastTs to dependency array so the closure has the latest value

  const fetchData = async () => {
    try {
      const [notepadRes, memoryRes, statusRes] = await Promise.all([
        fetch('http://localhost:4001/api/notepad').catch(() => null),
        fetch('http://localhost:4001/api/memories').catch(() => null),
        fetch('http://localhost:4001/api/agent-status').catch(() => null)
      ]);

      if (statusRes && statusRes.ok) {
        const statusData = await statusRes.json();
        setAgentStatus(statusData.status);
        setActiveTask(statusData.activeTask || null);
      } else {
        setAgentStatus('offline');
        setActiveTask(null);
      }

      let noteData = { text: '', ts: null };
      if (notepadRes && notepadRes.ok) {
        noteData = await notepadRes.json();
        setNotepad(noteData);

        // Only overwrite user input if the server file is ACTUALLY newer 
        // than the last timestamp we synced from the server.
        if (noteData.ts !== lastTs) {
          setTaskInput(noteData.text);
          setLastTs(noteData.ts);
        }
      }

      let memData = [];
      if (memoryRes && memoryRes.ok) {
        memData = await memoryRes.json();
      }
      setMemories(Array.isArray(memData) ? memData : []);

    } catch (err) {
      console.error('Failed to fetch data', err);
    }
  };

  const handleSaveTask = async () => {
    setIsSaving(true);
    try {
      await fetch('http://localhost:4001/api/notepad', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: taskInput }),
      });
      await fetchData();
    } catch (err) {
      console.error('Failed to save task', err);
    } finally {
      setTimeout(() => setIsSaving(false), 800);
    }
  };

  return (
    <div className="min-h-screen p-6 md:p-10 max-w-7xl mx-auto flex flex-col gap-8">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-klaus-blue/20 rounded-2xl border border-klaus-blue/30 shadow-[0_0_15px_rgba(14,165,233,0.3)]">
            <BrainCircuit className="w-8 h-8 text-klaus-blue" />
          </div>
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight">Klaus <span className="text-gradient">Core</span></h1>
            <p className="text-slate-400 font-medium tracking-wide mt-1">Autonomous Agent Dashboard</p>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-3 glass-panel px-4 py-2">
            {agentStatus === 'working' ? (
              <>
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500"></span>
                </span>
                <span className="text-sm font-semibold text-orange-400 uppercase tracking-wider">Arbeitet</span>
              </>
            ) : agentStatus === 'online' ? (
              <>
                <span className="relative flex h-3 w-3">
                  <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
                <span className="text-sm font-semibold text-emerald-400 uppercase tracking-wider">Online</span>
              </>
            ) : (
              <>
                <span className="relative flex h-3 w-3">
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-slate-500"></span>
                </span>
                <span className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Schläft</span>
              </>
            )}
          </div>

          {activeTask && agentStatus !== 'offline' && (
            <button
              onClick={() => setActiveTab('kanban')}
              className="text-xs text-orange-300 bg-orange-500/10 hover:bg-orange-500/20 px-3 py-1.5 rounded-lg border border-orange-500/20 transition-all font-medium flex items-center gap-2"
            >
              Current Task: <span className="font-bold">{activeTask.title.length > 25 ? activeTask.title.substring(0, 25) + '...' : activeTask.title}</span>
            </button>
          )}
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="flex border-b border-white/10 gap-8">
        <button
          onClick={() => setActiveTab('kanban')}
          className={`pb-4 text-sm font-semibold tracking-wide transition-colors flex items-center gap-2 border-b-2 ${activeTab === 'kanban' ? 'border-klaus-blue text-klaus-blue' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
        >
          <Columns className="w-5 h-5" /> Kanban Board
        </button>
        <button
          onClick={() => setActiveTab('live')}
          className={`pb-4 text-sm font-semibold tracking-wide transition-colors flex items-center gap-2 border-b-2 ${activeTab === 'live' ? 'border-klaus-blue text-klaus-blue' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
        >
          <Activity className="w-5 h-5" /> Live Telemetry
        </button>
      </div>

      {/* Main Content Area */}
      <main>
        {activeTab === 'kanban' ? (
          <div className="h-[700px] glass-panel p-6">
            <KanbanBoard />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column: Directives & Notepad */}
            <div className="lg:col-span-2 space-y-8">
              <section className="glass-panel p-8 relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-klaus-blue to-klaus-indigo opacity-80" />
                <div className="flex items-center gap-3 mb-6">
                  <Terminal className="w-6 h-6 text-klaus-blue" />
                  <h2 className="text-2xl font-semibold text-slate-100">Active Directives (Notepad)</h2>
                </div>

                <div className="space-y-4">
                  <textarea
                    value={taskInput}
                    onChange={(e) => setTaskInput(e.target.value)}
                    placeholder="Give Klaus a new instruction or project to work on..."
                    className="w-full h-64 p-5 bg-slate-900/60 border border-slate-700/50 rounded-xl focus:border-klaus-blue/50 focus:ring-1 focus:ring-klaus-blue/50 transition-all outline-none text-slate-200 resize-none font-mono leading-relaxed"
                    spellCheck={false}
                  />
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-slate-500 font-mono">
                      {notepad.ts ? `Last modified: ${new Date(notepad.ts).toLocaleString()}` : 'No active directives'}
                    </div>
                    <button
                      onClick={handleSaveTask}
                      disabled={isSaving}
                      className="px-6 py-2.5 bg-gradient-to-r from-klaus-blue to-klaus-indigo hover:from-sky-400 hover:to-indigo-400 text-white font-semibold rounded-lg shadow-lg shadow-klaus-blue/25 hover:shadow-klaus-blue/40 transition-all flex items-center gap-2 active:scale-95 disabled:opacity-70"
                    >
                      {isSaving ? <CheckCircle2 className="w-5 h-5" /> : <Save className="w-5 h-5" />}
                      {isSaving ? 'Directives Sent' : 'Update Directives'}
                    </button>
                  </div>
                </div>
              </section>
            </div>

            {/* Right Column: Episodic Memory Stream */}
            <div className="space-y-8">
              <section className="glass-panel p-6 flex-1 flex flex-col h-[600px]">
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/5">
                  <div className="flex items-center gap-3">
                    <Activity className="w-5 h-5 text-klaus-indigo" />
                    <h2 className="text-xl font-semibold text-slate-100">Telemetry Stream</h2>
                  </div>
                  <div className="text-xs font-mono text-klaus-indigo px-2 py-1 bg-klaus-indigo/10 rounded">LOGS</div>
                </div>

                <div className="overflow-y-auto pr-2 space-y-4 flex-1 scrollbar-thin scrollbar-thumb-slate-700">
                  {memories.length === 0 ? (
                    <div className="text-center text-slate-500 mt-10 italic">No recent memories.</div>
                  ) : (
                    memories.map((mem: any) => (
                      <div key={mem.id} className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/30 hover:bg-slate-800/60 hover:border-klaus-blue/30 transition-colors group">
                        <div className="text-[10px] text-slate-500 font-mono mb-2 flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-600 group-hover:bg-klaus-blue transition-colors" />
                          {new Date(mem.createdAt).toLocaleString()}
                        </div>
                        <p className="text-sm text-slate-300 leading-relaxed font-light">{mem.summary}</p>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
