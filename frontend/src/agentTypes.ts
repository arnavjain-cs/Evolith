import type { Recipe, Metrics } from './types';
export type AgentConfig = {
  name: string; goal: string; instructions: string; model_id: string; blueprint_id: string | null;
  tools: string[]; knowledge: string; max_new_tokens: number; temperature: number; capture_content: boolean;
};
export type ManagedModel = { id: string; name: string; parent_id: string | null; recipe_id: string; recipe: Recipe; created_at: string; branch_kind: string };
export type Agent = AgentConfig & { id: string; created_at: string; updated_at: string; status: 'ready' | 'paused'; version: number; parent_id: string | null; parent_version?: number };
export type Blueprint = Omit<AgentConfig, 'model_id' | 'blueprint_id'> & { id: string; builtin: boolean; source_version?: number; model_hint?: {base_model: string; weights: Record<string,number>} };
export type AgentRun = {
  id: string; created_at: string; finished_at?: string; agent_id: string; agent_name: string; agent_version: number;
  model_id: string; recipe_id: string; status: string; mode: string; task: string | null; output: string | null;
  duration_ms?: number; capture_content: boolean; error: string | null; provenance?: string; metrics?: Metrics;
  trace: {step: string; status: string; duration_ms: number; detail: string}[];
};
export type WorkspaceData = {
  agents: Agent[]; models: ManagedModel[]; blueprints: Blueprint[]; runs: AgentRun[];
  events: {id: string; action: string; subject_id: string; created_at: string; name?: string}[];
  tools: {id: string; name: string; description: string; available: boolean; access: string}[];
  mode: string; notice: string;
};
