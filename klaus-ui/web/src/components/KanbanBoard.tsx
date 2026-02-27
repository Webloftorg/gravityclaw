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
    assignee?: string;
}

const COLUMNS = ['Geplant', 'In Bearbeitung', 'Review', 'Fertig'];

export function KanbanBoard({ currentUser }: { currentUser?: { id: string; username: string } }) {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [users, setUsers] = useState<{ id: string; username: string }[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTask, setEditingTask] = useState<Task | null>(null);
    const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);

    useEffect(() => {
        fetchTasks();
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const res = await fetch('http://localhost:4001/api/users');
            if (res.ok) setUsers(await res.json());
        } catch (err) {
            console.error("Failed to fetch users", err);
        }
    };

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

    const confirmDeleteTask = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setDeletingTaskId(id);
    };

    const executeDeleteTask = async () => {
        if (!deletingTaskId) return;
        try {
            await fetch(`http://localhost:4001/api/tasks/${deletingTaskId}`, { method: 'DELETE' });
            fetchTasks();
            setDeletingTaskId(null);
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
            case 'Hoch': return 'text-red-600 bg-red-100 border-red-200';
            case 'Mittel': return 'text-yellow-600 bg-yellow-100 border-yellow-200';
            case 'Niedrig': return 'text-emerald-600 bg-emerald-100 border-emerald-200';
            default: return 'text-slate-600 bg-slate-100 border-slate-200';
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
                <h2 className="text-2xl font-semibold text-klaus-text">Work OS</h2>
                <button
                    onClick={openNewTask}
                    className="flex items-center gap-2 px-4 py-2 bg-klaus-orange hover:bg-klaus-orange-light text-white rounded-lg shadow-lg shadow-klaus-orange/20 transition-all active:scale-95 font-medium"
                >
                    <Plus className="w-5 h-5" /> Task erstellen
                </button>
            </div>

            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 overflow-x-auto pb-4">
                {COLUMNS.map(col => (
                    <div
                        key={col}
                        className="flex flex-col bg-white/60 rounded-2xl border border-black/5 overflow-hidden shadow-sm"
                        onDrop={(e) => handleDrop(e, col)}
                        onDragOver={handleDragOver}
                    >
                        <div className="p-4 border-b border-black/5 bg-white flex justify-between items-center">
                            <h3 className="font-semibold text-klaus-text">{col}</h3>
                            <span className="text-xs font-mono bg-klaus-orange/10 text-klaus-orange px-2 py-1 rounded-full">
                                {tasks.filter(t => t.status === col).length}
                            </span>
                        </div>

                        <div className="flex-1 p-4 space-y-4 overflow-y-auto min-h-[150px]">
                            {tasks.filter(t => t.status === col).map(task => (
                                <div
                                    key={task.id}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, task.id)}
                                    className="p-4 bg-white border border-klaus-text/10 hover:border-klaus-orange/40 rounded-xl cursor-grab active:cursor-grabbing hover:bg-orange-50/50 transition-all shadow-sm group relative"
                                >
                                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-all">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); openEditTask(task); }}
                                            className="p-1.5 bg-slate-100 hover:bg-klaus-orange/20 text-slate-500 hover:text-klaus-orange rounded transition-all"
                                            title="Task bearbeiten"
                                        >
                                            <Pencil className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            onClick={(e) => confirmDeleteTask(task.id, e)}
                                            className="p-1.5 bg-slate-100 hover:bg-red-500/20 text-slate-500 hover:text-red-500 rounded transition-all"
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
                                            <span className={`text-[10px] font-bold tracking-wider px-2 py-0.5 rounded border flex items-center gap-1 ${isDueSoon(task.scheduledAt) ? 'text-red-600 bg-red-100 border-red-200' : 'text-slate-500 bg-slate-100 border-slate-200'}`}>
                                                <Calendar className="w-3 h-3" />
                                                {new Date(task.scheduledAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                            </span>
                                        )}
                                    </div>

                                    <h4 className="text-sm font-semibold text-klaus-text mb-1.5">{task.title}</h4>
                                    {task.description && (
                                        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-3">
                                            {task.description}
                                        </p>
                                    )}

                                    {task.assignee && task.assignee !== 'Unassigned' && (
                                        <div className="mt-2 flex items-center justify-end">
                                            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${task.assignee === 'id1234567'
                                                ? 'bg-klaus-orange/10 text-klaus-orange border-klaus-orange/20'
                                                : 'bg-slate-100 text-slate-600 border-slate-200'
                                                }`}>
                                                {users.find(u => u.id === task.assignee)?.username || task.assignee}
                                            </span>
                                        </div>
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
                users={users}
                currentUser={currentUser}
            />

            {/* Custom Delete Confirmation Modal */}
            {deletingTaskId && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl flex flex-col gap-2 transform transition-all">
                        <h3 className="text-xl font-bold text-slate-800">Task löschen</h3>
                        <p className="text-sm text-slate-600 mb-4">Möchtest du diesen Task wirklich endgültig löschen? Diese Aktion kann nicht rückgängig gemacht werden.</p>
                        <div className="flex items-center justify-end gap-3 mt-2">
                            <button
                                onClick={() => setDeletingTaskId(null)}
                                className="px-4 py-2 hover:bg-slate-100 text-slate-700 rounded-lg font-semibold transition-colors"
                            >
                                Abbrechen
                            </button>
                            <button
                                onClick={executeDeleteTask}
                                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold shadow-lg shadow-red-500/20 transition-colors"
                            >
                                Unwiderruflich Löschen
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
