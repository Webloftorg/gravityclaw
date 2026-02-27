/**
 * tools/dashboard.ts — Tools for interacting with the Mission Control Dashboard.
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { supabase } from "../memory/db.js";
import { bot } from "../bot.js";
import { ALLOWED_USER_IDS } from "../config.js";

const NOTEPAD_PATH = join(process.env.OPENCLAW_DIR || process.cwd(), "notepad.json");

export const readNotepadTool = {
    type: "function",
    function: {
        name: "read_notepad",
        description: "Liest den aktuellen Inhalt des Dashboard-Notepads (Manuelle Anweisungen des Nutzers).",
        parameters: { type: "object", properties: {} },
    },
} as const;

export const writeNotepadTool = {
    type: "function",
    function: {
        name: "write_notepad",
        description: "Aktualisiert das Dashboard-Notepad (z.B. für Statusberichte oder Erfolge).",
        parameters: {
            type: "object",
            properties: {
                text: { type: "string", description: "Der neue Text für das Notepad." },
            },
            required: ["text"],
        },
    },
} as const;

export const getBoardTasksTool = {
    type: "function",
    function: {
        name: "get_board_tasks",
        description: "Liest alle Aufgaben vom Kanban-Board aus den Spalten 'Geplant' und 'In Bearbeitung', absteigend sortiert nach Wichtigkeit (Fälligkeitsdatum und Priorität).",
        parameters: { type: "object", properties: {} },
    },
} as const;

export const updateTaskStatusTool = {
    type: "function",
    function: {
        name: "update_task_status",
        description: "Verschiebt eine Aufgabe auf dem Kanban-Board (z.B. nach 'In Bearbeitung' oder 'Review'). Wenn der Status 'Review' ist, wird automatisch der User auf Telegram benachrichtigt.",
        parameters: {
            type: "object",
            properties: {
                taskId: { type: "string", description: "Die ID der Aufgabe" },
                status: { type: "string", enum: ["Geplant", "In Bearbeitung", "Review", "Fertig"], description: "Der neue Status." },
                message: { type: "string", description: "Eine kurze Nachricht für den User (nur relevant, wenn der Status auf 'Review' gesetzt wird)." }
            },
            required: ["taskId", "status"],
        },
    },
} as const;

export const createBoardTaskTool = {
    type: "function",
    function: {
        name: "create_board_task",
        description: "Erstellt eine neue Aufgabe auf dem Kanban-Board (z.B. wenn der Nutzer sagt 'Füge X zu meiner ToDo-Liste hinzu' oder 'Erstelle einen Task für Y').",
        parameters: {
            type: "object",
            properties: {
                title: { type: "string", description: "Der prägnante Titel der Aufgabe." },
                description: { type: "string", description: "Details zur Aufgabe (kann eine Projektbeschreibung sein)." },
                priority: { type: "string", enum: ["Hoch", "Mittel", "Niedrig"], description: "Die Priorität der Aufgabe. Standard: Mittel." },
                scheduledAt: { type: "string", description: "Optionales Fälligkeitsdatum im ISO 8601 Format (YYYY-MM-DDTHH:mm)." }
            },
            required: ["title"],
        },
    },
} as const;

export function read_notepad(): string {
    try {
        if (!existsSync(NOTEPAD_PATH)) {
            return "Notepad is empty.";
        }
        const data = JSON.parse(readFileSync(NOTEPAD_PATH, "utf-8"));
        return data.text || "Notepad is empty.";
    } catch (err) {
        console.error("[dashboard] Error reading notepad:", err);
        return "Error: Could not read notepad.";
    }
}

export function write_notepad({ text }: { text: string }): string {
    try {
        const data = {
            text,
            ts: new Date().toISOString()
        };
        writeFileSync(NOTEPAD_PATH, JSON.stringify(data, null, 2));
        return "Notepad updated successfully.";
    } catch (err) {
        console.error("[dashboard] Error writing notepad:", err);
        return "Error: Could not update notepad.";
    }
}

export async function get_board_tasks(): Promise<string> {
    try {
        const { data: tasks, error } = await supabase
            .from('tasks')
            .select('*')
            .in('status', ['Geplant', 'In Bearbeitung']);

        if (error) {
            console.error("[dashboard] Supabase Error reading tasks:", error);
            return "Error: Could not read tasks from DB.";
        }

        if (!tasks || tasks.length === 0) return "Keine Aufgaben auf dem Board.";

        // Sorting in Javascript since Supabase order behavior with case statements is complex
        const priorityScore: Record<string, number> = { 'Hoch': 1, 'Mittel': 2, 'Niedrig': 3 };

        tasks.sort((a, b) => {
            const dateA = a.scheduledAt ? new Date(a.scheduledAt).getTime() : Infinity;
            const dateB = b.scheduledAt ? new Date(b.scheduledAt).getTime() : Infinity;

            if (dateA !== dateB) return dateA - dateB;

            const prioA = priorityScore[a.priority as string] || 4;
            const prioB = priorityScore[b.priority as string] || 4;
            return prioA - prioB;
        });

        return tasks.map((t: any) =>
            `ID: ${t.id} | Status: ${t.status} | Prio: ${t.priority} | Fällig: ${t.scheduledAt || 'Nein'}\nTitel: ${t.title}\nBeschreibung: ${t.description || '-'}\n`
        ).join("\n---\n");
    } catch (err) {
        console.error("[dashboard] Error reading tasks:", err);
        return "Error: Could not read tasks from DB.";
    }
}

export async function update_task_status(args: { taskId: string, status: string, message?: string }): Promise<string> {
    try {
        const { data, error } = await supabase
            .from('tasks')
            .update({ status: args.status })
            .eq('id', args.taskId)
            .select();

        if (error) {
            console.error("[dashboard] Error updating task in Supabase:", error);
            return "Error: Could not update task.";
        }

        if (!data || data.length === 0) {
            return `Fehler: Task ID ${args.taskId} nicht gefunden.`;
        }

        if (args.status === 'Review') {
            const { data: getTask, error: getError } = await supabase
                .from('tasks')
                .select('title')
                .eq('id', args.taskId)
                .single();

            const taskTitle = getError ? args.taskId : (getTask as any)?.title || args.taskId;

            for (const userId of ALLOWED_USER_IDS) {
                try {
                    await bot.api.sendMessage(userId, `🚀 *Task Review Ready:*\n${taskTitle}\n\nKlaus: ${args.message || 'Die Aufgabe ist fertig zur Überprüfung!'}`, { parse_mode: "Markdown" });
                } catch (e) {
                    console.error("Failed to send review TG message", e);
                }
            }
            return `Task ${args.taskId} aktualisiert auf Review. Nutzer wurde benachrichtigt!`;
        }

        return `Task ${args.taskId} erfolgreich auf '${args.status}' verschoben.`;
    } catch (err) {
        console.error("[dashboard] Error updating task:", err);
        return "Error: Could not update task.";
    }
}

import { randomUUID } from "crypto";

export async function create_board_task(args: { title: string, description?: string, priority?: string, scheduledAt?: string }): Promise<string> {
    try {
        const id = randomUUID();
        const { error } = await supabase
            .from('tasks')
            .insert({
                id,
                title: args.title,
                description: args.description || '',
                status: 'Geplant',
                priority: args.priority || 'Mittel',
                scheduledAt: args.scheduledAt || null
            });

        if (error) {
            console.error("[dashboard] Error creating task in Supabase:", error);
            return "Error: Could not create task.";
        }

        return `Task '${args.title}' erfolgreich im Kanban-Board in Spalte 'Geplant' erstellt.`;
    } catch (err) {
        console.error("[dashboard] Error creating task:", err);
        return "Error: Could not create task.";
    }
}
