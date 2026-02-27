import React, { useState, useEffect } from 'react';
import { Plus, Calendar, Pencil, Trash2 } from 'lucide-react';
import { TaskModal } from './TaskModal';

interface Task {
    id: string;
    title: string;
    description: string;
    status: string;
    priority: string;
    scheduledAt: string | null;
    createdAt: string;
}

const COLUMNS = ['Geplant', 'In Bearbeitung', 'Review', 'Fertig'];

export function KanbanBoard() {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTask, setEditingTask] = useState<Task | null>(null);

    useEffect(() => {
        fetchTasks();
    }, []);

    const fetchTasks = async () => {
        try {
            const res = await fetch('http://localhost:4001/api/tasks');
            if (res.ok) setTasks(await res.json());
        } catch (err) {
            console.error("Failed to fetch tasks", err);
        }
    };

    const handleDragStart = (e: React.DragEvent, taskId: string) => {
        e.dataTransfer.setData('taskId', taskId);
    };

    const handleDrop = async (e: React.DragEvent, newStatus: string) => {
        e.preventDefault();
        const taskId = e.dataTransfer.getData('taskId');
        const task = tasks.find(t => t.id === taskId);
        if (!task || task.status === newStatus) return;

        // Optimistic update
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));

        try {
            await fetch(`http://localhost:4001/api/tasks/${taskId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });
            fetchTasks();
        } catch (err) {
            console.error("Failed to update status", err);
            fetchTasks(); // revert on fail
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault(); // needed to allow dropping
    };

    const saveTask = async (taskData: Partial<Task>) => {
        try {
            if (taskData.id) {
                // Edit
                await fetch(`http://localhost:4001/api/tasks/${taskData.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(taskData)
                });
            } else {
                // Create
                await fetch(`http://localhost:4001/api/tasks`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(taskData)
                });
            }
            fetchTasks();
        } catch (err) {
            console.error("Failed to save task", err);
        }
    };

    const deleteTask = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('Task löschen?')) return;
        try {
            await fetch(`http://localhost:4001/api/tasks/${id}`, { method: 'DELETE' });
            fetchTasks();
        } catch (err) {
            console.error("Failed to delete", err);
        }
    };

    const openNewTask = () => {
        setEditingTask(null);
        setIsModalOpen(true);
    };

    const openEditTask = (task: Task) => {
        setEditingTask(task);
        setIsModalOpen(true);
    };

    const getPriorityColor = (prio: string) => {
        switch (prio) {
            case 'Hoch': return 'text-red-400 bg-red-400/10 border-red-400/20';
            case 'Mittel': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
            case 'Niedrig': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
            default: return 'text-slate-400 bg-slate-400/10 border-slate-400/20';
        }
    };

    const isDueSoon = (dateStr: string | null) => {
        if (!dateStr) return false;
        const due = new Date(dateStr).getTime();
        const now = Date.now();
        // Due within 48 hours or overdue
        return due - now < 48 * 60 * 60 * 1000;
    };

    return (
        <div className="h-full flex flex-col">
            <div className="mb-6 flex justify-between items-center">
                <h2 className="text-2xl font-semibold text-slate-100">Work OS</h2>
                <button
                    onClick={openNewTask}
                    className="flex items-center gap-2 px-4 py-2 bg-klaus-blue hover:bg-sky-400 text-white rounded-lg shadow-lg shadow-klaus-blue/20 transition-all active:scale-95 font-medium"
                >
                    <Plus className="w-5 h-5" /> Task erstellen
                </button>
            </div>

            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 overflow-x-auto pb-4">
                {COLUMNS.map(col => (
                    <div
                        key={col}
                        className="flex flex-col bg-slate-900/40 rounded-2xl border border-white/5 overflow-hidden"
                        onDrop={(e) => handleDrop(e, col)}
                        onDragOver={handleDragOver}
                    >
                        <div className="p-4 border-b border-white/5 bg-slate-800/30 flex justify-between items-center">
                            <h3 className="font-semibold text-slate-300">{col}</h3>
                            <span className="text-xs font-mono bg-slate-800 text-slate-400 px-2 py-1 rounded-full">
                                {tasks.filter(t => t.status === col).length}
                            </span>
                        </div>

                        <div className="flex-1 p-4 space-y-4 overflow-y-auto min-h-[150px]">
                            {tasks.filter(t => t.status === col).map(task => (
                                <div
                                    key={task.id}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, task.id)}
                                    className="p-4 bg-slate-800/50 border border-slate-700/50 hover:border-klaus-blue/40 rounded-xl cursor-grab active:cursor-grabbing hover:bg-slate-800/80 transition-all shadow-md group relative"
                                >
                                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-all">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); openEditTask(task); }}
                                            className="p-1.5 bg-slate-800 hover:bg-klaus-blue/20 text-slate-400 hover:text-klaus-blue rounded transition-all"
                                            title="Task bearbeiten"
                                        >
                                            <Pencil className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            onClick={(e) => deleteTask(task.id, e)}
                                            className="p-1.5 bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded transition-all"
                                            title="Task löschen"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>

                                    <div className="flex flex-wrap gap-2 mb-3 pr-12">
                                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${getPriorityColor(task.priority)}`}>
                                            {task.priority}
                                        </span>
                                        {task.scheduledAt && (
                                            <span className={`text-[10px] font-bold tracking-wider px-2 py-0.5 rounded border flex items-center gap-1 ${isDueSoon(task.scheduledAt) ? 'text-red-400 bg-red-400/10 border-red-400/20' : 'text-slate-400 bg-slate-800/50 border-slate-700'}`}>
                                                <Calendar className="w-3 h-3" />
                                                {new Date(task.scheduledAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                            </span>
                                        )}
                                    </div>

                                    <h4 className="text-sm font-semibold text-slate-200 mb-1.5">{task.title}</h4>
                                    {task.description && (
                                        <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                                            {task.description}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            <TaskModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={saveTask}
                initialData={editingTask}
            />
        </div>
    );
}
