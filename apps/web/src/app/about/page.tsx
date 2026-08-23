import React from "react";
import { CheckCircle2 } from "lucide-react";

export const metadata = {
  title: "About Us & Vision — BuildWorth",
  description: "Our philosophy and commitment to evidence-backed startup market discovery.",
};

export default function AboutPage() {
  return (
    <div className="space-y-8 max-w-3xl mx-auto py-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-extrabold text-white tracking-tight">About BuildWorth</h1>
        <p className="text-zinc-400">
          The Startup Opportunity Radar transforming empirical signals into verifiable venture
          blueprints.
        </p>
      </div>

      <section className="space-y-4 text-sm text-zinc-300 leading-relaxed">
        <h2 className="text-lg font-bold text-white">
          The Problem with Generic AI Idea Generators
        </h2>
        <p>
          Most AI startup tools generate hallucinated ideas by combining buzzwords like{" "}
          <em>"Uber for AI agents"</em> without any grounding in observable market pain or buyer
          willingness to pay. Founders waste months building solutions looking for a problem.
        </p>
      </section>

      <section className="space-y-4 text-sm text-zinc-300 leading-relaxed">
        <h2 className="text-lg font-bold text-white">The BuildWorth Standard</h2>
        <p>
          BuildWorth was created to provide investor-grade, evidence-backed opportunity
          intelligence. We believe that:
        </p>
        <ul className="space-y-2 text-zinc-300">
          <li className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
            <span>
              <strong>Observable signals first:</strong> Every idea starts from real complaints,
              manual workarounds, and procurement notices.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
            <span>
              <strong>Decouple promise from proof:</strong> High market appeal must never be
              presented as validated without high evidence confidence.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
            <span>
              <strong>Zero synthetic statistics:</strong> If market size or competitor revenue is
              unverified, it is labeled as an explicit assumption.
            </span>
          </li>
        </ul>
      </section>
    </div>
  );
}
