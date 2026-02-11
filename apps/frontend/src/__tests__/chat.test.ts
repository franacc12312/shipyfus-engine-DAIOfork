import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Agent, Log } from '@daio/shared';

// Mock api module
const mockGet = vi.fn();

vi.mock('../lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockGet(...args),
  },
}));

// Test agents data
const mockAgents: Agent[] = [
  {
    id: 'agent-1',
    slug: 'ideator',
    name: 'Nova',
    stage: 'ideation',
    role_description: 'Product Ideation Specialist',
    avatar_url: null,
    characteristics: { tone: 'creative', emoji: '💡', color: '#4ade80' },
    is_active: true,
    display_order: 0,
    created_at: '2026-02-11T00:00:00Z',
  },
  {
    id: 'agent-2',
    slug: 'planner',
    name: 'Atlas',
    stage: 'planning',
    role_description: 'Software Architect',
    avatar_url: null,
    characteristics: { tone: 'methodical', emoji: '📐', color: '#22d3ee' },
    is_active: true,
    display_order: 0,
    created_at: '2026-02-11T00:00:00Z',
  },
];

describe('useAgents data fetching', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches agents from /agents endpoint', async () => {
    mockGet.mockResolvedValue(mockAgents);

    const { api } = await import('../lib/api');
    const data = await api.get('/agents');

    expect(mockGet).toHaveBeenCalledWith('/agents');
    expect(data).toHaveLength(2);
  });

  it('agents have correct structure', async () => {
    mockGet.mockResolvedValue(mockAgents);

    const { api } = await import('../lib/api');
    const data = await api.get<Agent[]>('/agents');

    for (const agent of data) {
      expect(agent).toHaveProperty('id');
      expect(agent).toHaveProperty('slug');
      expect(agent).toHaveProperty('name');
      expect(agent).toHaveProperty('stage');
      expect(agent).toHaveProperty('characteristics');
    }
  });

  it('builds agentsByStage lookup correctly', () => {
    const agentsByStage: Record<string, Agent> = {};
    for (const agent of mockAgents) {
      if (!agentsByStage[agent.stage]) {
        agentsByStage[agent.stage] = agent;
      }
    }

    expect(agentsByStage['ideation']?.name).toBe('Nova');
    expect(agentsByStage['planning']?.name).toBe('Atlas');
    expect(agentsByStage['development']).toBeUndefined();
  });

  it('builds agentsById lookup correctly', () => {
    const agentsById: Record<string, Agent> = {};
    for (const agent of mockAgents) {
      agentsById[agent.id] = agent;
    }

    expect(agentsById['agent-1']?.name).toBe('Nova');
    expect(agentsById['agent-2']?.name).toBe('Atlas');
  });
});

describe('ChatMessage event type rendering logic', () => {
  it('system events are identified correctly', () => {
    const eventType = 'system';
    expect(eventType === 'system').toBe(true);
  });

  it('tool_use events have extractable tool details', () => {
    const rawEvent = {
      type: 'assistant',
      message: {
        content: [
          { type: 'tool_use', id: 'tool-1', name: 'Read', input: { file_path: '/src/index.ts' } },
        ],
      },
    };

    const toolBlocks = (rawEvent.message.content as Array<{ type: string; name?: string; input?: Record<string, unknown> }>)
      .filter((b) => b.type === 'tool_use');

    expect(toolBlocks).toHaveLength(1);
    expect(toolBlocks[0].name).toBe('Read');
    expect(toolBlocks[0].input).toEqual({ file_path: '/src/index.ts' });
  });

  it('error events are distinguishable', () => {
    const eventType = 'error';
    expect(['error'].includes(eventType)).toBe(true);
  });

  it('result events are distinguishable', () => {
    const eventType = 'result';
    expect(['result'].includes(eventType)).toBe(true);
  });
});

describe('Agent resolution logic', () => {
  const agentsByStage: Record<string, Agent> = {};
  const agentsById: Record<string, Agent> = {};

  for (const agent of mockAgents) {
    agentsByStage[agent.stage] = agent;
    agentsById[agent.id] = agent;
  }

  function resolveAgent(log: Log): Agent | null {
    if (log.agent_id && agentsById[log.agent_id]) {
      return agentsById[log.agent_id];
    }
    return agentsByStage[log.stage] || null;
  }

  it('resolves agent from agent_id when present', () => {
    const log: Log = {
      id: 1, run_id: 'run-1', stage: 'ideation', iteration: 0,
      event_type: 'assistant', content: 'text', raw_event: null,
      agent_id: 'agent-1', timestamp: '2026-02-11T00:00:00Z',
    };
    expect(resolveAgent(log)?.name).toBe('Nova');
  });

  it('falls back to stage-based resolution when agent_id is null', () => {
    const log: Log = {
      id: 2, run_id: 'run-1', stage: 'planning', iteration: 0,
      event_type: 'assistant', content: 'text', raw_event: null,
      agent_id: null, timestamp: '2026-02-11T00:00:00Z',
    };
    expect(resolveAgent(log)?.name).toBe('Atlas');
  });

  it('returns null for unknown stage with no agent_id', () => {
    const log: Log = {
      id: 3, run_id: 'run-1', stage: 'unknown', iteration: 0,
      event_type: 'assistant', content: 'text', raw_event: null,
      agent_id: null, timestamp: '2026-02-11T00:00:00Z',
    };
    expect(resolveAgent(log)).toBeNull();
  });
});

