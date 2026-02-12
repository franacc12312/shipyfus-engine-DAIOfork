import { useAgents } from '../hooks/useAgents';
import { useParticipants } from '../hooks/useParticipants';
import type { Agent, Participant } from '@daio/shared';

const STAGE_COLORS: Record<string, string> = {
  ideation: 'text-terminal-amber bg-terminal-amber/10 border-terminal-amber/30',
  branding: 'text-purple-400 bg-purple-400/10 border-purple-400/30',
  planning: 'text-terminal-cyan bg-terminal-cyan/10 border-terminal-cyan/30',
  development: 'text-terminal-green bg-terminal-green/10 border-terminal-green/30',
  deployment: 'text-blue-400 bg-blue-400/10 border-blue-400/30',
};

function ParticipantCard({ participant }: { participant: Participant }) {
  const color = '#60a5fa';
  const initial = participant.name.charAt(0).toUpperCase();

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-5 hover:border-zinc-600 transition-colors">
      <div className="flex items-start gap-4">
        {participant.avatar_url ? (
          <img
            src={participant.avatar_url}
            alt={participant.name}
            className="w-11 h-11 rounded-lg object-cover shrink-0"
          />
        ) : (
          <div
            className="w-11 h-11 rounded-lg flex items-center justify-center text-lg font-bold shrink-0"
            style={{ backgroundColor: `${color}20`, color }}
          >
            {initial}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-zinc-100 font-bold tracking-wide">{participant.name}</h3>
          </div>
          <span className="inline-block text-[9px] uppercase tracking-widest font-bold px-2 py-0.5 rounded border mt-1.5 text-amber-400 bg-amber-400/10 border-amber-400/30">
            Human
          </span>
        </div>
      </div>

      <p className="text-sm text-zinc-400 mt-4 leading-relaxed">{participant.role_title}</p>
    </div>
  );
}

function AgentCard({ agent }: { agent: Agent }) {
  const color = agent.characteristics.color ?? '#4ade80';
  const emoji = agent.characteristics.emoji ?? '';
  const tone = agent.characteristics.tone ?? '';
  const initial = agent.name.charAt(0).toUpperCase();
  const stageBadge = STAGE_COLORS[agent.stage] ?? 'text-zinc-400 bg-zinc-800 border-zinc-700';

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-5 hover:border-zinc-600 transition-colors">
      <div className="flex items-start gap-4">
        <div
          className="w-11 h-11 rounded-lg flex items-center justify-center text-lg font-bold shrink-0"
          style={{ backgroundColor: `${color}20`, color }}
        >
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-zinc-100 font-bold tracking-wide">{agent.name}</h3>
            {emoji && <span className="text-sm">{emoji}</span>}
          </div>
          <span
            className={`inline-block text-[9px] uppercase tracking-widest font-bold px-2 py-0.5 rounded border mt-1.5 ${stageBadge}`}
          >
            {agent.stage}
          </span>
        </div>
      </div>

      <p className="text-sm text-zinc-400 mt-4 leading-relaxed">{agent.role_description}</p>

      {tone && (
        <div className="mt-4 pt-3 border-t border-zinc-800">
          <span className="text-[10px] text-zinc-600 uppercase tracking-widest">Tone</span>
          <p className="text-xs text-zinc-500 mt-0.5">{tone}</p>
        </div>
      )}
    </div>
  );
}

function LoadingIndicator({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-zinc-500 text-sm">
      <span className="inline-block w-2 h-2 bg-terminal-green rounded-full animate-pulse" />
      {label}
    </div>
  );
}

export function Team() {
  const { agents, loading: agentsLoading } = useAgents();
  const { participants, loading: participantsLoading } = useParticipants();

  return (
    <div className="p-6">
      {/* Human Participants Section */}
      <div className="mb-8">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-zinc-100 tracking-wider">HUMAN TEAM</h2>
          <p className="text-xs text-zinc-500 mt-1">Human members of the studio</p>
        </div>

        {participantsLoading ? (
          <LoadingIndicator label="Loading team..." />
        ) : participants.length === 0 ? (
          <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-6 text-center">
            <p className="text-zinc-400 text-sm">No participants yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {participants.map((p) => (
              <ParticipantCard key={p.id} participant={p} />
            ))}
          </div>
        )}
      </div>

      {/* AI Agents Section */}
      <div>
        <div className="mb-4">
          <h2 className="text-lg font-bold text-zinc-100 tracking-wider">AI TEAM</h2>
          <p className="text-xs text-zinc-500 mt-1">AI agents powering the autonomous pipeline</p>
        </div>

        {agentsLoading ? (
          <LoadingIndicator label="Loading agents..." />
        ) : agents.length === 0 ? (
          <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-6 text-center">
            <p className="text-zinc-400 text-sm">No agents configured</p>
            <p className="text-zinc-600 text-xs mt-2">
              Agents are seeded in the database during setup
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {agents.map((agent) => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
