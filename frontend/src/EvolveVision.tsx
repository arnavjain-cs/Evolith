import { ArrowUpRight, BrainCircuit, FlaskConical, GitBranch, Scan, Sparkles } from "lucide-react";

const stages = [
  { title: "Inspect", Icon: Scan, text: "Review the task, the model’s architecture, adapter weights and measured capabilities." },
  { title: "Design", Icon: BrainCircuit, text: "Propose weight mixtures or learning updates suited to the task." },
  { title: "Create", Icon: GitBranch, text: "Form candidate child models and preserve their connection to the parent." },
  { title: "Evaluate", Icon: FlaskConical, text: "Test against a baseline. Keep the parent when no child proves better." },
  { title: "Perform", Icon: Sparkles, text: "Use the selected model for the task and keep the experiment’s evidence." },
];

export default function EvolveVision() {
  return (
    <section id="evolve" className="evolve-section" aria-labelledby="evolve-title" aria-describedby="evolve-status">
      <div className="section-kicker" data-reveal>
        <span>EVOLVE / OUR AGI RESEARCH VISION</span>
        <span className="evolve-status">PLANNED CAPABILITY</span>
      </div>
      <div className="evolve-intro" data-reveal>
        <h2 id="evolve-title">Intelligence that<br /><em>learns how to adapt.</em></h2>
        <p>Our next step toward more general intelligence: an AI that inspects its capabilities, creates task-specific child models, and tests which version is best suited to do the work.</p>
      </div>
      <div className="evolve-lineage" data-reveal>
        <div className="evolve-parent"><GitBranch aria-hidden="true" /><span>One parent.<br /><strong>New possibilities.</strong></span></div>
        <div className="evolve-branches" aria-hidden="true">
          <span className="evolve-child">Code + plan</span>
          <span className="evolve-child">Clear + playful</span>
          <span className="evolve-child">Task specialist</span>
        </div>
        <div className="evolve-selection"><FlaskConical aria-hidden="true" /><span>Measure the change.<br /><strong>Select on evidence.</strong></span></div>
        <span className="evolve-diagram-label">ILLUSTRATIVE MODEL LINEAGE</span>
      </div>
      <ol className="evolve-steps" aria-label="Planned Evolve workflow">
        {stages.map(({ title, Icon, text }, index) => (
          <li key={title} data-reveal>
            <div className="evolve-step-top"><span>0{index + 1}</span><Icon aria-hidden="true" /></div>
            <h3>{title}</h3><p>{text}</p>
          </li>
        ))}
      </ol>
      <div className="evolve-bottom" data-reveal>
        <p id="evolve-status">Evolve is a planned research direction, not an implemented feature or a claim of achieved AGI. The current studio supports manual adapter blending.</p>
        <a className="home-text-link" href="#studio">Explore today’s studio <ArrowUpRight size={17} /></a>
      </div>
    </section>
  );
}
