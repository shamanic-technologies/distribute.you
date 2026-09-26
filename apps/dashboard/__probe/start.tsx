import "./fetchstub";
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { StartPicks, useStartCatalogue, type StartScreen } from "@/components/start/start-picks";
function App() {
  const q = new URLSearchParams(location.search);
  const [screen, setScreen] = useState<StartScreen>((q.get("screen") as StartScreen) ?? "outcome");
  const [outcomes, setOutcomes] = useState<string[]>(q.get("o") ? q.get("o")!.split(",") : []);
  const { catalogue, catalogueError } = useStartCatalogue();
  return <StartPicks screen={screen} catalogue={catalogue} catalogueError={catalogueError} outcomes={outcomes}
    onOutcomesChange={setOutcomes} onScreenChange={setScreen} onContinue={() => console.log("PUSH continue")} brandHost="docdinners.com" />;
}
createRoot(document.getElementById("root")!).render(<App />);
