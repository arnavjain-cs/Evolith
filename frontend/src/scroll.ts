import { useEffect, useRef } from "react";

export const clamp = (value: number, low = 0, high = 1) =>
  Math.min(high, Math.max(low, value));
const ease = (value: number) => {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
};
const range = (progress: number, start: number, end: number) =>
  ease((progress - start) / (end - start));
const pulse = (p: number, start: number, end: number) =>
  range(p, start, start + 0.055) * (1 - range(p, end - 0.055, end));

/** Pure choreography, shared by the scene and the browser's motion checks. */
export function sceneAt(p: number, mobile: boolean) {
  const first = range(p, 0.05, 0.22);
  const split = range(p, 0.25, 0.44);
  const combine = range(p, 0.65, 0.85);
  const finale = range(p, 0.89, 1);
  return {
    "--hero-opacity": String(1 - range(p, 0, 0.09)),
    "--hero-lift": `${-range(p, 0, 0.12) * 100}px`,
    "--core-x": `${mobile ? 0 : first * 210 - split * 55 - combine * 155}px`,
    "--core-y": `${first * (mobile ? 10 : -80) - combine * (mobile ? 20 : 0)}px`,
    "--core-scale": String(
      mobile
        ? 1 + first * 0.02 - split * 0.26 + combine * 0.18 - finale * 0.1
        : 1 + first * 0.28 + split * 0.06 - combine * 0.22 - finale * 0.1,
    ),
    "--core-turn": `${-35 + first * 18 - split * 16 + combine * 55 + finale * 20}deg`,
    "--core-tilt": `${58 - first * 7 + split * 9 - combine * 6}deg`,
    "--explode": String(split * (1 - combine)),
    "--orbit-opacity": String(
      range(p, 0.28, 0.36) * (1 - range(p, 0.71, 0.83)),
    ),
    "--chapter-one": String(pulse(p, 0.105, 0.32)),
    "--chapter-two": String(pulse(p, 0.34, 0.64)),
    "--chapter-three": String(pulse(p, 0.68, 1.07)),
    "--story-progress": String(p),
    "--scene-fade": String(1 - finale * 0.9),
    "--grid-turn": `${p * 12}deg`,
  };
}

export function useScrollChoreography() {
  const root = useRef<HTMLDivElement>(null);
  const story = useRef<HTMLElement>(null);
  useEffect(() => {
    const element = root.current;
    const scene = story.current;
    if (!element || !scene) return;
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let disposed = false;
    let current = 0;
    let target = 0;
    const animated = [
      ...element.querySelectorAll<HTMLElement>("[data-parallax]"),
    ];
    const paint = () => {
      if (disposed) return;
      frame = 0;
      const rect = scene.getBoundingClientRect();
      target = clamp(-rect.top / Math.max(1, rect.height - innerHeight));
      current =
        Math.abs(target - current) < 0.0003
          ? target
          : current + (target - current) * 0.15;
      const state = sceneAt(current, innerWidth < 760);
      const parallax = animated.map((node) => ({
        node,
        rect: node.getBoundingClientRect(),
        amount: Number(node.dataset.parallax),
      }));
      // All geometry reads precede writes. No React state updates during scrolling.
      if (!media.matches) {
        Object.entries(state).forEach(([key, value]) =>
          scene.style.setProperty(key, value),
        );
        parallax.forEach(({ node, rect: r, amount }) => {
          if (r.bottom > -innerHeight && r.top < innerHeight * 2) {
            node.style.setProperty(
              "--parallax",
              `${clamp((innerHeight - r.top) / (innerHeight + r.height)) * amount}px`,
            );
          }
        });
      }
      if (Math.abs(current - target) > 0.0003 && !media.matches)
        frame = requestAnimationFrame(paint);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(paint);
    };
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add("is-visible");
        });
      },
      { threshold: 0.12 },
    );
    element
      .querySelectorAll("[data-reveal]")
      .forEach((node) => observer.observe(node));
    const motionChange = () => {
      element.dataset.reducedMotion = String(media.matches);
      schedule();
    };
    motionChange();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    media.addEventListener("change", motionChange);
    schedule();
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      media.removeEventListener("change", motionChange);
    };
  }, []);
  return { root, story };
}
