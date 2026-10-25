# The ModelForge home page

Open `/` for the animated introduction, or `/#studio` to enter the working studio directly. The studio's ModelForge brand link returns home.

## The scroll experience

The opening sequence holds a six-layer model core in the viewport through three chapters. Scrolling first enlarges and turns the assembled object, then separates the specialist layers, then recombines them into a new orientation. Reversing the scroll reverses the transformation. The page uses native scrolling; it does not capture wheel or touch gestures or force scroll snapping.

The following sections add a moving typography strip, staggered feature illustrations, an interactive neural-network signal diagram, and an oversized wordmark with parallax at the closing invitation. The coding slider changes the relative strength of coding and writing connections, neurons, and flowing signal particles, updates the displayed coefficients, and sends that exact recipe to the working studio when **Try this combination** is selected. Writing is the complementary coefficient in this home-page control; the full studio has independent controls.

The neural-network animation pauses when outside the viewport and removes moving particles when reduced motion is requested. Its signal activity illustrates the selected coefficients; it is not a display of actual model activations.

The hero hardware object is a visual explanation. It does not represent inference, training progress, benchmark scores, or a measured skill percentage. Its construction uses six-sided CSS layers and inline SVG details, without video assets, downloaded image sequences, or a WebGL library.

## Motion and accessibility

The animation uses a passive scroll listener and `requestAnimationFrame`. Geometry reads precede style writes; scroll frames update CSS transform/opacity variables rather than React state. The main choreography is defined by the pure `sceneAt` function in `frontend/src/scroll.ts`.

With **prefers-reduced-motion**, the pinned sequence becomes a normal-flow reading layout: all chapters remain visible and large spatial motion is removed. The blend slider and studio navigation remain functional. Light and dark appearances share the existing semantic theme. Both appearances, mobile overflow, keyboard use and actual route transitions have automated browser coverage.

## Local checks

```bash
cd frontend
npm run build
npm run test:e2e
```

Playwright's default Chromium must be installed, or set `PLAYWRIGHT_CHROME=1` to use an installed Chrome. The browser test setup can start the Python API; set `MODELFORGE_PYTHON=../.venv/bin/python` if needed.

To repeat the performance diagnostic with the app already running:

```bash
PLAYWRIGHT_CHROME=1 npm run measure:home
```

The diagnostic uses a 390 × 844 viewport, 4× CPU slowdown, a cold browser cache and a connection limited to 1.6 Mbps with 150 ms latency. It reports LCP, layout shift and sampled scroll-frame durations. The single slider keypress sample is not a complete INP measurement; null means no qualifying Event Timing entry was observed. It is a local lab sample, not a Lighthouse score or field Core Web Vitals certification. The delivery sample is saved in `docs/home-performance.json`.

No new runtime dependencies are needed for the home page. The studio and Markdown renderer load only when the studio is opened.
