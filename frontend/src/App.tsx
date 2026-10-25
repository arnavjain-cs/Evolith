import { useEffect, useRef, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  Copy,
  Cpu,
  FlaskConical,
  GitBranch,
  Layers3,
  Moon,
  Play,
  Plus,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Terminal,
  Unplug,
  X,
} from "lucide-react";
import { download, readConnection, request, saveJSON } from "./api";
import type { Connection } from "./api";
import type {
  History,
  Job,
  Preset,
  Recipe,
  Run,
  Status,
  Weights,
} from "./types";
import { Badge, Button, Empty, Metric } from "./ui";
import { Output } from "./Output";
import { SKILLS, SKILL_IDS, DEFAULT_WEIGHTS, weightsFrom, normalized } from "./skills";

const DEFAULT_PROMPT =
  "Write a Python function that normalizes a list of numbers to sum to one. Handle an empty list and a zero total. Explain the approach clearly.";
const SAMPLES = [
  { name: "Code + explain", text: DEFAULT_PROMPT },
  {
    name: "Launch copy",
    text: "Write a short launch announcement for Evolith, a tool for blending compatible AI skill adapters.",
  },
  { name: "A little humor", text: "Write a funny joke about an AI with four skill sliders." },
  { name: "Think it through", text: "Plan a hackathon project in five clear steps." },
  {
    name: "Explain LoRA",
    text: "Explain LoRA adapters to a beginner using a simple analogy, then give the weighted merge equation.",
  },
];
const FALLBACK_PRESETS: Preset[] = [
  {
    id: "balanced",
    name: "Balanced",
    description: "Equal influence from both specialists",
    coding: 0.5,
    writing: 0.5,
  },
  {
    id: "builder",
    name: "The builder",
    description: "Implementation first, with clear explanations",
    coding: 0.8,
    writing: 0.2,
  },
  {
    id: "storyteller",
    name: "The storyteller",
    description: "Expressive prose with a technical foundation",
    coding: 0.2,
    writing: 0.8,
  },
  { id: "inventor", name: "The inventor", description: "Code, wit, planning and a clear voice", coding: .4, humor: .15, thinking: .3, writing: .15 },
  { id: "comedian", name: "The comedian", description: "A playful voice", coding: 0, humor: .7, thinking: .1, writing: .2 },
  { id: "strategist", name: "The strategist", description: "Planning first", coding: .15, humor: 0, thinking: .65, writing: .2 },
  {
    id: "baseline",
    name: "Base model",
    description: "No adapter influence",
    coding: 0,
    writing: 0,
  },
];
const TERMINAL_STATES = ["completed", "cancelled", "failed", "interrupted"];

function storedWeights(): Weights {
  try { return weightsFrom(JSON.parse(localStorage.getItem("modelforge-weights") || "{}")); }
  catch { return { ...DEFAULT_WEIGHTS }; }
}

