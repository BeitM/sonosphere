"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { ArrowRight, Check, CircleAlert, ExternalLink, ImagePlus, LoaderCircle, RefreshCw, Sparkles, X } from "lucide-react";
import type { GeneratedReferenceImage } from "@/lib/reference-images";
import { WORLD_LABS_MODELS, type WorldLabsModel, type WorldLabsOperation } from "@/lib/worldlabs/schemas";
import { WorldViewer } from "./world-viewer";

type Phase = "idle" | "confirm" | "starting" | "polling" | "complete" | "error";
type ReferencePhase = "idle" | "generating" | "ready" | "error";

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
  const [referencePhase, setReferencePhase] = useState<ReferencePhase>("idle");
  const [referenceImage, setReferenceImage] = useState<GeneratedReferenceImage | null>(null);
  const [useReference, setUseReference] = useState(true);
  const [referenceError, setReferenceError] = useState("");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const modelInfo = WORLD_LABS_MODELS[model];
  const hasReference = useReference && Boolean(referenceImage);
  const generationCredits = hasReference ? modelInfo.panoramaCredits : modelInfo.credits;
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

  const generateReference = async () => {
    setReferenceError(""); setReferencePhase("generating");
    try {
      const response = await fetch("/api/world/reference-image", { method: "POST", headers, body: JSON.stringify({ prompt }) });
      const next = await responseJson<GeneratedReferenceImage>(response);
      if (!response.ok) throw new Error(next.error || "The visual reference could not be generated.");
      setReferenceImage(next); setUseReference(true); setReferencePhase("ready");
    } catch (cause) {
      setReferenceError(cause instanceof Error ? cause.message : "The visual reference could not be generated.");
      setReferencePhase("error");
    }
  };

  const start = async () => {
    setError(""); setPhase("starting"); setOperation(null);
    try {
      const referenceImages = hasReference && referenceImage ? [{
        dataBase64: referenceImage.dataBase64,
        extension: referenceImage.extension,
        isPanorama: referenceImage.isPanorama,
      }] : [];
      const response = await fetch("/api/world-labs/generate", { method: "POST", headers, body: JSON.stringify({ prompt, displayName: title.slice(0, 64) || "Sonosphere world", model, referenceImages }) });
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
    {phase === "idle" && <div className="generation-setup">
      <div className="reference-stage">
        <div className="reference-copy"><p className="kicker">Visual grounding · Recommended</p><h2>Give Marble a coherent view.</h2><p>Generate one song-specific 360° panorama before the paid world build. World Labs receives the selected image together with the Marble prompt, giving it firmer composition, materials, and lighting than text alone.</p></div>
        {referencePhase === "generating" && <div className="reference-loading" role="status"><LoaderCircle size={28} /><strong>Generating the environment reference…</strong><span>This OpenAI image request can take up to two minutes.</span></div>}
        {referenceImage && referencePhase === "ready" && <div className="reference-preview">
          <Image src={`data:${referenceImage.mimeType};base64,${referenceImage.dataBase64}`} alt="Generated 360-degree reference for the world" width={1024} height={512} unoptimized />
          <div><label className="reference-toggle"><input type="checkbox" checked={useReference} onChange={(event) => setUseReference(event.target.checked)} /><span><strong>Use this panorama</strong><small>Submit it with the text prompt</small></span></label><button className="secondary-button" onClick={generateReference}><RefreshCw size={14} /> Regenerate</button></div>
        </div>}
        {(referencePhase === "idle" || referencePhase === "error") && <div className="reference-action">{referenceError && <p className="reference-error"><CircleAlert size={15} />{referenceError}</p>}<button className="secondary-button reference-button" onClick={generateReference}><ImagePlus size={16} /> Generate visual reference</button><small>One explicit, paid OpenAI image request · medium-quality JPEG · kept only in this page</small></div>}
      </div>
      <div className="generation-intro"><div><p className="kicker">World Labs API · Optional paid step</p><h2>Build and explore it here.</h2><p>{hasReference ? "The selected panorama and Marble-ready prompt will be submitted together." : "No reference is selected, so World Labs will use the text prompt alone."} Monitor the approximately five-minute generation, then load the resulting SPZ world in Sonosphere’s SparkJS viewer.</p></div><div className="generation-controls"><label><span>World model</span><select value={model} onChange={(event) => setModel(event.target.value as WorldLabsModel)}>{Object.entries(WORLD_LABS_MODELS).map(([value, option]) => <option value={value} key={value}>{option.label} · {hasReference ? option.panoramaCredits : option.credits}</option>)}</select></label><label><span>Generation access code <em>hosted sites only</em></span><input type="password" autoComplete="off" value={accessCode} onChange={(event) => setAccessCode(event.target.value)} placeholder="Optional on localhost" /></label><button className="primary-button" onClick={() => setPhase("confirm")}><Sparkles size={16} /> Review paid generation <ArrowRight size={16} /></button></div></div>
    </div>}
    {phase === "confirm" && <div className="generation-confirm"><button className="generation-close" onClick={() => setPhase("idle")} aria-label="Cancel generation confirmation"><X size={17} /></button><span className="generation-model">{modelInfo.label}</span><h2>Confirm World Labs generation</h2><p>This creates a private world using <strong>{generationCredits}</strong>. Once submitted, the credit charge cannot be cancelled from Sonosphere.</p><div className="generation-facts"><span><small>INPUT</small><strong>{hasReference ? "360° panorama + text" : "Text prompt only"} · {prompt.length.toLocaleString()} characters</strong></span><span><small>EXPECTED TIME</small><strong>Approximately 5 minutes</strong></span><span><small>VISIBILITY</small><strong>Private by default</strong></span></div><div className="generation-confirm-actions"><button className="secondary-button" onClick={() => setPhase("idle")}>Not yet</button><button className="primary-button" onClick={start}><Check size={16} /> Generate world</button></div></div>}
    {(phase === "starting" || phase === "polling") && <div className="generation-progress" aria-live="polite"><span className="generation-spinner"><LoaderCircle size={31} /></span><div><p className="kicker">{operation?.status || "SUBMITTING"}</p><h2>{operation?.description || "Starting private world generation…"}</h2><p>World Labs generations usually take about five minutes. You can leave this tab open while Sonosphere checks progress.</p></div><div className="generation-time"><strong>{minutes}:{seconds}</strong><span>elapsed</span></div>{progress != null && <div className="generation-progress-bar"><span style={{ width: `${Math.max(2, Math.min(100, progress))}%` }} /></div>}</div>}
    {phase === "error" && <div className="generation-failure"><CircleAlert size={22} /><div><h3>World generation needs attention</h3><p>{error}</p><p>No retry is automatic, so Sonosphere will not accidentally start another paid generation.</p></div><button className="secondary-button" onClick={() => setPhase("idle")}>Return to setup</button></div>}
    {phase === "complete" && operation?.world && <div className="generated-world"><div className="generated-world-head"><div><span className="generation-model">WORLD READY · {operation.world.model || modelInfo.label}</span><h2>{operation.world.displayName || title}</h2><p>{operation.world.caption || "World Labs completed this generated environment."}</p><div className="generated-world-meta"><span>{operation.cost ? `${operation.cost.totalCredits.toLocaleString()} credits used` : "Usage recorded by World Labs"}</span><span>{Object.keys(operation.world.spzUrls).length} SPZ qualities</span></div></div>{operation.world.thumbnailUrl && <Image src={operation.world.thumbnailUrl} alt={`Preview of ${operation.world.displayName}`} width={150} height={90} unoptimized />}<a className="primary-button" href={operation.world.marbleUrl} target="_blank" rel="noreferrer">Open in Marble <ExternalLink size={16} /></a></div><WorldViewer world={operation.world} /></div>}
  </section>;
}
