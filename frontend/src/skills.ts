import { Brain, Code2, PenLine, Smile } from "lucide-react";
import type { Weights } from "./types";

export const SKILL_IDS = ["coding", "humor", "thinking", "writing"] as const;
export type Skill = (typeof SKILL_IDS)[number];
export const SKILLS = [
  { id: "coding", label: "Coding", description: "Logic, structure & implementation", Icon: Code2 },
  { id: "humor", label: "Humor", description: "Wit, playfulness & personality", Icon: Smile },
  { id: "thinking", label: "Thinking", description: "Planning, problem solving & structure", Icon: Brain },
  { id: "writing", label: "Writing", description: "Clarity, expression & storytelling", Icon: PenLine },
] as const;
export const DEFAULT_WEIGHTS: Weights = { coding: 0.65, humor: 0, thinking: 0, writing: 0.35 };

/** Old two-skill recipes remain importable; newly added skills start switched off. */
export function weightsFrom(value: Partial<Weights>, defaults: Weights = DEFAULT_WEIGHTS): Weights {
  return Object.fromEntries(SKILL_IDS.map((id) => [id,
    Number.isFinite(value[id]) ? Math.max(0, Math.min(1, value[id]!)) : defaults[id],
  ])) as Weights;
}

export function normalized(weights: Weights): Weights {
  const total = SKILL_IDS.reduce((sum, id) => sum + weights[id], 0);
  return Object.fromEntries(SKILL_IDS.map((id) => [id, total ? weights[id] / total : 0])) as Weights;
}
