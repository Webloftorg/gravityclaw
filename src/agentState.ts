export type AgentStatus = 'offline' | 'online' | 'working';

export const agentState = {
    status: 'online' as AgentStatus,
    currentTask: null as string | null
};
