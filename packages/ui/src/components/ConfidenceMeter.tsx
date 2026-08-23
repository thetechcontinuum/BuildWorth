export interface ConfidenceMeterProps {
  confidence: number; // 0 - 100
  isHypothesisOnly?: boolean;
}

export function ConfidenceMeter({ confidence, isHypothesisOnly }: ConfidenceMeterProps) {
  const getLevel = (c: number) => {
    if (c >= 75) return { label: "High Confidence", color: "text-emerald-400 bg-emerald-400/20" };
    if (c >= 50) return { label: "Moderate Confidence", color: "text-amber-400 bg-amber-400/20" };
    return { label: "Hypothesis (Low Evidence)", color: "text-rose-400 bg-rose-400/20" };
  };

  const level = getLevel(confidence);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-zinc-400 font-medium">Evidence Confidence</span>
        <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${level.color}`}>
          {isHypothesisOnly ? "Hypothesis" : level.label} ({confidence}%)
        </span>
      </div>
      <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-indigo-500 transition-all duration-300 rounded-full"
          style={{ width: `${Math.min(100, Math.max(0, confidence))}%` }}
        />
      </div>
    </div>
  );
}
