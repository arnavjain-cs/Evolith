import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import {
  ArrowDown,
  ArrowUpRight,
  Asterisk,
  Check,
  Code2,
  GitBranch,
  Layers3,
  Moon,
  PenLine,
  Plus,
  Sun,
} from "lucide-react";
import ForgeCore from "./ForgeCore";
import NeuralBlend from "./NeuralBlend";
import EvolveVision from "./EvolveVision";
import AgentPlatform from "./AgentPlatform";
import { SKILLS, normalized } from "./skills";
import type { Weights } from "./types";
import { useScrollChoreography } from "./scroll";
import { Button } from "./ui";
import "./home.css";

const chapters = ["Foundation", "Specialists", "Your combination"];

export default function Home() {
  const { root, story } = useScrollChoreography();
  const [weights, setWeights] = useState<Weights>({ coding: .45, humor: .1, thinking: .25, writing: .2 });
  const blend = normalized(weights);
  const [theme, setTheme] = useState(
    () => localStorage.getItem("modelforge-theme") || "light",
  );
  useEffect(() => {
    // Initial fragments can arrive before React has created their target section.
    const frame = requestAnimationFrame(() => {
      if (["#your-blend", "#the-process", "#evolve", "#agent-platform"].includes(location.hash)) {
        document
          .getElementById(location.hash.slice(1))
          ?.scrollIntoView({ behavior: "instant", block: "start" });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("modelforge-theme", theme);
  }, [theme]);
  function openBlend() {
    localStorage.setItem(
      "modelforge-weights",
      JSON.stringify(weights),
    );
    location.hash = "studio";
  }
  return (
    <div className="home" ref={root}>
      <a className="skip-link" href="#home-content">
        Skip to content
      </a>
      <header className="home-nav">
        <a href="#" className="home-brand" aria-label="Evolith home">
          <span className="home-brand-mark">
            <Layers3 size={20} />
          </span>
          Evolith<span className="brand-period">.</span>
        </a>
        <nav aria-label="Home navigation">
          <a href="#the-process">The idea</a>
          <a href="#your-blend">The possibilities</a>
          <a href="#evolve">Evolve</a>
          <a href="#agents">Agents</a>
        </nav>
        <div className="home-nav-actions">
          <Button
            variant="ghost"
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            aria-label={`Switch to ${theme === "light" ? "dark" : "light"} appearance`}
          >
            {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
          </Button>
          <a className="home-nav-cta" href="#studio">
            Enter the studio <ArrowUpRight size={16} />
          </a>
        </div>
      </header>
      <main id="home-content" className="home-content">
        <section
          className="scroll-story"
          ref={story}
          aria-labelledby="home-title"
        >
          <span
            id="the-process"
            className="process-anchor"
            aria-hidden="true"
          />
          <div className="story-sticky">
            <div className="story-grain" aria-hidden="true" />
            <div className="story-grid" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <div className="hero-heading">
              <div className="home-eyebrow">
                <span /> COMPOSABLE AI. A SELF-ADAPTING FUTURE.
              </div>
              <h1 id="home-title">
                Intelligence,
                <br />
                <span>by your design.</span>
              </h1>
              <p>
                Extraordinary things happen
                <br />
                when the right parts come together.
              </p>
            </div>
            <div className="scene-artifact">
              <ForgeCore />
            </div>
            <div className="hero-bottom">
              <span>
                A shared foundation.
                <br />A world of combinations.
              </span>
              <a href="#the-process" className="scroll-invitation">
                <span>SCROLL TO UNFOLD</span>
                <i>
                  <ArrowDown size={17} />
                </i>
              </a>
              <span className="hero-edition">
                THE ADAPTER LAB
                <br />
                EXPERIMENT NO. 001
              </span>
            </div>
            <div className="story-chapter chapter-one">
              <span className="chapter-index">01 — THE FOUNDATION</span>
              <h2>
                Great things
                <br />
                start with
                <br /> <em>good bones.</em>
              </h2>
              <p>
                One capable foundation model.
                <br />A common architecture. The starting point
                <br />
                for everything you’re about to make.
              </p>
              <span className="chapter-note">
                <span /> SHARED WEIGHTS. SHARED POTENTIAL.
              </span>
            </div>
            <div className="story-chapter chapter-two">
              <span className="chapter-index">02 — THE SPECIALISTS</span>
              <h2>
                Give it
                <br />
                <em>
                  another
                  <br /> dimension.
                </em>
              </h2>
              <p>
                Coding precision. A little humor.
                <br />A thoughtful plan. A writer’s instinct.
                <br />
                Small, learned updates. New directions.
              </p>
              <div className="chapter-skills">
                <span>
                  <Code2 size={15} />
                  Coding
                </span>
                <Plus size={13} />
                <span>
                  <PenLine size={15} />
                  Writing
                </span>
              </div>
            </div>
            <div className="story-chapter chapter-three">
              <span className="chapter-index">03 — YOUR COMBINATION</span>
              <h2>
                Different parts.
                <br />
                <em>Entirely yours.</em>
              </h2>
              <p>
                Choose the influence of each specialist.
                <br />
                Combine their compatible weight updates.
                <br />
                See what comes together.
              </p>
              <span className="home-text-link">
                Find your balance <ArrowDown size={17} />
              </span>
            </div>
            <div className="story-track" aria-hidden="true">
              {chapters.map((chapter, i) => (
                <div key={chapter} className={`track-stop track-${i}`}>
                  <span>0{i + 1}</span>
                  {chapter}
                </div>
              ))}
              <div className="track-progress" />
            </div>
            <div className="scene-caption" aria-hidden="true">
              <span>EV / COMPOSABLE INTELLIGENCE</span>
              <span>
                ΔW = Σ αᵢΔWᵢ
              </span>
            </div>
          </div>
        </section>

        <section className="home-manifesto" aria-labelledby="manifesto-title">
          <div className="section-kicker" data-reveal>
            <span>THE IDEA IS SIMPLE</span>
            <span>THE POSSIBILITIES AREN’T.</span>
          </div>
          <div className="manifesto-copy" data-reveal>
            <span className="manifesto-cross" aria-hidden="true">
              <Asterisk />
            </span>
            <h2 id="manifesto-title">
              You don’t need to
              <br />
              start from nothing.
              <br />
              <span>You need a new combination.</span>
            </h2>
          </div>
          <div className="manifesto-bottom" data-reveal>
            <span className="micro-label">
              LESS STARTING OVER.
              <br />
              MORE MOVING FORWARD.
            </span>
            <p>
              Evolith brings together specialist LoRA adapters trained on the
              same foundation. Fine-tune once. Explore your combinations live.
              Keep the ones that earn their place.
            </p>
          </div>
          <div className="moving-type" aria-hidden="true" data-parallax="-180">
            <span>RETHINK. RECOMBINE. REPEAT.</span>
            <i>
              <ArrowUpRight />
            </i>
          </div>
        </section>

        <section
          className="blend-section"
          id="your-blend"
          aria-labelledby="blend-title"
        >
          <div className="blend-editorial" data-reveal>
            <span className="chapter-index">04 — A MATTER OF BALANCE</span>
            <h2 id="blend-title">
              A little logic.
              <br />A little <em>je ne sais quoi.</em>
            </h2>
            <p>
              There’s no single perfect mix.
              <br />
              There’s the one you want to explore.
            </p>
            <div className="home-blend-controls">
              {SKILLS.map(({ id, label, Icon }) => (
                <div key={id} className={`home-skill ${id}`}>
                  <div className="home-slider-heading">
                    <label htmlFor={`home-${id}`}><Icon size={16} />{label}</label>
                    <output htmlFor={`home-${id}`}>{Math.round(weights[id] * 100)}<span>%</span></output>
                  </div>
                  <input id={`home-${id}`} type="range" min="0" max="100"
                    value={Math.round(weights[id] * 100)}
                    onChange={(event) => setWeights({ ...weights, [id]: Number(event.target.value) / 100 })}
                    aria-describedby="home-weight-note"
                    style={{ "--range-fill": `${weights[id] * 100}%` } as CSSProperties} />
                </div>
              ))}
            </div>
            <Button
              variant="primary"
              className="home-blend-button"
              onClick={openBlend}
            >
              Try this combination <ArrowUpRight size={17} />
            </Button>
            <p className="blend-footnote" id="home-weight-note">
              Explore four influences. Coefficients are normalized in the studio; skill gains still need testing.
            </p>
          </div>
          <div className="blend-visual" data-reveal>
            <div className="blend-orbit-text">
              <span>YOUR INPUT. YOUR INTELLIGENCE.</span>
              <span>BUILT TO BE RECOMBINED.</span>
            </div>
            <NeuralBlend weights={weights} />
            <div className="blend-equation">
              <span>THE CURRENT RECIPE</span>
              <strong className="four-part-equation">
                {SKILLS.map(({ id, label }) => <span key={id} className={id}>{blend[id].toFixed(2)} <i>{label.toLowerCase()}</i></span>)}
              </strong>
            </div>
            <span className="visual-corner corner-tl" />
            <span className="visual-corner corner-tr" />
            <span className="visual-corner corner-bl" />
            <span className="visual-corner corner-br" />
          </div>
        </section>

        <AgentPlatform />

        <EvolveVision />

        <section className="proof-section" aria-labelledby="proof-title">
          <div className="proof-heading" data-reveal>
            <div>
              <span className="chapter-index">CRAFT MEETS EVIDENCE</span>
              <h2 id="proof-title">
                Don’t take our word for it.
                <br />
                <em>Take it apart.</em>
              </h2>
            </div>
            <p>
              A good combination should stand up to a closer look.
              <br />
              The studio gives you the tools to find out.
            </p>
          </div>
          <div className="proof-grid">
            <article className="proof-card" data-reveal>
              <div className="proof-graphic compare-graphic" aria-hidden="true">
                <span className="mini-model base-mini">
                  <Layers3 />
                </span>
                <span className="mini-model code-mini">
                  <Code2 />
                </span>
                <span className="mini-model write-mini">
                  <PenLine />
                </span>
                <span className="mini-model blend-mini">
                  <GitBranch />
                </span>
                <div className="comparison-baseline" />
              </div>
              <span className="proof-number">01 / COMPARE</span>
              <h3>See every angle.</h3>
              <p>
                The foundation, your active specialists, and your blend. One prompt. The
                same conditions.
              </p>
            </article>
            <article className="proof-card" data-reveal>
              <div className="proof-graphic weight-graphic" aria-hidden="true">
                <div className="weight-orbit">
                  <span />
                  <span />
                  <span />
                </div>
                <span className="weight-formula">B*A*</span>
                <i>EXACT CONCATENATION</i>
              </div>
              <span className="proof-number">02 / COMPOSE</span>
              <h3>Small updates. Real weights.</h3>
              <p>
                Compatible adapter tensors, combined directly. No retraining for
                every new mix.
              </p>
            </article>
            <article className="proof-card" data-reveal>
              <div className="proof-graphic export-graphic" aria-hidden="true">
                <div className="recipe-paper">
                  <Layers3 size={20} />
                  <span>YOUR RECIPE</span>
                  <i />
                  <i />
                  <i />
                  <b>
                    <Check size={11} />
                    SAVED TO EXPLORE
                  </b>
                </div>
                <span className="paper-behind" />
              </div>
              <span className="proof-number">03 / KEEP</span>
              <h3>A recipe worth keeping.</h3>
              <p>
                Export the blend, inspect the benchmark checks, and come back to
                the same experiment.
              </p>
            </article>
          </div>
          <p className="home-honesty" data-reveal>
            <span />
            The studio supports live model inference and a clearly labeled
            rehearsal mode. Skill gains are something to evaluate, not assume.
          </p>
        </section>

        <section className="home-finale" aria-labelledby="finale-title">
          <div className="finale-orbit" aria-hidden="true" data-parallax="-90">
            <span />
            <span />
            <span />
          </div>
          <span className="home-eyebrow" data-reveal>
            <span />
            YOUR NEXT EXPERIMENT STARTS HERE
          </span>
          <h2 id="finale-title" data-reveal>
            Make intelligence
            <br />a little more <em>yours.</em>
          </h2>
          <a href="#studio" className="finale-cta" data-reveal>
            Enter the studio <ArrowUpRight size={21} />
          </a>
          <div className="finale-bottom">
            <span>ONE FOUNDATION. ENDLESS CURIOSITY.</span>
            <a href="#" aria-label="Back to top">
              BACK TO THE TOP <ArrowUpRight size={14} />
            </a>
          </div>
          <div className="finale-word" aria-hidden="true" data-parallax="140">
            EVOLITH<span>01</span>
          </div>
        </section>
      </main>
      <footer className="home-footer">
        <a href="#" className="home-brand">
          <Layers3 size={19} />
          Evolith.
        </a>
        <span>For the beautifully curious.</span>
        <span>AN OPEN WORKBENCH / 2026</span>
      </footer>
    </div>
  );
}