export default function App() {
  const [page, setPage] = useState("forge");
  const [status, setStatus] = useState<Status | null>(null);
  const [connection, setConnection] = useState<Connection>(readConnection);
  const [weights, setWeights] = useState<Weights>(storedWeights);
  const [normalize, setNormalize] = useState(true);
  const [presets, setPresets] = useState(FALLBACK_PRESETS);
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [history, setHistory] = useState<History>({
    recipes: [],
    runs: [],
    jobs: [],
  });
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [maxTokens, setMaxTokens] = useState(256);
  const [temperature, setTemperature] = useState(0);
  const [seed, setSeed] = useState(42);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [theme, setTheme] = useState(
    () => localStorage.getItem("modelforge-theme") || "light",
  );
  const dialog = useRef<HTMLDialogElement>(null);
  const connectionButton = useRef<HTMLButtonElement>(null);
  const importInput = useRef<HTMLInputElement>(null);
  const activeJob = job && !TERMINAL_STATES.includes(job.status);
  const total = SKILL_IDS.reduce((sum, id) => sum + weights[id], 0);
  const effective = normalize ? normalized(weights) : weights;
  const codingShare = total ? (weights.coding / total) * 100 : 0;

  async function sync(conn = readConnection()) {
    const result = await request<Status>("/status", undefined, conn);
    setStatus(result);
    const [p, h] = await Promise.all([
      request<Preset[]>("/presets", undefined, conn),
      request<History>("/history", undefined, conn),
    ]);
    setPresets(p);
    if (result.mode === "live") setWeights((current) => {
      const next = Object.fromEntries(SKILL_IDS.map((id) => [id,
        (result.available_skills || ["coding", "writing"]).includes(id) ? current[id] : 0,
      ])) as Weights;
      return SKILL_IDS.some((id) => next[id] !== current[id]) ? next : current;
    });
    setHistory(h);
  }
  useEffect(() => {
    sync().catch((e) => setError(`Backend unavailable. ${e.message}`));
  }, []);
  useEffect(() => {
    localStorage.setItem("modelforge-weights", JSON.stringify(weights));
    setRecipe(null);
  }, [weights, normalize]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("modelforge-theme", theme);
  }, [theme]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(id);
  }, [toast]);
  useEffect(() => {
    if (!job || TERMINAL_STATES.includes(job.status)) return;
    let cancelled = false;
    const timer = setInterval(async () => {
      try {
        const next = await request<Job>(`/jobs/${job.id}`);
        if (!cancelled) {
          setJob(next);
          if (TERMINAL_STATES.includes(next.status)) {
            clearInterval(timer);
            sync().catch(() => {});
          }
        }
      } catch (e) {
        if (!cancelled) {
          setError((e as Error).message);
          clearInterval(timer);
        }
      }
    }, 900);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [job?.id, job?.status]);

  async function action(label: string, fn: () => Promise<void>) {
    setBusy(label);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function forge() {
    const result = await request<Recipe>("/merge", { weights, normalize });
    setRecipe(result);
    return result;
  }
  async function generate() {
    await action("generate", async () => {
      const selected = recipe || (await forge());
      const result = await request<Run>("/generate", {
        recipe_id: selected.id,
        prompt,
        max_new_tokens: maxTokens,
        temperature,
        seed,
      });
      setRun(result);
      await sync();
    });
  }
  async function submit(kind: "compare" | "benchmark") {
    await action(kind, async () => {
      const selected = recipe || (await forge());
      const result = await request<Job>("/jobs", {
        kind,
        recipe_id: selected.id,
        prompt,
        max_new_tokens:
          kind === "benchmark" ? Math.min(maxTokens, 192) : maxTokens,
        temperature,
        seed,
      });
      setJob(result);
      if (kind === "benchmark") setPage("benchmarks");
    });
  }
  async function connect(event: FormEvent) {
    event.preventDefault();
    await action("connect", async () => {
      const url = connection.url.trim().replace(/\/$/, "");
      if (url && !/^https?:\/\//.test(url))
        throw new Error("Enter an http:// or https:// backend URL.");
      const conn = { ...connection, url };
      await sync(conn);
      sessionStorage.setItem("modelforge-connection", JSON.stringify(conn));
      setRecipe(null);
      setRun(null);
      setJob(null);
      dialog.current?.close();
      setToast("Backend connected");
    });
  }
  async function copy(text: string) {
    await action("copy", async () => {
      await navigator.clipboard.writeText(text);
      setToast("Copied to clipboard");
    });
  }
  async function importRecipe(file: File) {
    await action("import", async () => {
      if (file.size > 100000)
        throw new Error("Recipe JSON must be smaller than 100 KB.");
      const value = JSON.parse(await file.text());
      const w = value.requested_weights || value.weights;
      if (
        !w ||
        !SKILL_IDS.every(
          (k) =>
            ((k === "humor" || k === "thinking") && w[k] === undefined) ||
            (typeof w[k] === "number" &&
            Number.isFinite(w[k]) &&
            w[k] >= 0 &&
            w[k] <= 1),
        )
      )
        throw new Error(
          "Recipe weights must be numbers between 0 and 1.",
        );
      setWeights(weightsFrom(w, { coding: 0, humor: 0, thinking: 0, writing: 0 }));
      setNormalize(value.normalize !== false);
      setToast("Recipe weights imported. Forge to apply them to this backend.");
      setPage("forge");
    });
  }
  const disabled = !!busy || !!activeJob || !status?.ready;

  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">
        Skip to workspace
      </a>
      <aside className="sidebar">
        <a
          href="#"
          className="brand"
          onClick={(e) => {
            e.preventDefault();
            window.location.hash = "";
          }}
          aria-label="Evolith home"
        >
          <span className="brand-icon">
            <Layers3 size={21} />
          </span>
          <span>
            Evolith<span className="brand-caption">THE ADAPTER LAB</span>
          </span>
        </a>
        <div className="workspace-label">
          WORKSPACE <span>01</span>
        </div>
        <nav aria-label="Workspace">
          <a href="#agents" aria-label="Agent workspace" title="Agent workspace" className="nav-item" style={{textDecoration: "none"}}><Layers3 size={18}/><span>Agent workspace</span><ArrowRight size={14}/></a>
          {[
            ["forge", "Model studio", SlidersHorizontal],
            ["benchmarks", "Benchmarks", Activity],
            ["history", "Activity log", GitBranch],
            ["guide", "Field guide", BookOpen],
          ].map(([id, label, Icon]) => {
            const NavIcon = Icon as typeof Activity;
            return (
              <button
                key={id as string}
                aria-label={label as string}
                title={label as string}
                className={`nav-item ${page === id ? "selected" : ""}`}
                aria-current={page === id ? "page" : undefined}
                onClick={() => setPage(id as string)}
              >
                <NavIcon size={18} />
                <span>{label as string}</span>
                {page === id && <ChevronRight size={14} />}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="lab-note">
            <FlaskConical size={21} />
            <strong>
              Small updates.
              <br />
              New possibilities.
            </strong>
            <p>Train your specialists once. Explore combinations live.</p>
            <button className="text-button" onClick={() => setPage("guide")}>
              The workflow <ArrowRight size={14} />
            </button>
          </div>
          <button
            className="theme-toggle"
            aria-label={`${theme === "light" ? "Dark" : "Light"} appearance`}
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          >
            {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
            <span>{theme === "light" ? "Dark" : "Light"} appearance</span>
          </button>
          <span className="version">EVOLITH / V1.0</span>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <ChevronRight size={13} />
            <strong>
              {page === "forge"
                ? "Model studio"
                : page === "history"
                  ? "Activity log"
                  : page === "guide"
                    ? "Field guide"
                    : "Benchmarks"}
            </strong>
          </div>
          <div className="header-actions">
            <Badge tone={status?.mode === "live" ? "success" : "neutral"}>
              <span className={`status-dot ${status ? "" : "offline"}`} />
              {status
                ? status.mode === "live"
                  ? "Live backend"
                  : "Rehearsal mode"
                : "Disconnected"}
            </Badge>
            <Button
              variant="ghost"
              ref={connectionButton}
              onClick={() => dialog.current?.showModal()}
              aria-label="Connection settings"
            >
              <Settings2 size={18} />
            </Button>
          </div>
        </header>
        <main id="main">
          {error && (
            <div role="alert" className="notice error">
              <Unplug size={18} />
              <span>{error}</span>
              <Button
                variant="ghost"
                aria-label="Dismiss error"
                onClick={() => setError("")}
              >
                <X size={16} />
              </Button>
            </div>
          )}
          <div
            className={`notice ${status?.mode === "live" ? "live-notice" : ""}`}
          >
            <ShieldCheck size={17} />
            <span>
              {status?.notice ||
                "Start the backend with the included run script, then connect to your workspace."}
            </span>
            {status?.mode === "demo" && (
              <button className="text-button" onClick={() => setPage("guide")}>
                Go live <ArrowRight size={14} />
              </button>
            )}
          </div>
          {page === "forge" && (
            <>
              <section className="hero">
                <div>
                  <div className="eyebrow">
                    <span /> COMPOSE. COMPARE. DISCOVER.
                  </div>
                  <h1>
                    One foundation.
                    <br />
                    <span>Your combination.</span>
                  </h1>
                  <p>
                    Coding. Humor. Thinking. Writing. Make your own mix.
                    <br className="desktop-break" /> Build a model recipe that
                    feels like yours.
                  </p>
                </div>
                <div className="hero-stamp" aria-hidden="true">
                  <Layers3 size={40} strokeWidth={1.2} />
                  <span>
                    BUILT FROM
                    <br />
                    COMPATIBLE PARTS
                  </span>
                  <div className="stamp-grid" />
                </div>
              </section>
              <div className="studio-grid">
                <section
                  className="card composition"
                  aria-labelledby="blend-heading"
                >
                  <div className="section-heading">
                    <div>
                      <span className="step">01 / COMPOSE</span>
                      <h2 id="blend-heading">Find your balance</h2>
                    </div>
                    <SlidersHorizontal size={20} />
                  </div>
                  <div className="base-model">
                    <span className="base-icon">
                      <Cpu size={20} />
                    </span>
                    <div>
                      <span>SHARED FOUNDATION</span>
                      <strong>
                        {status?.base_model.split("/").pop() ||
                          "Qwen2.5-0.5B-Instruct"}
                      </strong>
                    </div>
                    <ShieldCheck size={17} />
                  </div>
                  <div className="skills">
                    {SKILLS.map(({ id: skill, label, description, Icon }) => (
                      <div className={`skill ${skill}`} key={skill}>
                        <div className="skill-header">
                          <div>
                            <span className="skill-icon">
                              <Icon size={18} />
                            </span>
                            <label htmlFor={`${skill}-slider`}>
                              {label}
                              <small>
                                {description}
                              </small>
                            </label>
                          </div>
                          <output htmlFor={`${skill}-slider`}>
                            {Math.round(weights[skill] * 100)}
                            <span>%</span>
                          </output>
                        </div>
                        <input
                          id={`${skill}-slider`}
                          type="range"
                          min="0"
                          max="100"
                          value={Math.round(weights[skill] * 100)}
                          style={
                            {
                              "--range-fill": `${weights[skill] * 100}%`,
                            } as CSSProperties
                          }
                          onChange={(e) =>
                            setWeights({
                              ...weights,
                              [skill]: Number(e.target.value) / 100,
                            })
                          }
                          aria-describedby={`${skill}-help`}
                          disabled={!!busy || !!activeJob || (status?.mode === "live" && !(status.available_skills || ["coding", "writing"]).includes(skill))}
                        />
                        <div className="range-labels" id={`${skill}-help`}>
                          <span>Off</span>
                          <span>{status?.mode === "live" && !(status.available_skills || ["coding", "writing"]).includes(skill) ? "Train this adapter to enable" : "Full influence"}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={normalize}
                      onChange={(e) => setNormalize(e.target.checked)}
                      disabled={!!busy || !!activeJob}
                    />
                    <span>Normalize coefficients to sum to 1</span>
                  </label>
                  <div className="preset-header">
                    <span>START WITH A PRESET</span>
                    <button
                      className="text-button"
                      onClick={() => importInput.current?.click()}
                      disabled={!!busy || !!activeJob}
                    >
                      Import <Plus size={13} />
                    </button>
                    <input
                      ref={importInput}
                      type="file"
                      accept="application/json,.json"
                      hidden
                      aria-label="Import recipe JSON"
                      onChange={(e) => {
                        if (e.target.files?.[0])
                          importRecipe(e.target.files[0]);
                        e.target.value = "";
                      }}
                    />
                  </div>
                  <div className="presets">
                    {presets.map((p) => (
                      <button
                        key={p.id}
                        title={p.description}
                        disabled={!!busy || !!activeJob || (status?.mode === "live" && SKILL_IDS.some((id) => (p[id] || 0) > 0 && !(status.available_skills || ["coding", "writing"]).includes(id)))}
                        className={
                          SKILL_IDS.every((id) => weights[id] === (p[id] || 0))
                            ? "selected"
                            : ""
                        }
                        aria-pressed={
                          SKILL_IDS.every((id) => weights[id] === (p[id] || 0))
                        }
                        onClick={() =>
                          setWeights(weightsFrom(p, { coding: 0, humor: 0, thinking: 0, writing: 0 }))
                        }
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                  <div className="recipe-summary">
                    <div
                      className="recipe-ring"
                      style={
                        { "--coding-share": `${codingShare}%`, background: total ? `conic-gradient(var(--coding) 0% ${effective.coding * 100}%, var(--humor) ${effective.coding * 100}% ${(effective.coding + effective.humor) * 100}%, var(--thinking) ${(effective.coding + effective.humor) * 100}% ${(effective.coding + effective.humor + effective.thinking) * 100}%, var(--writing) ${(effective.coding + effective.humor + effective.thinking) * 100}% 100%)` : undefined } as CSSProperties
                      }
                      data-empty={total === 0}
                      aria-hidden="true"
                    >
                      <Layers3 size={19} />
                    </div>
                    <div>
                      <strong>
                        {total === 0
                          ? "The original foundation"
                          : "Your custom blend"}
                      </strong>
                      <p>
                        {total === 0
                          ? "All adapters disabled"
                          : `ΔW = ${SKILL_IDS.filter((id) => effective[id] > 0).map((id) => `${effective[id].toFixed(2)} × ${id}`).join(" + ")}`}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="primary"
                    className="forge-button"
                    busy={busy === "merge"}
                    disabled={disabled}
                    onClick={() =>
                      action("merge", async () => {
                        const r = await forge();
                        setToast(
                          r.mode === "demo"
                            ? "Rehearsal recipe created"
                            : "Real adapter merged",
                        );
                        await sync();
                      })
                    }
                  >
                    <Sparkles size={17} />
                    {status?.mode === "live"
                      ? "Forge model"
                      : "Forge rehearsal recipe"}
                    <ArrowRight size={16} />
                  </Button>
                  <div className="merge-status" aria-live="polite">
                    {recipe ? (
                      <>
                        <Check size={13} />
                        {recipe.mode === "demo"
                          ? "Recipe ready · no tensors merged"
                          : `${recipe.cache_hit ? "Cache hit" : "Merged"} · rank ${recipe.rank} · ${recipe.merge_ms.toFixed(1)} ms`}
                      </>
                    ) : (
                      <>Exact concatenation · no live training</>
                    )}
                  </div>
                  {recipe && (
                    <div className="export-row">
                      <button
                        className="text-button"
                        onClick={() =>
                          saveJSON(recipe, `evolith-${recipe.id}.json`)
                        }
                      >
                        <ArrowDownToLine size={14} />
                        Recipe
                      </button>
                      <button
                        className="text-button"
                        disabled={!recipe.artifact_available || !!busy}
                        onClick={() =>
                          action("download", () =>
                            download(
                              `/recipes/${recipe.id}/download`,
                              `adapter-${recipe.id}.zip`,
                            ),
                          )
                        }
                      >
                        <ArrowDownToLine size={14} />
                        Adapter ZIP
                      </button>
                    </div>
                  )}
                </section>
                <div className="playground-column">
                  <section
                    className="card playground"
                    aria-labelledby="playground-heading"
                  >
                    <div className="section-heading">
                      <div>
                        <span className="step">02 / EXPERIMENT</span>
                        <h2 id="playground-heading">Put it to the test</h2>
                      </div>
                      <Badge>PLAYGROUND</Badge>
                    </div>
                    <div className="sample-prompts">
                      {SAMPLES.map((sample) => (
                        <button
                          disabled={!!busy || !!activeJob}
                          className={prompt === sample.text ? "selected" : ""}
                          aria-pressed={prompt === sample.text}
                          onClick={() => setPrompt(sample.text)}
                          key={sample.name}
                        >
                          {sample.name}
                        </button>
                      ))}
                    </div>
                    <label className="visually-hidden" htmlFor="prompt">
                      Your prompt
                    </label>
                    <textarea
                      id="prompt"
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      maxLength={6000}
                      rows={4}
                      disabled={!!busy || !!activeJob}
                    />
                    <div className="generation-controls">
                      <details>
                        <summary>Generation settings</summary>
                        <div className="settings-fields">
                          <label>
                            Max tokens
                            <input
                              type="number"
                              min="16"
                              max="768"
                              value={maxTokens}
                              onChange={(e) =>
                                setMaxTokens(Number(e.target.value))
                              }
                            />
                          </label>
                          <label>
                            Temperature
                            <input
                              type="number"
                              min="0"
                              max="1.5"
                              step="0.1"
                              value={temperature}
                              onChange={(e) =>
                                setTemperature(Number(e.target.value))
                              }
                            />
                          </label>
                          <label>
                            Seed
                            <input
                              type="number"
                              min="0"
                              max="2147483647"
                              value={seed}
                              onChange={(e) => setSeed(Number(e.target.value))}
                            />
                          </label>
                        </div>
                      </details>
                      <Button
                        variant="primary"
                        busy={busy === "generate"}
                        disabled={disabled || !prompt.trim()}
                        onClick={generate}
                      >
                        <Play size={14} />
                        {status?.mode === "demo"
                          ? "Preview response"
                          : "Generate"}
                      </Button>
                    </div>
                    <div
                      className="output-panel"
                      aria-busy={busy === "generate"}
                    >
                      <div className="output-toolbar">
                        <span>
                          <Terminal size={15} />
                          {run
                            ? run.mode === "demo"
                              ? "CANNED REHEARSAL OUTPUT"
                              : "MODEL OUTPUT"
                            : "OUTPUT"}
                        </span>
                        {run && (
                          <Button
                            variant="ghost"
                            aria-label="Copy output"
                            onClick={() => copy(run.text)}
                          >
                            <Copy size={15} />
                          </Button>
                        )}
                      </div>
                      <div aria-live="polite">
                        {run ? (
                          <Output text={run.text} />
                        ) : (
                          <Empty title="A little coding. A little character.">
                            Choose your mix, send a prompt, and see what comes
                            together.
                          </Empty>
                        )}
                      </div>
                      {run && (
                        <div className="output-metrics">
                          <span>
                            {run.metrics.output_tokens === null
                              ? "No inference performed"
                              : `${run.metrics.output_tokens} tokens`}
                          </span>
                          <span>
                            {run.metrics.tokens_per_second === null
                              ? "Rehearsal fixture"
                              : `${run.metrics.tokens_per_second} tok/s`}
                          </span>
                          <span>
                            {run.metrics.generation_ms === null
                              ? "Not benchmark evidence"
                              : `${(run.metrics.generation_ms / 1000).toFixed(2)} s generation`}
                          </span>
                          {run.recipe_id !== recipe?.id && (
                            <span>Previous recipe output</span>
                          )}
                        </div>
                      )}
                    </div>
                  </section>
                  <section className="comparison-callout">
                    <div className="compare-icon">
                      <GitBranch size={23} />
                    </div>
                    <div>
                      <h3>See the difference, side by side.</h3>
                      <p>
                        One prompt. Base model, active specialists, and your
                        blend.
                      </p>
                    </div>
                    <Button
                      disabled={disabled || !prompt.trim()}
                      busy={busy === "compare"}
                      onClick={() => submit("compare")}
                    >
                      Compare <ArrowRight size={15} />
                    </Button>
                  </section>
                </div>
              </div>
              {job?.kind === "compare" && (
                <JobResults
                  job={job}
                  cancel={() =>
                    action("cancel", async () => {
                      await request(`/jobs/${job.id}/cancel`, {});
                      setToast("Will stop after the current generation.");
                    })
                  }
                  downloadFile={(format) =>
                    action("download", () =>
                      download(
                        `/jobs/${job.id}/export?format=${format}`,
                        `comparison.${format}`,
                      ),
                    )
                  }
                />
              )}
              <div className="principles">
                <span>
                  <ShieldCheck size={16} />
                  Same base. Compatible adapters.
                </span>
                <span>
                  <Layers3 size={16} />
                  Real weight updates in live mode.
                </span>
                <span>
                  <Activity size={16} />
                  Measure the result. Keep the evidence.
                </span>
              </div>
            </>
          )}
          {page === "benchmarks" && (
            <>
              <PageIntro
                eyebrow="MEASURE WHAT CHANGED"
                title="Let the results speak."
                description="A small, reproducible suite. Compare your active specialists under the same conditions."
              />
              <section className="card benchmark-intro">
                <div>
                  <h2>Six tasks. Twenty-four generations.</h2>
                  <p>
                    Three coding structure checks and three writing instruction
                    checks, for the base model, each specialist, and your
                    current blend.
                  </p>
                  <Badge tone="neutral">
                    Heuristic checks · not HumanEval or a quality guarantee
                  </Badge>
                </div>
                <Button
                  variant="primary"
                  disabled={disabled}
                  busy={busy === "benchmark"}
                  onClick={() => submit("benchmark")}
                >
                  <Activity size={17} />
                  Run benchmark
                </Button>
              </section>
              <p className="subtle">
                Uses your current sliders. Maximum 192 output tokens per task.
                Seed {seed}, temperature {temperature}. Cancellation stops after
                the current generation. Warm the model before recording results.
              </p>
              {job?.kind === "benchmark" ? (
                <JobResults
                  job={job}
                  cancel={() =>
                    action("cancel", async () => {
                      await request(`/jobs/${job.id}/cancel`, {});
                      setToast("Cancellation requested");
                    })
                  }
                  downloadFile={(format) =>
                    action("download", () =>
                      download(
                        `/jobs/${job.id}/export?format=${format}`,
                        `benchmark.${format}`,
                      ),
                    )
                  }
                />
              ) : (
                <section className="card">
                  <Empty title="Your first experiment starts here">
                    Live runs produce measured throughput and rubric scores.
                    Rehearsal runs intentionally leave scores empty.
                  </Empty>
                </section>
              )}
              <div className="benchmark-tasks">
                {[
                  "Clamp a value",
                  "Stable deduplication",
                  "Palindrome checker",
                  "Plain language",
                  "Launch copy",
                  "Clear next steps",
                ].map((task, i) => (
                  <div className="card task" key={task}>
                    <span className="step">
                      TASK 0{i + 1} / {i < 3 ? "CODING" : "WRITING"}
                    </span>
                    <h3>{task}</h3>
                    <p>
                      {i < 3
                        ? "Python syntax, requested function signature, and no imports. Generated code is never executed by the API."
                        : "Word count, required terms, and forbidden terms. This measures instruction compliance."}
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}
          {page === "history" && (
            <>
              <PageIntro
                eyebrow="THE EXPERIMENT LOG"
                title="Every recipe has a story."
                description="Recipes, generated responses, and benchmark evidence are saved by your backend in SQLite."
              />
              <div className="history-heading">
                <h2>Recent activity</h2>
                <Button
                  onClick={() => action("refresh", () => sync())}
                  busy={busy === "refresh"}
                >
                  Refresh
                </Button>
              </div>
              {!history.jobs.length &&
              !history.runs.length &&
              !history.recipes.length ? (
                <section className="card">
                  <Empty title="A clean workbench">
                    Forge a recipe or preview a response to start your
                    experiment log.
                  </Empty>
                </section>
              ) : (
                <div className="history-list">
                  {history.jobs.map((item) => (
                    <button
                      className="card history-item"
                      key={item.id}
                      onClick={() => {
                        setJob(item);
                        setPage(
                          item.kind === "benchmark" ? "benchmarks" : "forge",
                        );
                      }}
                    >
                      <Activity size={19} />
                      <div>
                        <strong>
                          {item.kind === "benchmark"
                            ? "Benchmark suite"
                            : "Four-way comparison"}
                        </strong>
                        <small>
                          {new Date(item.created_at).toLocaleString()} ·{" "}
                          {item.completed}/{item.total} generations
                        </small>
                      </div>
                      <Badge>{item.mode}</Badge>
                      <Badge>{item.status}</Badge>
                      <ArrowRight size={16} />
                    </button>
                  ))}
                  {history.recipes.slice(0, 12).map((item) => (
                    <div className="card history-item" key={item.id}>
                      <Layers3 size={19} />
                      <div>
                        <strong>
                          {SKILLS.filter(({ id }) => (item.weights[id] || 0) > 0).map(({ id, label }) => `${Math.round(item.weights[id] * 100)}% ${label.toLowerCase()}`).join(" / ") || "Base model"}
                        </strong>
                        <small>
                          {item.id} ·{" "}
                          {item.mode === "live"
                            ? `rank ${item.rank}`
                            : "rehearsal recipe"}
                        </small>
                      </div>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setWeights(weightsFrom(item.requested_weights, { coding: 0, humor: 0, thinking: 0, writing: 0 }));
                          setNormalize(item.normalize);
                          setPage("forge");
                          setToast("Recipe weights restored. Forge to apply.");
                        }}
                      >
                        Restore
                      </Button>
                      <Button
                        variant="ghost"
                        aria-label={`Export recipe ${item.id}`}
                        onClick={() => saveJSON(item, `${item.id}.json`)}
                      >
                        <ArrowDownToLine size={16} />
                      </Button>
                    </div>
                  ))}
                  {history.runs.slice(0, 8).map((item) => (
                    <details className="card history-run" key={item.id}>
                      <summary>
                        {item.prompt.slice(0, 100)}
                        <Badge>{item.mode}</Badge>
                      </summary>
                      <Output text={item.text} />
                    </details>
                  ))}
                </div>
              )}
            </>
          )}
          {page === "guide" && (
            <>
              <PageIntro
                eyebrow="FROM TRAINING TO SHOWTIME"
                title="Build once. Blend live."
                description="Four specialist controls, one shared foundation, and a workflow designed for a hackathon stage."
              />
              <div className="guide-grid">
                {[
                  [
                    "01",
                    "Prepare your specialists",
                    "Open notebooks/01_train_specialists.ipynb in Colab. Select a GPU, upload this project ZIP, install the ML dependencies, and train coding, humor, thinking and writing LoRA adapters from the same pinned Qwen checkpoint. Training is fine-tuning, not pretraining a model from scratch.",
                  ],
                  [
                    "02",
                    "Keep the runtime warm",
                    "Open notebooks/02_live_lab.ipynb. Mount your saved adapters, select live mode, and warm the backend once. The notebook also has a direct interactive widget, so the core live demo works without a public server or tunnel.",
                  ],
                  [
                    "03",
                    "Compose in the studio",
                    "Connect this UI to an HTTPS backend in Connection settings. We concatenate adapter matrices to represent the exact weighted sum of their delta weights. No retraining occurs when you move the sliders and forge. Rank grows with the number of active specialists.",
                  ],
                  [
                    "04",
                    "Compare and take evidence home",
                    "Run the same prompt across the foundation, active specialists, and your blend. Benchmark on the held-out task suite. Export the report, recipe JSON, and actual merged adapter ZIP in live mode. Evaluate skill quality before making claims.",
                  ],
                ].map(([n, title, description]) => (
                  <section className="card guide-step" key={n}>
                    <span className="guide-number">{n}</span>
                    <h2>{title}</h2>
                    <p>{description}</p>
                  </section>
                ))}
              </div>
              <section className="card honest-card">
                <GitBranch size={25} />
                <div>
                  <span className="step">EVOLVE / PLANNED RESEARCH</span>
                  <h2>From choosing a model to creating the right one.</h2>
                  <p>Our Evolve vision is a self-adaptation loop: inspect the task and available weights, propose child models, evaluate them against the parent, then use the best validated version. Autonomous adaptation is planned functionality; the current studio supports manual blending.</p>
                  <a className="text-button" href="#evolve">Explore the Evolve vision <ArrowRight size={14} /></a>
                </div>
              </section>
              <section className="card honest-card">
                <ShieldCheck size={25} />
                <div>
                  <h2>What this project can prove</h2>
                  <p>
                    It can prove compatible LoRA updates were combined correctly
                    and measure actual generation. A slider is an adapter
                    coefficient, not a guaranteed percentage of a skill. It
                    cannot combine arbitrary unrelated models or proprietary
                    model weights.
                  </p>
                  <p>
                    Rehearsal mode uses hand-written sample outputs and creates
                    no model weights. Live mode loads the real checkpoint and
                    adapter tensors. A live error remains visible; it never
                    silently becomes a rehearsal response.
                  </p>
                  <p>
                    Colab hardware and session availability vary. Save
                    checkpoints to Drive and rehearse with the exact GPU you
                    receive. This project includes starter data; meaningful
                    specialization needs more curated data and evaluation.
                  </p>
                </div>
              </section>
              <section className="card quickstart">
                <Terminal size={22} />
                <div>
                  <h2>Start locally</h2>
                  <pre>./scripts/run.sh</pre>
                  <p>
                    Open http://localhost:8000. Full setup, Colab, GPU
                    deployment, API, and troubleshooting instructions are in the
                    included README and docs folder.
                  </p>
                </div>
                <Button
                  onClick={() =>
                    action("warmup", async () => {
                      const result = await request<{ message?: string }>(
                        "/warmup",
                        {},
                      );
                      await sync();
                      setToast(result.message || "Base model warmed and ready");
                    })
                  }
                  busy={busy === "warmup"}
                  disabled={!status?.ready || !!activeJob}
                >
                  Warm backend
                </Button>
              </section>
            </>
          )}
          <footer>
            <span>EVOLITH</span>
            <span>A workbench for what comes next.</span>
            <span>Made to experiment.</span>
          </footer>
        </main>
      </div>
      <dialog
        ref={dialog}
        onClose={() => connectionButton.current?.focus()}
        aria-labelledby="connection-title"
      >
        <form onSubmit={connect}>
          <div className="dialog-heading">
            <span className="step">RUNTIME CONNECTION</span>
            <Button
              type="button"
              variant="ghost"
              aria-label="Close settings"
              onClick={() => dialog.current?.close()}
            >
              <X size={18} />
            </Button>
          </div>
          <h2 id="connection-title">Connect your backend</h2>
          <p>
            Leave the URL empty to use this app’s backend. For a remote GPU,
            enter its HTTPS address and API key.
          </p>
          <label>
            Backend URL
            <input
              type="url"
              placeholder="https://your-gpu-backend.example.com"
              value={connection.url}
              onChange={(e) =>
                setConnection({ ...connection, url: e.target.value })
              }
            />
          </label>
          <label>
            API key
            <input
              type="password"
              autoComplete="off"
              value={connection.key}
              onChange={(e) =>
                setConnection({ ...connection, key: e.target.value })
              }
            />
          </label>
          <p className="subtle">
            The key is kept in this browser tab’s session storage and sent only
            to the backend you choose. Configure that backend’s allowed origins
            for this frontend.
          </p>
          {error && (
            <p role="alert" className="dialog-error">
              {error}
            </p>
          )}
          <Button variant="primary" busy={busy === "connect"} type="submit">
            Test & connect <ArrowRight size={16} />
          </Button>
        </form>
      </dialog>
      {toast && (
        <div role="status" className="toast">
          <Check size={16} />
          {toast}
        </div>
      )}
    </div>
  );
}

function PageIntro({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <section className="page-intro">
      <div className="eyebrow">
        <span />
        {eyebrow}
      </div>
      <h1>{title}</h1>
      <p>{description}</p>
    </section>
  );
}

function JobResults({
  job,
  cancel,
  downloadFile,
}: {
  job: Job;
  cancel: () => void;
  downloadFile: (format: "json" | "csv") => void;
}) {
  const running = !TERMINAL_STATES.includes(job.status);
  return (
    <section
      className="job-section"
      aria-label={
        job.kind === "compare" ? "Comparison results" : "Benchmark results"
      }
      aria-busy={running}
    >
      <div className="results-heading">
        <div>
          <span className="step">
            {job.kind === "compare" ? "03 / COMPARE" : "EXPERIMENT RESULTS"}
          </span>
          <h2>
            {job.kind === "compare"
              ? "Every perspective. One prompt."
              : "A measured look at your blend."}
          </h2>
        </div>
        <div className="header-actions">
          <Badge>
            {job.mode === "demo" ? "Rehearsal · no scores" : job.status}
          </Badge>
          {running ? (
            <Button onClick={cancel}>Stop after current</Button>
          ) : (
            <>
              <Button onClick={() => downloadFile("json")}>
                <ArrowDownToLine size={14} />
                JSON
              </Button>
              <Button onClick={() => downloadFile("csv")}>CSV</Button>
            </>
          )}
        </div>
      </div>
      <div className="progress-line">
        <progress
          value={job.completed}
          max={job.total}
          aria-label="Generations completed"
        />
        <span aria-live="polite">
          {job.completed} / {job.total} · {job.status}
        </span>
      </div>
      {job.error && (
        <p role="alert" className="notice error">
          {job.error}
        </p>
      )}
      {job.kind === "benchmark" && (
        <>
          <p className="subtle">{job.rubric}</p>
          <div className="card chart-card">
            <div className="chart-legend">
              <span>
                <i className="coding-key" />
                Coding structure
              </span>
              <span>
                <i className="writing-key" />
                Writing compliance
              </span>
            </div>
            <div
              className="score-chart"
              role="img"
              aria-label="Heuristic rubric scores by model variant, from 0 to 100. Scores are also listed in the table below."
            >
              {job.summary.map((row) => (
                <div className="chart-row" key={row.variant}>
                  <strong>{row.variant}</strong>
                  <div className="chart-tracks">
                    <div>
                      <span
                        className="coding-bar"
                        style={{ width: `${row.coding || 0}%` }}
                      />
                      {row.coding === null ? "Not scored" : row.coding}
                    </div>
                    <div>
                      <span
                        className="writing-bar"
                        style={{ width: `${row.writing || 0}%` }}
                      />
                      {row.writing === null ? "Not scored" : row.writing}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="table-scroll">
              <table>
                <caption className="visually-hidden">
                  Benchmark averages over completed tasks. No score is a
                  correctness guarantee.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Variant</th>
                    <th scope="col">Coding / 100</th>
                    <th scope="col">Writing / 100</th>
                    <th scope="col">Mean tok/s</th>
                  </tr>
                </thead>
                <tbody>
                  {job.summary.map((row) => (
                    <tr key={row.variant}>
                      <th scope="row">{row.variant}</th>
                      <td>{row.coding ?? "—"}</td>
                      <td>{row.writing ?? "—"}</td>
                      <td>{row.tokens_per_second ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
      <div
        className={job.kind === "compare" ? "compare-grid" : "benchmark-rows"}
      >
        {job.rows.map((row) => (
          <article
            className={`card result-card ${row.variant === "Your blend" ? "your-blend" : ""}`}
            key={row.id}
          >
            <div className="result-header">
              <h3>{row.variant}</h3>
              <Badge>
                {job.kind === "benchmark"
                  ? row.task_name
                  : row.variant === "Your blend"
                    ? "YOUR RECIPE"
                    : row.mode === "demo"
                      ? "CANNED"
                      : "LIVE"}
              </Badge>
            </div>
            {job.kind === "benchmark" ? (
              <details>
                <summary>
                  View response and checks{" "}
                  {row.score !== null && <strong>{row.score}/100</strong>}
                </summary>
                <Output text={row.text} />
                <ul className="checks">
                  {Object.entries(row.checks).map(([name, passed]) => (
                    <li key={name}>
                      {passed ? <Check size={14} /> : <X size={14} />} {name}
                    </li>
                  ))}
                </ul>
              </details>
            ) : (
              <Output text={row.text} />
            )}
            <div className="result-metrics">
              <Metric label="Output tokens" value={row.metrics.output_tokens} />
              <Metric
                label="Throughput"
                value={row.metrics.tokens_per_second}
                unit=" tok/s"
              />
              <Metric
                label="Generation"
                value={
                  row.metrics.generation_ms === null
                    ? null
                    : (row.metrics.generation_ms / 1000).toFixed(2)
                }
                unit=" s"
              />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
