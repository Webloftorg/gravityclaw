import React, { useState, useEffect } from 'react';
import { X, Calendar, AlertCircle } from 'lucide-react';

interface Task {
    id?: string;
    title: string;
    description: string;
    status: string;
    priority: string;
    scheduledAt: string | null;
}

interface TaskModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (task: Partial<Task>) => void;
    initialData?: Task | null;
}

export function TaskModal({ isOpen, onClose, onSave, initialData }: TaskModalProps) {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [priority, setPriority] = useState('Mittel');
    const [scheduledAt, setScheduledAt] = useState('');

    useEffect(() => {
        if (initialData) {
            setTitle(initialData.title || '');
            setDescription(initialData.description || '');
            setPriority(initialData.priority || 'Mittel');

            // Convert ISO to datetime-local format
            if (initialData.scheduledAt) {
                try {
                    const dt = new Date(initialData.scheduledAt);
                    // format: YYYY-MM-DDThh:mm
                    const formatted = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                    setScheduledAt(formatted);
                } catch (e) {
                    setScheduledAt('');
                }
            } else {
                setScheduledAt('');
            }
        } else {
            setTitle('');
            setDescription('');
            setPriority('Mittel');
            setScheduledAt('');
        }
    }, [initialData, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) return;

        onSave({
            id: initialData?.id,
            title: title.trim(),
            description: description.trim(),
            priority,
            scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null
        });
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col">

                {/* Header */}
                <div className="px-6 py-4 flex items-center justify-between border-b border-white/10 bg-slate-800/50">
                    <h2 className="text-xl font-bold text-slate-100">
                        {initialData ? 'Task bearbeiten' : 'Neuer Task'}
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1.5">Titel</label>
                        <input
                            type="text"
                            autoFocus
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-klaus-blue focus:ring-1 focus:ring-klaus-blue"
                            placeholder="z.B. API Endpunkte fixen"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1.5">Beschreibung</label>
                        <textarea
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            rows={3}
                            className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-klaus-blue focus:ring-1 focus:ring-klaus-blue resize-none"
                            placeholder="Details zum Task..."
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1.5 flex items-center gap-1.5">
                                <AlertCircle className="w-4 h-4" /> Priorität
                            </label>
                            <select
                                value={priority}
                                onChange={e => setPriority(e.target.value)}
                                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-klaus-blue appearance-none"
                            >
                                <option value="Hoch">🔴 Hoch</option>
                                <option value="Mittel">🟡 Mittel</option>
                                <option value="Niedrig">🟢 Niedrig</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-emerald-400 mb-1.5 flex items-center gap-1.5">
                                <Calendar className="w-4 h-4" /> Fälligkeit (Optional)
                            </label>
                            <input
                                type="datetime-local"
                                value={scheduledAt}
                                onChange={e => setScheduledAt(e.target.value)}
                                className="w-full px-4 py-2.5 bg-slate-950 border border-emerald-500/50 rounded-lg text-emerald-100 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                            />
                        </div>
                    </div>

                    <div className="pt-4 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 text-slate-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors font-medium"
                        >
                            Abbrechen
                        </button>
                        <button
                            type="submit"
                            className="px-6 py-2.5 bg-gradient-to-r from-klaus-blue to-klaus-indigo hover:from-sky-500 hover:to-indigo-500 text-white rounded-lg shadow-lg font-medium transition-all active:scale-95"
                        >
                            Speichern
                        </button>
                    </div>
                </form>

            </div>
        </div>
    );
}
