import type { CSSProperties } from "react";
import { Code2, Layers3, PenLine } from "lucide-react";

/** A code-native, six-sided layered object. No video, image sequence, or WebGL download. */
export default function ForgeCore() {
  return (
    <div className="forge-core" aria-hidden="true">
      <div className="core-floor">
        <span />
        <span />
        <span />
      </div>
      <div className="core-orbit orbit-one" />
      <div className="core-orbit orbit-two" />
      <div className="core-position">
        <div className="core-assembly">
          {Array.from({ length: 6 }, (_, index) => (
            <div
              className={`model-slab slab-${index}`}
              key={index}
              style={
                {
                  "--layer": index,
                  "--layer-offset": index - 2.5,
                  "--layer-direction": index < 3 ? -1 : 1,
                } as CSSProperties
              }
            >
              <div className="slab-face slab-top">
                <div className="circuit-grid" />
                <span className="slab-id">EV—0{index + 1}</span>
                <span className="slab-contact contact-a" />
                <span className="slab-contact contact-b" />
                {index === 5 ? (
                  <div className="core-brand">
                    <Layers3 strokeWidth={1.1} />
                    <span>EVOLITH</span>
                  </div>
                ) : (
                  <div className="slab-traces">
                    <i />
                    <i />
                    <i />
                    <i />
                  </div>
                )}
                <span className="slab-corner">
                  {index === 5
                    ? "COMPOSED INTELLIGENCE"
                    : index < 3
                      ? "FOUNDATION / SHARED"
                      : "ADAPTER / COMPATIBLE"}
                </span>
              </div>
              <div className="slab-face slab-bottom" />
              <div className="slab-face slab-front">
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
              </div>
              <div className="slab-face slab-back" />
              <div className="slab-face slab-left" />
              <div className="slab-face slab-right">
                <span>0{index + 1} — EV</span>
                <i />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="orbit-label label-code">
        <Code2 size={15} />
        <span>
          CODING <b>α</b>
        </span>
        <i />
      </div>
      <div className="orbit-label label-writing">
        <PenLine size={15} />
        <span>
          WRITING <b>β</b>
        </span>
        <i />
      </div>
      <span className="core-coordinate coordinate-left">X / 0.65</span>
      <span className="core-coordinate coordinate-right">Y / 0.35</span>
    </div>
  );
}
