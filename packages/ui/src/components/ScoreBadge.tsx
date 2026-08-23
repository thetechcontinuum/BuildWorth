export interface ScoreBadgeProps {
  score: number; // 0 - 100
  label?: string;
  size?: "sm" | "md" | "lg";
}

export function ScoreBadge({ score, label = "Opportunity Score", size = "md" }: ScoreBadgeProps) {
  const getScoreColor = (val: number) => {
    if (val >= 80) return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
    if (val >= 65) return "bg-amber-500/10 text-amber-400 border-amber-500/30";
    return "bg-zinc-500/10 text-zinc-400 border-zinc-500/30";
  };

  const sizeClasses = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-3 py-1 text-sm font-medium",
    lg: "px-4 py-2 text-base font-semibold",
  }[size];

  return (
    <div
      className={`inline-flex items-center gap-2 border rounded-full font-mono ${getScoreColor(score)} ${sizeClasses}`}
    >
      <span className="text-zinc-400 font-sans">{label}</span>
      <span className="font-bold">{Math.round(score)}/100</span>
    </div>
  );
}
