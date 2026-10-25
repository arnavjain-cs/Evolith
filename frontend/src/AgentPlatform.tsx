import { Activity, ArrowUpRight, Bot, FileStack, GitBranch, Workflow } from 'lucide-react';

export default function AgentPlatform() {
  return <section id="agent-platform" className="agent-platform-section" aria-labelledby="agent-platform-title">
    <div className="section-kicker" data-reveal><span>THE AGENT WORKSPACE / BUILD ONCE. REUSE OFTEN.</span><span className="evolve-status">WORKING PROTOTYPE</span></div>
    <div className="agent-platform-intro" data-reveal><h2 id="agent-platform-title">From custom model<br/>to <em>purposeful agent.</em></h2><div><p>Building an agent shouldn’t mean rebuilding the setup. Evolith brings your custom models, tools, instructions, and monitoring into one reusable workspace—so you can focus on what the agent should accomplish.</p><a className="home-text-link" href="#agents">Open the agent workspace <ArrowUpRight size={17}/></a></div></div>
    <div className="agent-platform-flow" data-reveal aria-label="Reusable agent setup">
      {[{Icon:GitBranch, label:'01 / MODEL', title:'Give every idea a branch.', text:'Save custom recipes, trace their parents, and pin a model to an agent.'}, {Icon:Workflow, label:'02 / CONFIGURE', title:'Connect purpose to tools.', text:'Set an objective, write instructions, and add available read-only tools.'}, {Icon:FileStack, label:'03 / REUSE', title:'Keep the setup. Change the mission.', text:'Turn a working configuration into a blueprint for your next agent.'}, {Icon:Activity, label:'04 / OBSERVE', title:'See what actually happened.', text:'Inspect versioned setups, tool steps, runtime outcomes, and saved traces.'}].map(({Icon,label,title,text}) => <article key={label}><span className="agent-platform-node"><Icon aria-hidden="true"/></span><span className="agent-platform-label">{label}</span><h3>{title}</h3><p>{text}</p></article>)}
    </div>
    <div className="agent-platform-bottom" data-reveal><div><Bot aria-hidden="true"/><p><strong>A practical foundation for enterprise agent workflows.</strong> Persistent configurations, reusable blueprints, model lineage, and sandbox monitoring work today. SSO, team permissions, external connectors, tenant isolation, and production deployment are planned.</p></div><a className="home-text-link" href="#agents">Build your first agent <ArrowUpRight size={17}/></a></div>
  </section>;
}
