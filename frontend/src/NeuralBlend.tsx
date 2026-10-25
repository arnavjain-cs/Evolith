import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { SKILLS, SKILL_IDS, normalized } from "./skills";
import type { Weights } from "./types";

const layerSizes = [3, 5, 6, 5, 3];
const layers = layerSizes.map((count, layer) =>
  Array.from({ length: count }, (_, index) => ({
    x: 80 + layer * 120,
    y: 240 + (index - (count - 1) / 2) * 48,
    channel: SKILL_IDS[(index + layer) % SKILL_IDS.length],
  })),
);
const curve = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  `C ${a.x + 62} ${a.y}, ${b.x - 62} ${b.y}, ${b.x} ${b.y}`;
const links = layers.slice(0, -1).flatMap((layer, index) =>
  layer.flatMap((from, i) => layers[index + 1].map((to, j) => ({
    id: `${index}-${i}-${j}`,
    d: `M ${from.x} ${from.y} ${curve(from, to)}`,
    channel: SKILL_IDS[(i + j + index) % SKILL_IDS.length],
    strength: Math.max(0.28, 1 - Math.abs(from.y - to.y) / 240),
  }))),
);
const routes = [[0, 0, 1, 0, 0], [0, 1, 0, 1, 0]];
function signalPath(indices: number[], offset: number) {
  const points = indices.map((index, layer) => layers[layer][(index + offset) % layerSizes[layer]]);
  return `M ${points[0].x} ${points[0].y} ${points.slice(1).map((point, i) => curve(points[i], point)).join(" ")}`;
}

/** A conceptual signal diagram; these are coefficients, never measured activations. */
export default function NeuralBlend({ weights }: { weights: Weights }) {
  const root = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [reduced, setReduced] = useState(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
  const influence = normalized(weights);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    media.addEventListener("change", update);
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.15 });
    if (root.current) observer.observe(root.current);
    return () => { observer.disconnect(); media.removeEventListener("change", update); };
  }, []);
  return (
    <div ref={root} className="neural-blend" role="img"
      aria-label={`Illustrative neural network: ${SKILLS.map(({ id, label }) => `${Math.round(influence[id] * 100)}% ${label.toLowerCase()}`).join(", ")}. Signals illustrate your mix, not actual model activations.`}
      data-coding={weights.coding * 100} data-humor={weights.humor * 100}
      data-thinking={weights.thinking * 100} data-writing={weights.writing * 100}
      data-animating={visible && !reduced}
      style={Object.fromEntries(SKILL_IDS.map((id) => [`--nn-${id}`, influence[id]])) as CSSProperties}>
      <svg className="neural-canvas" viewBox="0 0 640 480" aria-hidden="true">
        <g className="nn-guides"><path d="M80 98V390 M200 98V390 M320 98V390 M440 98V390 M560 98V390" /><path d="M50 240H590" /></g>
        <g className="nn-layer-labels"><text x="80" y="74">INPUT</text><text x="320" y="74">SHARED LAYERS</text><text x="560" y="74">OUTPUT</text></g>
        <g className="nn-connections">{links.map((link) => <path key={link.id} d={link.d}
          className={`nn-link nn-${link.channel}`} opacity={(0.06 + influence[link.channel] * 1.5) * link.strength}
          strokeWidth={0.6 + influence[link.channel] * 2.4} />)}</g>
        {visible && !reduced && <g className="nn-signals">{SKILL_IDS.flatMap((channel, channelIndex) => routes.map((route, index) =>
          <g key={`${channel}-${index}`} className={`nn-signal nn-${channel}`} opacity={Math.min(1, influence[channel] * 2)}>
            <circle r={2.2 + influence[channel] * 2}><animateMotion path={signalPath(route, channelIndex)}
              dur={`${5.2 - influence[channel] * 2.4}s`} begin={`${-index * 1.15}s`} repeatCount="indefinite" /></circle>
          </g>))}</g>}
        <g className="nn-neurons">{layers.flatMap((layer, layerIndex) => layer.map((node, index) =>
          <g key={`${layerIndex}-${index}`} transform={`translate(${node.x} ${node.y})`} className={`nn-neuron nn-${node.channel}`}>
            <circle className="nn-node-halo" r={14 + influence[node.channel] * 14} opacity={influence[node.channel] * 0.25} />
            <circle className="nn-node-shell" r={layerIndex === 2 ? 10 : 8} strokeOpacity={0.35 + influence[node.channel] * 0.65} />
            <circle className="nn-node-center" r={2 + influence[node.channel] * 5.4} opacity={0.15 + influence[node.channel] * 0.85} />
          </g>))}</g>
        <g className="nn-layer-counts">{layerSizes.map((count, index) => <text key={index} x={80 + index * 120} y="414">0{index + 1}<tspan dx="7">/</tspan><tspan dx="7">{count}</tspan></text>)}</g>
      </svg>
      <div className="nn-legend" aria-hidden="true">{SKILLS.map(({ id, label }) => <span key={id}><i className={`nn-${id}-key`} />{label}</span>)}</div>
      <span className="nn-caption" aria-hidden="true">AN ILLUSTRATION OF YOUR MIX</span>
    </div>
  );
}
