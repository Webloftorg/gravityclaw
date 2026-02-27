import cron from "node-cron";
import type OpenAI from "openai";

interface ScheduledTask {
    id: string;
    expression: string;
    description: string;
    task: cron.ScheduledTask;
}

const scheduledTasks = new Map<string, ScheduledTask>();

export const schedulerTools: OpenAI.Chat.ChatCompletionTool[] = [
    {
        type: "function",
        function: {
            name: "schedule_task",
            description: "Schedule a task using a cron expression. (e.g. '0 9 * * *' for every day at 9 AM).",
            parameters: {
                type: "object",
                properties: {
                    id: { type: "string", description: "Unique ID for this task" },
                    expression: { type: "string", description: "Standard cron expression" },
                    description: { type: "string", description: "Human readable description of what the task does" }
                },
                required: ["id", "expression", "description"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "list_scheduled_tasks",
            description: "List all active scheduled tasks.",
            parameters: { type: "object", properties: {} }
        }
    },
    {
        type: "function",
        function: {
            name: "delete_scheduled_task",
            description: "Delete/unschedule a task by its ID.",
            parameters: {
                type: "object",
                properties: {
                    id: { type: "string", description: "The ID of the task to delete" }
                },
                required: ["id"]
            }
        }
    }
];

export async function executeSchedulerTool(
    name: string,
    args: Record<string, any>,
    agentContext: { sendMessage: (msg: string) => Promise<void> }
): Promise<string> {
    if (name === "schedule_task") {
        const { id, expression, description } = args;

        if (!cron.validate(expression)) {
            return `❌ Error: Invalid cron expression "${expression}"`;
        }

        if (scheduledTasks.has(id)) {
            scheduledTasks.get(id)!.task.stop();
        }

        const task = cron.schedule(expression, async () => {
            console.log(`[scheduler] Running task ${id}: ${description}`);
            await agentContext.sendMessage(`🔔 *Scheduled Task Triggered:*\n${description}`);
        });

        scheduledTasks.set(id, { id, expression, description, task });
        return `✅ Task "${id}" scheduled: ${expression} (${description})`;

    } else if (name === "list_scheduled_tasks") {
        if (scheduledTasks.size === 0) return "No active scheduled tasks.";
        let out = "📋 *Active Scheduled Tasks:*\n";
        scheduledTasks.forEach(t => {
            out += `- **${t.id}**: \`${t.expression}\` — ${t.description}\n`;
        });
        return out;

    } else if (name === "delete_scheduled_task") {
        const { id } = args;
        const entry = scheduledTasks.get(id);
        if (entry) {
            entry.task.stop();
            scheduledTasks.delete(id);
            return `✅ Task "${id}" deleted.`;
        }
        return `❌ Error: Task "${id}" not found.`;
    }

    return `Error: Unknown scheduler tool ${name}`;
}
