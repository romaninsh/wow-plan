import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";
import { createVantage } from "@vantage-ui/client";
import { VantageProvider } from "@vantage-ui/client/react";
import { schema, type Schema } from "./vantage.gen";
import { ConnectionGate } from "./ConnectionGate";
import { startAnalytics } from "./analytics";
import { About, AboutLink } from "./components/About";
import { Home } from "./pages/Home";
import { PlanPage } from "./pages/PlanPage";
import "@fontsource/cinzel/400.css";
import "@fontsource/cinzel/700.css";
import "@fontsource/cinzel-decorative/700.css";
import "@fontsource/alegreya/400.css";
import "@fontsource/alegreya/400-italic.css";
import "@fontsource/alegreya/700.css";
import "@fontsource/marcellus/400.css";
import "./styles.css";

// The anonymous session's token stays in localStorage: a reload or another tab resumes the
// session, with the plans it unlocked.
const db = createVantage<Schema>({ schema, session: "localStorage" });

startAnalytics();

// Plans live under /p/<id>: the API reserves top-level paths shaped v<digits>, which a random
// 7-character id could be. About this demo sits outside the connection, so it opens while the
// server is unreachable too; at /about it shows over the intro page.
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <VantageProvider db={db} fallback={<ConnectionGate />}>
      <ConnectionGate>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<Home />} />
            <Route path="/p/:id" element={<PlanPage />} />
          </Routes>
        </BrowserRouter>
      </ConnectionGate>
    </VantageProvider>
    <AboutLink />
    <About />
  </StrictMode>,
);
