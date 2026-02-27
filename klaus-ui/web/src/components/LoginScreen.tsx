import React, { useState } from 'react';
import { BrainCircuit } from 'lucide-react';

interface LoginScreenProps {
    onLogin: (user: { id: string; username: string }) => void;
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
    const [isRegistering, setIsRegistering] = useState(false);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        const endpoint = isRegistering ? '/api/auth/register' : '/api/auth/login';

        try {
            const res = await fetch(`http://localhost:4001${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Authentication failed');
            }

            onLogin(data.user);
        } catch (err: any) {
            setError(err.message);
        }
    };

    return (
        <div className="min-h-screen bg-klaus-bg flex items-center justify-center p-6">
            <div className="max-w-md w-full glass-panel p-8 rounded-3xl shadow-xl flex flex-col items-center">
                <div className="p-4 bg-klaus-blue/10 rounded-2xl border border-klaus-blue/20 mb-6">
                    <BrainCircuit className="w-12 h-12 text-klaus-blue" />
                </div>

                <h2 className="text-3xl font-extrabold text-klaus-text mb-2">Webloft <span className="text-gradient">Dashboard</span></h2>
                <p className="text-slate-500 font-medium mb-8">
                    Bitte logge dich ein, um fortzufahren
                </p>

                {error && (
                    <div className="w-full bg-red-100 border border-red-300 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm font-medium">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
                    <div>
                        <label className="block text-sm font-semibold text-slate-600 mb-1.5">Username</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-klaus-orange/50 focus:ring-2 focus:ring-klaus-orange/20 transition-all font-medium"
                            placeholder="e.g. Ben"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-600 mb-1.5">Passwort</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-klaus-orange/50 focus:ring-2 focus:ring-klaus-orange/20 transition-all font-medium"
                            placeholder="••••••••"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        className="w-full bg-klaus-orange hover:bg-klaus-orange-light text-white font-bold py-3 px-4 rounded-xl mt-4 transition-all active:scale-95 shadow-lg shadow-klaus-orange/20"
                    >
                        {isRegistering ? 'Account erstellen' : 'Einloggen'}
                    </button>
                </form>

                <p className="mt-6 text-sm text-slate-500">
                    {isRegistering ? 'Bereits ein Konto?' : 'Noch keinen Account?'}
                    <button
                        onClick={() => { setIsRegistering(!isRegistering); setError(''); }}
                        className="ml-1 text-klaus-orange font-semibold hover:underline"
                    >
                        {isRegistering ? 'Login' : 'Registrieren'}
                    </button>
                </p>
            </div>
        </div>
    );
}
