"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { ArrowRight, Check, CircleAlert, ExternalLink, LoaderCircle, Sparkles, X } from "lucide-react";
import { WORLD_LABS_MODELS, type WorldLabsModel, type WorldLabsOperation } from "@/lib/worldlabs/schemas";
import { WorldViewer } from "./world-viewer";

type Phase = "idle" | "confirm" | "starting" | "polling" | "complete" | "error";

async function responseJson<T>(response: Response): Promise<T & { error?: string }> {
  const text = await response.text();
  try { return JSON.parse(text) as T & { error?: string }; }
  catch { throw new Error(`The World Labs route returned an invalid response (HTTP ${response.status}).`); }
}

export function WorldGeneration({ prompt, title }: { prompt: string; title: string }) {
  const [model, setModel] = useState<WorldLabsModel>("marble-1.1-plus");
  const [phase, setPhase] = useState<Phase>("idle");
  const [operation, setOperation] = useState<WorldLabsOperation | null>(null);
  const [accessCode, setAccessCode] = useState("");
  const [error, setError] = useState("");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const modelInfo = WORLD_LABS_MODELS[model];
  const headers = useMemo(() => ({ "Content-Type": "application/json", ...(accessCode ? { Authorization: `Bearer ${accessCode}` } : {}) }), [accessCode]);

  useEffect(() => {
    if (!startedAt || phase !== "polling") return;
    const update = () => setElapsed(Math.floor((Date.now() - startedAt) / 1_000));
    update(); const timer = window.setInterval(update, 1_000); return () => window.clearInterval(timer);
  }, [phase, startedAt]);

  useEffect(() => {
    if (phase !== "polling" || !operation?.operationId) return;
    let active = true;
    let timer: number | undefined;
    const poll = async () => {
      try {
        const response = await fetch(`/api/world-labs/operations/${encodeURIComponent(operation.operationId)}`, { headers });
        const next = await responseJson<WorldLabsOperation>(response);
        if (!response.ok) throw new Error(next.error || "World generation status could not be loaded.");
        if (!active) return;
        setOperation(next);
        if (next.done) {
          if (next.error) { setError(next.error.message); setPhase("error"); }
          else if (next.world) setPhase("complete");
          else { setError("World Labs completed the operation without returning a world."); setPhase("error"); }
        } else timer = window.setTimeout(poll, 8_000);
      } catch (cause) {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : "World generation status could not be loaded.");
        timer = window.setTimeout(poll, 12_000);
      }
    };
    timer = window.setTimeout(poll, 2_000);
    return () => { active = false; if (timer) window.clearTimeout(timer); };
  }, [headers, operation?.operationId, phase]);

  const start = async () => {
    setError(""); setPhase("starting"); setOperation(null);
    try {
      const response = await fetch("/api/world-labs/generate", { method: "POST", headers, body: JSON.stringify({ prompt, displayName: title.slice(0, 64) || "Sonosphere world", model }) });
      const next = await responseJson<WorldLabsOperation>(response);
      if (!response.ok) throw new Error(next.error || "World generation could not be started.");
      setOperation(next); setStartedAt(Date.now());
      if (next.done && next.error) { setError(next.error.message); setPhase("error"); }
      else if (next.done && next.world) setPhase("complete");
      else setPhase("polling");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "World generation could not be started."); setPhase("error"); }
  };

  const minutes = Math.floor(elapsed / 60);
  const seconds = String(elapsed % 60).padStart(2, "0");
  const progress = operation?.progress == null ? null : operation.progress <= 1 ? operation.progress * 100 : operation.progress;

  return <section className="result-section generation-section">
    <div className="section-label"><span>05</span><p>Generate the world</p></div>
    {phase === "idle" && <div className="generation-intro"><div><p className="kicker">World Labs API · Optional paid step</p><h2>Build and explore it here.</h2><p>Send the Marble-ready prompt to World Labs, monitor the approximately five-minute generation, then load the resulting SPZ world in Sonosphere’s SparkJS viewer.</p></div><div className="generation-controls"><label><span>World model</span><select value={model} onChange={(event) => setModel(event.target.value as WorldLabsModel)}>{Object.entries(WORLD_LABS_MODELS).map(([value, option]) => <option value={value} key={value}>{option.label} · {option.credits}</option>)}</select></label><label><span>Generation access code <em>hosted sites only</em></span><input type="password" autoComplete="off" value={accessCode} onChange={(event) => setAccessCode(event.target.value)} placeholder="Optional on localhost" /></label><button className="primary-button" onClick={() => setPhase("confirm")}><Sparkles size={16} /> Review paid generation <ArrowRight size={16} /></button></div></div>}
    {phase === "confirm" && <div className="generation-confirm"><button className="generation-close" onClick={() => setPhase("idle")} aria-label="Cancel generation confirmation"><X size={17} /></button><span className="generation-model">{modelInfo.label}</span><h2>Confirm World Labs generation</h2><p>This creates a private world using <strong>{modelInfo.credits}</strong>. Once submitted, the credit charge cannot be cancelled from Sonosphere.</p><div className="generation-facts"><span><small>INPUT</small><strong>Text prompt · {prompt.length.toLocaleString()} characters</strong></span><span><small>EXPECTED TIME</small><strong>Approximately 5 minutes</strong></span><span><small>VISIBILITY</small><strong>Private by default</strong></span></div><div className="generation-confirm-actions"><button className="secondary-button" onClick={() => setPhase("idle")}>Not yet</button><button className="primary-button" onClick={start}><Check size={16} /> Generate world</button></div></div>}
    {(phase === "starting" || phase === "polling") && <div className="generation-progress" aria-live="polite"><span className="generation-spinner"><LoaderCircle size={31} /></span><div><p className="kicker">{operation?.status || "SUBMITTING"}</p><h2>{operation?.description || "Starting private world generation…"}</h2><p>World Labs generations usually take about five minutes. You can leave this tab open while Sonosphere checks progress.</p></div><div className="generation-time"><strong>{minutes}:{seconds}</strong><span>elapsed</span></div>{progress != null && <div className="generation-progress-bar"><span style={{ width: `${Math.max(2, Math.min(100, progress))}%` }} /></div>}</div>}
    {phase === "error" && <div className="generation-failure"><CircleAlert size={22} /><div><h3>World generation needs attention</h3><p>{error}</p><p>No retry is automatic, so Sonosphere will not accidentally start another paid generation.</p></div><button className="secondary-button" onClick={() => setPhase("idle")}>Return to setup</button></div>}
    {phase === "complete" && operation?.world && <div className="generated-world"><div className="generated-world-head"><div><span className="generation-model">WORLD READY · {operation.world.model || modelInfo.label}</span><h2>{operation.world.displayName || title}</h2><p>{operation.world.caption || "World Labs completed this generated environment."}</p><div className="generated-world-meta"><span>{operation.cost ? `${operation.cost.totalCredits.toLocaleString()} credits used` : "Usage recorded by World Labs"}</span><span>{Object.keys(operation.world.spzUrls).length} SPZ qualities</span></div></div>{operation.world.thumbnailUrl && <Image src={operation.world.thumbnailUrl} alt={`Preview of ${operation.world.displayName}`} width={150} height={90} unoptimized />}<a className="primary-button" href={operation.world.marbleUrl} target="_blank" rel="noreferrer">Open in Marble <ExternalLink size={16} /></a></div><WorldViewer world={operation.world} /></div>}
  </section>;
}