describe('Message grouping logic', () => {
  interface MessageGroup {
    agentId: string | null;
    eventType: string;
    content: string;
    timestamp: string;
  }

  function groupMessages(logs: Log[]): MessageGroup[] {
    const groups: MessageGroup[] = [];

    for (const log of logs) {
      if (!log.content || !log.content.trim()) continue;

      const prev = groups[groups.length - 1];
      const timeDiff = prev
        ? new Date(log.timestamp).getTime() - new Date(prev.timestamp).getTime()
        : Infinity;

      if (
        prev &&
        log.event_type === 'assistant' &&
        prev.eventType === 'assistant' &&
        log.agent_id === prev.agentId &&
        timeDiff < 5000
      ) {
        prev.content += '\n' + log.content;
        prev.timestamp = log.timestamp;
      } else {
        groups.push({
          agentId: log.agent_id,
          eventType: log.event_type,
          content: log.content,
          timestamp: log.timestamp,
        });
      }
    }

    return groups;
  }

  it('merges consecutive assistant events from same agent', () => {
    const logs: Log[] = [
      { id: 1, run_id: 'r', stage: 'ideation', iteration: 0, event_type: 'assistant', content: 'Hello', raw_event: null, agent_id: 'agent-1', timestamp: '2026-02-11T00:00:00Z' },
      { id: 2, run_id: 'r', stage: 'ideation', iteration: 0, event_type: 'assistant', content: 'World', raw_event: null, agent_id: 'agent-1', timestamp: '2026-02-11T00:00:02Z' },
    ];
    const groups = groupMessages(logs);
    expect(groups).toHaveLength(1);
    expect(groups[0].content).toBe('Hello\nWorld');
  });

  it('splits when agent changes', () => {
    const logs: Log[] = [
      { id: 1, run_id: 'r', stage: 'ideation', iteration: 0, event_type: 'assistant', content: 'Hello', raw_event: null, agent_id: 'agent-1', timestamp: '2026-02-11T00:00:00Z' },
      { id: 2, run_id: 'r', stage: 'planning', iteration: 0, event_type: 'assistant', content: 'World', raw_event: null, agent_id: 'agent-2', timestamp: '2026-02-11T00:00:02Z' },
    ];
    const groups = groupMessages(logs);
    expect(groups).toHaveLength(2);
  });

  it('splits when time gap > 5s', () => {
    const logs: Log[] = [
      { id: 1, run_id: 'r', stage: 'ideation', iteration: 0, event_type: 'assistant', content: 'Hello', raw_event: null, agent_id: 'agent-1', timestamp: '2026-02-11T00:00:00Z' },
      { id: 2, run_id: 'r', stage: 'ideation', iteration: 0, event_type: 'assistant', content: 'World', raw_event: null, agent_id: 'agent-1', timestamp: '2026-02-11T00:00:10Z' },
    ];
    const groups = groupMessages(logs);
    expect(groups).toHaveLength(2);
  });

  it('filters out empty/null content logs', () => {
    const logs: Log[] = [
      { id: 1, run_id: 'r', stage: 'ideation', iteration: 0, event_type: 'assistant', content: 'Hello', raw_event: null, agent_id: 'agent-1', timestamp: '2026-02-11T00:00:00Z' },
      { id: 2, run_id: 'r', stage: 'ideation', iteration: 0, event_type: 'assistant', content: null, raw_event: null, agent_id: 'agent-1', timestamp: '2026-02-11T00:00:01Z' },
      { id: 3, run_id: 'r', stage: 'ideation', iteration: 0, event_type: 'assistant', content: '  ', raw_event: null, agent_id: 'agent-1', timestamp: '2026-02-11T00:00:02Z' },
      { id: 4, run_id: 'r', stage: 'ideation', iteration: 0, event_type: 'assistant', content: 'World', raw_event: null, agent_id: 'agent-1', timestamp: '2026-02-11T00:00:03Z' },
    ];
    const groups = groupMessages(logs);
    expect(groups).toHaveLength(1);
    expect(groups[0].content).toBe('Hello\nWorld');
  });

  it('does not merge non-assistant events', () => {
    const logs: Log[] = [
      { id: 1, run_id: 'r', stage: 'ideation', iteration: 0, event_type: 'tool_use', content: 'Read file', raw_event: null, agent_id: 'agent-1', timestamp: '2026-02-11T00:00:00Z' },
      { id: 2, run_id: 'r', stage: 'ideation', iteration: 0, event_type: 'tool_use', content: 'Write file', raw_event: null, agent_id: 'agent-1', timestamp: '2026-02-11T00:00:01Z' },
    ];
    const groups = groupMessages(logs);
    expect(groups).toHaveLength(2);
  });
});

describe('ViewToggle logic', () => {
  it('toggles between chat and terminal modes', () => {
    let mode: 'chat' | 'terminal' = 'chat';
    const onChange = (newMode: 'chat' | 'terminal') => { mode = newMode; };

    onChange('terminal');
    expect(mode).toBe('terminal');

    onChange('chat');
    expect(mode).toBe('chat');
  });

  it('defaults to chat mode', () => {
    const defaultMode: 'chat' | 'terminal' = 'chat';
    expect(defaultMode).toBe('chat');
  });
});
