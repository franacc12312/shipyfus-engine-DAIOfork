interface Competitor {
  name: string;
  url: string;
  similarity: 'high' | 'medium' | 'low';
}

export interface MarketAnalysisData {
  competitors: Competitor[];
  verdict: string;
  differentiationAngle: string;
  moatScore: number;
  moatReasoning: string;
}

function getSimilarityColor(similarity: string): string {
  switch (similarity) {
    case 'high': return 'bg-terminal-red/20 text-terminal-red border-terminal-red/30';
    case 'medium': return 'bg-terminal-amber/20 text-terminal-amber border-terminal-amber/30';
    case 'low': return 'bg-terminal-green/20 text-terminal-green border-terminal-green/30';
    default: return 'bg-zinc-800 text-zinc-400 border-zinc-700';
  }
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

function getMoatLabel(score: number): string {
  if (score >= 5) return 'AUTOPILOT';
  if (score >= 4) return 'STRONG COPILOT';
  if (score >= 3) return 'COPILOT';
  if (score >= 2) return 'THIN LAYER';
  return 'WRAPPER';
}

function getMoatColor(score: number): string {
  if (score >= 4) return 'bg-terminal-green/20 text-terminal-green border-terminal-green/30';
  if (score >= 3) return 'bg-terminal-amber/20 text-terminal-amber border-terminal-amber/30';
  return 'bg-terminal-red/20 text-terminal-red border-terminal-red/30';
}

export function MarketAnalysis({ data }: { data: MarketAnalysisData }) {
  return (
    <div className="bg-zinc-950/50 border border-zinc-800 rounded-lg p-3 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-[9px] text-zinc-600 uppercase tracking-wider">Market Analysis</span>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getVerdictColor(data.verdict)}`}>
          {getVerdictLabel(data.verdict)}
        </span>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getMoatColor(data.moatScore)}`}>
          MOAT {data.moatScore}/5 — {getMoatLabel(data.moatScore)}
        </span>
      </div>

      {/* Competitors */}
      {data.competitors.length > 0 && (
        <div>
          <div className="text-[9px] text-zinc-600 uppercase tracking-wider mb-1">Competitors</div>
          <div className="flex flex-wrap gap-1.5">
            {data.competitors.map((c, i) => (
              <a
                key={i}
                href={c.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] hover:opacity-80 transition ${getSimilarityColor(c.similarity)}`}
              >
                <span>{c.name}</span>
                <span className="opacity-60 uppercase">{c.similarity}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Differentiation */}
      <div>
        <div className="text-[9px] text-zinc-600 uppercase tracking-wider mb-0.5">Differentiation Angle</div>
        <div className="text-xs text-zinc-300">{data.differentiationAngle}</div>
      </div>

      {/* Moat Reasoning */}
      <div>
        <div className="text-[9px] text-zinc-600 uppercase tracking-wider mb-0.5">Moat Reasoning</div>
        <div className="text-xs text-zinc-400">{data.moatReasoning}</div>
      </div>
    </div>
  );
}
