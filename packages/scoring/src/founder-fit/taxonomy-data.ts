export interface TaxonomySkillItem {
  key: string;
  displayName: string;
  category: string;
  description: string;
  aliases: string[];
}

export const INITIAL_SKILL_TAXONOMY: TaxonomySkillItem[] = [
  {
    key: "TYPESCRIPT",
    displayName: "TypeScript",
    category: "ENGINEERING",
    description: "Typed JavaScript development for full-stack apps",
    aliases: ["ts", "typescript", "type-script"],
  },
  {
    key: "JAVASCRIPT",
    displayName: "JavaScript",
    category: "ENGINEERING",
    description: "Modern JS web development",
    aliases: ["js", "es6", "vanilla js"],
  },
  {
    key: "REACT",
    displayName: "React",
    category: "ENGINEERING",
    description: "Frontend UI component architecture",
    aliases: ["reactjs", "react.js"],
  },
  {
    key: "NEXTJS",
    displayName: "Next.js",
    category: "ENGINEERING",
    description: "Server-side rendering and full-stack React framework",
    aliases: ["next", "next.js"],
  },
  {
    key: "NODEJS",
    displayName: "Node.js",
    category: "ENGINEERING",
    description: "Backend JavaScript runtime and API servers",
    aliases: ["node", "node.js"],
  },
  {
    key: "PYTHON",
    displayName: "Python",
    category: "ENGINEERING",
    description: "Scripting, backend development, and data tooling",
    aliases: ["py", "python3"],
  },
  {
    key: "POSTGRESQL",
    displayName: "PostgreSQL",
    category: "ENGINEERING",
    description: "Relational database modeling, indexing, and SQL",
    aliases: ["postgres", "pgsql", "psql"],
  },
  {
    key: "DEVOPS",
    displayName: "DevOps & CI/CD",
    category: "ENGINEERING",
    description: "Containerization, automated deployment pipelines, and Linux administration",
    aliases: ["docker", "ci/cd", "github actions"],
  },
  {
    key: "CLOUD_INFRASTRUCTURE",
    displayName: "Cloud Infrastructure",
    category: "ENGINEERING",
    description: "AWS, GCP, or serverless infrastructure orchestration",
    aliases: ["aws", "gcp", "cloud", "terraform"],
  },
  {
    key: "AI_INTEGRATION",
    displayName: "AI & LLM Integration",
    category: "AI_DATA",
    description: "Prompt engineering, LLM orchestration, and vector retrieval",
    aliases: ["llm", "ai", "langchain", "rag"],
  },
  {
    key: "MACHINE_LEARNING",
    displayName: "Machine Learning",
    category: "AI_DATA",
    description: "Model training, fine-tuning, and feature engineering",
    aliases: ["ml", "pytorch", "tensorflow"],
  },
  {
    key: "DATA_ENGINEERING",
    displayName: "Data Engineering",
    category: "AI_DATA",
    description: "ETL pipelines, data warehousing, and batch processing",
    aliases: ["data pipeline", "etl", "airflow"],
  },
  {
    key: "UX_DESIGN",
    displayName: "UX / UI Design",
    category: "DESIGN",
    description: "User interface design, wireframing, and user research",
    aliases: ["ui/ux", "figma", "product design"],
  },
  {
    key: "PRODUCT_MANAGEMENT",
    displayName: "Product Management",
    category: "PRODUCT",
    description: "Feature prioritization, user journey mapping, and roadmap planning",
    aliases: ["pm", "product roadmap"],
  },
  {
    key: "B2B_SALES",
    displayName: "B2B Sales",
    category: "SALES",
    description: "Direct sales discovery, qualification, and closing",
    aliases: ["sales", "direct sales", "outbound sales"],
  },
  {
    key: "ENTERPRISE_SALES",
    displayName: "Enterprise Sales",
    category: "SALES",
    description: "Multi-stakeholder procurement and high-ACV contract navigation",
    aliases: ["enterprise", "strategic sales"],
  },
  {
    key: "FOUNDER_LED_SALES",
    displayName: "Founder-Led Sales",
    category: "SALES",
    description: "First 10-20 customer cold outreach and founder demos",
    aliases: ["founder sales", "early customer acquisition"],
  },
  {
    key: "CONTENT_MARKETING",
    displayName: "Content Marketing & SEO",
    category: "MARKETING",
    description: "Technical blogging, SEO growth, and inbound distribution",
    aliases: ["seo", "content", "copywriting"],
  },
  {
    key: "PAID_ACQUISITION",
    displayName: "Paid Acquisition",
    category: "MARKETING",
    description: "Search and social performance marketing channels",
    aliases: ["paid ads", "sem", "google ads"],
  },
  {
    key: "COMMUNITY_BUILDING",
    displayName: "Community Building",
    category: "MARKETING",
    description: "Developer and user community management and advocacy",
    aliases: ["devrel", "community", "social audience"],
  },
  {
    key: "SECURITY",
    displayName: "Application Security",
    category: "SECURITY",
    description: "Auth, vulnerability scanning, and secure API boundaries",
    aliases: ["appsec", "infosec", "cybersecurity"],
  },
  {
    key: "COMPLIANCE",
    displayName: "Regulatory Compliance",
    category: "COMPLIANCE",
    description: "SOC2, HIPAA, GDPR, and data governance frameworks",
    aliases: ["soc2", "gdpr", "hipaa", "regulatory"],
  },
  {
    key: "FINANCE_OPS",
    displayName: "Finance & FinOps",
    category: "OPERATIONS",
    description: "Unit economics modeling, billing integration, and cost controls",
    aliases: ["finops", "billing", "pricing ops"],
  },
  {
    key: "CUSTOMER_SUCCESS",
    displayName: "Customer Success",
    category: "OPERATIONS",
    description: "User onboarding, retention tracking, and technical support",
    aliases: ["support", "retention", "cx"],
  },
];

export function normalizeSkillKey(input: string): string {
  const normalized = input.trim().toLowerCase();
  for (const item of INITIAL_SKILL_TAXONOMY) {
    if (item.key.toLowerCase() === normalized) return item.key;
    if (item.displayName.toLowerCase() === normalized) return item.key;
    if (item.aliases.some((a) => a.toLowerCase() === normalized)) return item.key;
  }
  return input.toUpperCase().replace(/[^A-Z0-9_]/g, "_");
}
