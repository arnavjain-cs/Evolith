import type { Skill } from "./skills";
export type Weights = Record<Skill, number>;
export type Recipe = {
  id: string;
  mode: string;
  weights: Weights;
  requested_weights: Weights;
  normalize: boolean;
  rank: number;
  merge_ms: number;
  cache_hit: boolean;
  method: string;
  artifact_available: boolean;
  created_at: string;
  sources: Record<string, string>;
  base_model: string;
  revision: string | null;
  provenance: string;
};
export type Status = {
  mode: "demo" | "live";
  base_model: string;
  ready: boolean;
  model_loaded: boolean;
  error: string | null;
  notice: string;
  available_skills?: Skill[];
  adapters: { skill: string; rank: number; revision: string; sha256: string }[];
};
export type Metrics = {
  output_tokens: number | null;
  input_tokens: number | null;
  generation_ms: number | null;
  tokens_per_second: number | null;
  device: string;
  adapter_switch_ms?: number | null;
  seed?: number;
  temperature?: number;
};
export type Run = {
  id: string;
  recipe_id: string;
  prompt: string;
  text: string;
  mode: string;
  provenance: string;
  metrics: Metrics;
  created_at: string;
};
export type Row = Run & {
  variant: string;
  task_id: string;
  task_name: string;
  skill: string;
  score: number | null;
  checks: Record<string, boolean>;
};
export type Job = {
  id: string;
  kind: "compare" | "benchmark";
  status: string;
  completed: number;
  total: number;
  mode: string;
  rows: Row[];
  error: string | null;
  rubric: string | null;
  summary: {
    variant: string;
    tasks: number;
    coding: number | null;
    writing: number | null;
    tokens_per_second: number | null;
  }[];
  created_at: string;
};
export type Preset = {
  id: string;
  name: string;
  description: string;
  coding: number;
  writing: number;
  humor?: number;
  thinking?: number;
};
export type History = { recipes: Recipe[]; runs: Run[]; jobs: Job[] };
