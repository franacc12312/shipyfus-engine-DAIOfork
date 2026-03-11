interface ScoreCardProps {
  viralPotential: number;
  executionEase: number;
  distributionClarity: number;
  moatScore: number;
  totalScore: number;
  marketVerdict?: string;
}

function getBadgeColor(score: number): string {
  if (score >= 4) return 'bg-terminal-green/20 text-terminal-green border-terminal-green/30';
  if (score >= 2) return 'bg-terminal-amber/20 text-terminal-amber border-terminal-amber/30';
  return 'bg-terminal-red/20 text-terminal-red border-terminal-red/30';
}

function getVerdictColor(verdict: string): string {
  switch (verdict) {
    case 'blue_ocean': return 'bg-terminal-green/20 text-terminal-green border-terminal-green/30';
    case 'weak_competitors': return 'bg-terminal-cyan/20 text-terminal-cyan border-terminal-cyan/30';
    case 'validated_demand': return 'bg-terminal-amber/20 text-terminal-amber border-terminal-amber/30';
    case 'crowded': return 'bg-terminal-red/20 text-terminal-red border-terminal-red/30';
    default: return 'bg-zinc-800 text-zinc-400 border-zinc-700';
  }
}

function getVerdictLabel(verdict: string): string {
  switch (verdict) {
    case 'blue_ocean': return 'BLUE OCEAN';
    case 'weak_competitors': return 'WEAK COMPETITORS';
    case 'validated_demand': return 'VALIDATED DEMAND';
    case 'crowded': return 'CROWDED';
    default: return verdict.toUpperCase();
  }
}

const METRICS: { key: keyof Omit<ScoreCardProps, 'totalScore' | 'marketVerdict'>; label: string }[] = [
  { key: 'viralPotential', label: 'Viral' },
  { key: 'executionEase', label: 'Execution' },
  { key: 'distributionClarity', label: 'Distribution' },
  { key: 'moatScore', label: 'Moat' },
];

export function ScoreCard({ viralPotential, executionEase, distributionClarity, moatScore, totalScore, marketVerdict }: ScoreCardProps) {
  const scores = { viralPotential, executionEase, distributionClarity, moatScore };
  const passesThreshold = totalScore >= 13;

  return (
    <div className="bg-zinc-950/50 border border-zinc-800 rounded-lg p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[9px] text-zinc-600 uppercase tracking-wider">Idea Score</span>
        <span className={`text-xs font-bold px-2 py-0.5 rounded border ${passesThreshold ? 'bg-terminal-green/20 text-terminal-green border-terminal-green/30' : 'bg-terminal-red/20 text-terminal-red border-terminal-red/30'}`}>
          {totalScore}/25 {passesThreshold ? '✓ PASS' : '✗ BELOW THRESHOLD'}
        </span>
        {marketVerdict && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getVerdictColor(marketVerdict)}`}>
            {getVerdictLabel(marketVerdict)}
          </span>
        )}
      </div>
      <div className="flex gap-2">
        {METRICS.map(({ key, label }) => (
          <div
            key={key}
            className={`flex items-center gap-1.5 px-2 py-1 rounded border text-[10px] font-mono ${getBadgeColor(scores[key])}`}
          >
            <span className="uppercase tracking-wider">{label}</span>
            <span className="font-bold">{scores[key]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
