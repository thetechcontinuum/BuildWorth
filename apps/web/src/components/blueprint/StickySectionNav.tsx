"use client";

import React, { useEffect, useState } from "react";

const SECTIONS = [
  { id: "section-executive-summary", label: "Executive Summary" },
  { id: "section-problem-workaround", label: "Problem & Workaround" },
  { id: "section-market-evidence", label: "Market Evidence" },
  { id: "section-customer-segments", label: "Customer Segments" },
  { id: "section-narrow-mvp", label: "Narrow MVP Scope" },
  { id: "section-competition", label: "Competition & Wedge" },
  { id: "section-tech-feasibility", label: "Technical Feasibility" },
  { id: "section-cost-benefit", label: "Cost-Benefit Economics" },
  { id: "section-financial-scenarios", label: "Financial Scenarios" },
  { id: "section-gtm-strategy", label: "GTM Strategy" },
  { id: "section-first-20", label: "First 20 Customers" },
  { id: "section-risks-assumptions", label: "Risks & Assumptions" },
  { id: "section-validation-roadmap", label: "Validation Roadmap" },
];

export function StickySectionNav() {
  const [activeSection, setActiveSection] = useState("section-executive-summary");

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 140;
      for (const section of SECTIONS) {
        const el = document.getElementById(section.id);
        if (el) {
          const top = el.offsetTop;
          const height = el.offsetHeight;
          if (scrollPosition >= top && scrollPosition < top + height) {
            setActiveSection(section.id);
            break;
          }
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      const yOffset = -80;
      const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  };

  return (
    <nav className="sticky top-16 z-30 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-800/80 py-2.5 px-4 overflow-x-auto no-scrollbar">
      <div className="max-w-7xl mx-auto flex items-center gap-1.5 sm:gap-2 text-xs font-mono">
        {SECTIONS.map((sec) => {
          const isActive = activeSection === sec.id;
          return (
            <button
              key={sec.id}
              onClick={() => scrollToSection(sec.id)}
              className={`px-3 py-1.5 rounded-lg transition-all duration-150 whitespace-nowrap ${
                isActive
                  ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/40 font-semibold"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 border border-transparent"
              }`}
            >
              {sec.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
