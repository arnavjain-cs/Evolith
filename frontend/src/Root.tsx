import { lazy, Suspense, useEffect, useState } from "react";
import Home from "./Home";

const Agents = lazy(() => import("./Agents"));
const Studio = lazy(() => import("./App"));

export default function Root() {
  const [route, setRoute] = useState(() => location.hash);
  const studio = route === "#studio";
  const agents = route === "#agents";
  useEffect(() => {
    document.title = agents ? "Evolith — Agent workspace" : studio
      ? "Evolith — Model studio"
      : "Evolith — Intelligence, by your design.";
  }, [studio, agents]);
  useEffect(() => {
    const navigate = () => {
      const next = location.hash === "#studio";
      setRoute(location.hash);
      if (next || location.hash === "#agents" || !location.hash)
        window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    };
    window.addEventListener("hashchange", navigate);
    return () => window.removeEventListener("hashchange", navigate);
  }, []);
  return studio || agents ? (
    <Suspense
      fallback={
        <div className="route-loading" role="status">
          Opening your workspace…
        </div>
      }
    >
      {agents ? <Agents /> : <Studio />}
    </Suspense>
  ) : (
    <Home />
  );
}
