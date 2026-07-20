"use client";

import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronDown, CircleAlert, Clipboard, Download, ExternalLink, FileAudio, FileJson, Layers3, LoaderCircle, Music2, RotateCcw, Sparkles, Upload, X } from "lucide-react";
import type { MusicalAnalysis, Refinement, SongIdentification, SongWorldAnalysis } from "@/lib/schemas";
import { WorldGeneration } from "./world-generation";

type Step = "upload" | "confirm" | "generating" | "results";
type FixtureId = "known" | "obscure" | "instrumental";
const maxBytes = 25 * 1024 * 1024;
const accepted = [".mp3", ".wav", ".m4a", ".flac"];
const defaults: Refinement = { balance: "balanced", realism: "mixed", scale: "monumental", intensity: "intense", worldType: "auto", userNote: "" };

async function readApiResponse<T extends object>(response: Response, fallback: string): Promise<T & { error?: string }> {
  const raw = await response.text();
  if (!raw) throw new Error(`${fallback} The server returned an empty response (HTTP ${response.status}).`);
  try {
    return JSON.parse(raw) as T & { error?: string };
  } catch {
    if (response.status === 413) throw new Error("The server rejected the audio upload as too large. Choose a file smaller than 25 MB and restart the development server if its upload limit was just changed.");
    throw new Error(`${fallback} The server returned a non-JSON response (HTTP ${response.status}).`);
  }
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: React.ReactNode }) {
  return <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}

function SelectField({ label, value, options, onChange, hint }: { label: string; value: string; options: Array<[string, string]>; onChange: (value: string) => void; hint?: React.ReactNode }) {
  return <Field label={label} hint={hint}><span className="select-wrap"><select value={value} onChange={(event) => onChange(event.target.value)}>{options.map(([key, text]) => <option value={key} key={key}>{text}</option>)}</select><ChevronDown size={16} /></span></Field>;
}

function Header({ step, reset }: { step: Step; reset: () => void }) {
  return <header className="topbar">
    <button className="brand" onClick={reset} aria-label="Sonosphere home"><span className="brand-mark"><span /><span /><span /><span /></span><span>sonosphere</span></button>
    <div className="topbar-right"><span className="mode"><span /> Analysis studio</span>{step !== "upload" && <button className="text-button" onClick={reset}>New analysis</button>}<a href="#privacy" className="text-link">Privacy</a></div>
  </header>;
}

function Progress({ step, canConfirm, canShowResults, onNavigate }: { step: Step; canConfirm: boolean; canShowResults: boolean; onNavigate: (target: "upload" | "confirm" | "results") => void }) {
  const current = step === "upload" ? 1 : step === "confirm" ? 2 : step === "generating" ? 3 : 4;
  const items: Array<{ label: string; target?: "upload" | "confirm" | "results"; enabled: boolean }> = [
    { label: "Upload", target: "upload", enabled: step !== "generating" },
    { label: "Confirm", target: "confirm", enabled: step !== "generating" && canConfirm },
    { label: "Interpret", enabled: false },
    { label: "World prompt", target: "results", enabled: step !== "generating" && canShowResults },
  ];
  return <div className="progress" aria-label={`Step ${current} of 4`}>
    {items.map((item, index) => <div className={`progress-item ${index + 1 < current ? "complete" : ""} ${index + 1 === current ? "active" : ""}`} key={item.label}><button type="button" className={`progress-step ${item.enabled && item.target && index + 1 !== current ? "navigable" : ""}`} disabled={!item.enabled || !item.target || index + 1 === current} onClick={() => item.target && onNavigate(item.target)} aria-current={index + 1 === current ? "step" : undefined}><span>{index + 1 < current ? <Check size={13} /> : index + 1}</span><em>{item.label}</em></button>{index < 3 && <i />}</div>)}
  </div>;
}

export function Studio() {
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const fixtureId: FixtureId = "known";
  const useFixture = false;
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [album, setAlbum] = useState("");
  const [identification, setIdentification] = useState<SongIdentification | null>(null);
  const [manualLyrics, setManualLyrics] = useState("");
  const [manualContext, setManualContext] = useState("");
  const [personal, setPersonal] = useState("");
  const [visualPreference, setVisualPreference] = useState("");
  const [emphasis, setEmphasis] = useState("");
  const [refinement, setRefinement] = useState<Refinement>(defaults);
  const [analysis, setAnalysis] = useState<SongWorldAnalysis | null>(null);
  const [musicAnalysis, setMusicAnalysis] = useState<MusicalAnalysis | null>(null);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [copied, setCopied] = useState<"marble" | "full" | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => { setStep("upload"); setFile(null); setIdentification(null); setAnalysis(null); setMusicAnalysis(null); setError(""); setTitle(""); setArtist(""); setAlbum(""); setManualLyrics(""); setManualContext(""); setPersonal(""); setVisualPreference(""); setEmphasis(""); setRefinement(defaults); };
  const chooseFile = (next: File | null) => {
    setError("");
    if (!next) return;
    const supported = accepted.some((ext) => next.name.toLowerCase().endsWith(ext));
    if (!supported) return setError("Use an MP3, WAV, M4A, or FLAC audio file.");
    if (!next.size) return setError("That file appears to be empty or unreadable.");
    if (next.size > maxBytes) return setError("Choose a file smaller than 25 MB for this prototype.");
    setFile(next); setMusicAnalysis(null); setIdentification(null); setAnalysis(null);
  };

  const identify = async () => {
    const selectedFixture = fixtureId;
    const selectedFile = file;
    if (!selectedFile) return setError("Choose an audio file before continuing.");
    setMusicAnalysis(null); setError(""); setStep("generating");
    try {
      const body = new FormData(); body.append("audio", selectedFile); body.append("fixtureId", selectedFixture); body.append("useFixture", String(useFixture)); body.append("title", title); body.append("artist", artist);
      const response = await fetch("/api/song/identify", { method: "POST", body });
      const json = await readApiResponse<SongIdentification>(response, "Identification failed."); if (!response.ok) throw new Error(json.error || "Identification failed.");
      setIdentification(json); setTitle(title || json.title || ""); setArtist(artist || json.artist || ""); setAlbum(album || json.album || ""); setStep("confirm");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Identification failed."); setStep("upload"); }
  };

  const generate = async () => {
    if (!identification) return;
    setError(""); setStep("generating");
    try {
      if (!file) throw new Error("The audio file is no longer available. Please select it again.");
      let analyzedMusic = musicAnalysis;
      if (!analyzedMusic) {
        const audioBody = new FormData(); audioBody.append("audio", file); audioBody.append("fixtureId", fixtureId); audioBody.append("useFixture", String(useFixture));
        const audioResponse = await fetch("/api/song/analyze-audio", { method: "POST", body: audioBody });
        const audioJson = await readApiResponse<MusicalAnalysis>(audioResponse, "Audio analysis failed.");
        if (!audioResponse.ok) throw new Error(audioJson.error || "Audio analysis failed.");
        analyzedMusic = audioJson; setMusicAnalysis(audioJson);
      }
      const confirmedIdentification = !useFixture && title.trim() && artist.trim()
        ? { ...identification, title: title.trim(), artist: artist.trim(), album: album.trim() || undefined, confidence: 1, provider: "User-confirmed identity", alternatives: [] }
        : identification;
      const response = await fetch("/api/world/generate-prompt", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fixtureId, useFixture, identification: confirmedIdentification, musicAnalysis: analyzedMusic, confirmed: { title, artist, album }, manualLyrics: manualLyrics || undefined, personalInterpretation: personal || undefined, visualPreference: visualPreference || undefined, emphasisNote: emphasis || undefined, manualContext: manualContext || undefined, refinement }) });
      const json = await readApiResponse<SongWorldAnalysis>(response, "Prompt generation failed."); if (!response.ok) throw new Error(json.error || "Prompt generation failed.");
      setAnalysis(json); setStep("results"); window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Prompt generation failed."); setStep("confirm"); }
  };

  const navigate = (target: "upload" | "confirm" | "results") => { setError(""); setStep(target); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const copyPrompt = async (kind: "marble" | "full") => { if (!analysis) return; await navigator.clipboard.writeText(kind === "marble" ? analysis.worldPrompt.marblePrompt : analysis.worldPrompt.prompt); setCopied(kind); setTimeout(() => setCopied(null), 1800); };
  const download = () => { if (!analysis) return; const url = URL.createObjectURL(new Blob([JSON.stringify(analysis, null, 2)], { type: "application/json" })); const link = document.createElement("a"); link.href = url; link.download = `${(title || "song").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-world-analysis.json`; link.click(); URL.revokeObjectURL(url); };
  const azLyricsUrl = `https://search.azlyrics.com/search.php?q=${encodeURIComponent([title, artist].filter(Boolean).join(" "))}`;
  const geniusUrl = `https://genius.com/search?q=${encodeURIComponent([title, artist].filter(Boolean).join(" "))}`;
  const identityConfirmedByUser = !useFixture && Boolean(title.trim() && artist.trim());

  return <main><Header step={step} reset={reset} /><div className="page-shell"><Progress step={step} canConfirm={Boolean(identification)} canShowResults={Boolean(analysis)} onNavigate={navigate} />
    {error && <div className="error-banner"><CircleAlert size={18} /><span>{error}</span><button onClick={() => setError("")} aria-label="Dismiss error"><X size={16} /></button></div>}
    {step === "upload" && <section className="upload-layout">
      <div className="hero-block"><p className="kicker">Music interpretation studio</p><h1>Turn a song into<br />a world.</h1><p className="lede">Upload a track. Sonosphere gathers the meaning, maps its emotional movement, and writes a detailed prompt for a coherent, explorable 3D environment.</p>
        <div className="trust-row"><span><Check size={15} /> Audio is temporary</span><span><Check size={15} /> Optional private 3D generation</span><span><Check size={15} /> Analysis works without generation</span></div>
      </div>
      <div className="upload-grid">
        <section className="panel upload-panel">
          <div className="panel-heading"><div><span className="step-tag">01</span><h2>Add your song</h2></div><span className="optional">MP3 · WAV · M4A · FLAC</span></div>
          {!file ? <button className={`dropzone ${dragging ? "dragging" : ""}`} onClick={() => inputRef.current?.click()} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); chooseFile(event.dataTransfer.files[0] ?? null); }}>
            <span className="upload-icon"><Upload size={24} /></span><strong>Drop a song here</strong><span>or click to choose from your device</span><small>Up to 25 MB · Audio stays on this server during processing</small>
          </button> : <div className="file-card"><span className="file-icon"><FileAudio size={24} /></span><div><strong>{file.name}</strong><span>{(file.size / 1024 / 1024).toFixed(2)} MB · Ready to analyze</span></div><button onClick={() => setFile(null)} aria-label="Remove file"><X size={18} /></button></div>}
          <input ref={inputRef} hidden type="file" accept={accepted.join(",")} onChange={(event) => chooseFile(event.target.files?.[0] ?? null)} />
          <div className="divider"><span>Optional details</span></div>
          <div className="field-grid"><Field label="Song title"><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="If you know it" /></Field><Field label="Artist"><input value={artist} onChange={(e) => setArtist(e.target.value)} placeholder="Artist name" /></Field></div>
          <button className="primary-button" onClick={identify}><Sparkles size={17} /> Continue to song details <ArrowRight size={17} /></button>
          <p className="privacy-note">Automatic recording recognition is not connected yet. Add the title and artist when you know them; Sonosphere treats both fields as user-confirmed.</p>
          <p className="privacy-note"><span>Private by design.</span> Real analysis sends the temporary upload only to the configured audio-analysis service; the recording is not stored by Sonosphere.</p>
        </section>
      </div></section>}
    {step === "confirm" && identification && <section className="confirm-layout">
      <div className="section-intro"><button className="back-button" onClick={() => setStep("upload")}><ArrowLeft size={16} /> Back to upload</button><p className="kicker">Identity check</p><h1>Add or confirm the song.</h1><p>Song recognition is not connected yet. Title and artist values that you supply are treated as confirmed metadata, separate from automatic recognition.</p></div>
      <div className="confirm-grid"><section className="panel identity-panel"><div className="match-banner"><span className="record-disc"><span /></span><div><small>{identityConfirmedByUser ? "Confirmed by you" : `Reported by ${identification.provider}`}</small><strong>{title || identification.title || "No confirmed title"}</strong><span>{artist || identification.artist || "Unknown artist"}{(album || identification.album) ? ` · ${album || identification.album}` : ""}</span></div><div className="confidence-ring" style={{ "--score": `${Math.round((identityConfirmedByUser ? 1 : identification.confidence) * 360)}deg` } as React.CSSProperties}><span>{Math.round((identityConfirmedByUser ? 1 : identification.confidence) * 100)}<small>%</small></span></div></div>
        {!identityConfirmedByUser && identification.confidence < 0.5 && <div className="low-confidence"><CircleAlert size={17} /><span><strong>Identity is not confirmed.</strong> That’s okay—Sonosphere will rely on the recording and your guidance.</span></div>}
        <div className="field-grid"><Field label="Confirmed title"><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Untitled" /></Field><Field label="Confirmed artist"><input value={artist} onChange={(e) => setArtist(e.target.value)} placeholder="Unknown artist" /></Field></div><Field label="Album"><input value={album} onChange={(e) => setAlbum(e.target.value)} placeholder="Optional" /></Field>
        {identification.alternatives && identification.alternatives.length > 1 && <details className="alternatives"><summary>Other possible matches <ChevronDown size={15} /></summary>{identification.alternatives.slice(1).map((match) => <button key={`${match.title}-${match.artist}`} onClick={() => { setTitle(match.title); setArtist(match.artist); }}>{match.title} — {match.artist}<span>{Math.round(match.confidence * 100)}%</span></button>)}</details>}
      </section>
      <section className="panel guidance-panel"><div className="panel-heading"><div><span className="step-tag">02</span><h2>Shape the reading</h2></div><span className="optional">All optional</span></div><Field label="Personal interpretation"><textarea rows={3} value={personal} onChange={(e) => setPersonal(e.target.value)} placeholder="What does this song mean to you?" /></Field><Field label="Lyrics override" hint={<span>After confirmation, Sonosphere automatically checks LRCLIB. Pasted text takes priority. If no match is found, open <a className="lyrics-source-link" href={azLyricsUrl} target="_blank" rel="noreferrer">AZLyrics <ExternalLink size={11} /></a> or <a className="lyrics-source-link" href={geniusUrl} target="_blank" rel="noreferrer">Genius <ExternalLink size={11} /></a> and paste text you may use.</span>}><textarea rows={3} value={manualLyrics} onChange={(e) => setManualLyrics(e.target.value)} placeholder="Optional: paste lyrics to override automatic lookup…" /></Field><Field label="Context or source note"><textarea rows={2} value={manualContext} onChange={(e) => setManualContext(e.target.value)} placeholder="Artist statement, album note, or factual context…" /></Field><div className="field-grid"><Field label="Visual preference"><input value={visualPreference} onChange={(e) => setVisualPreference(e.target.value)} placeholder="e.g. weathered stone" /></Field><Field label="Emphasize"><input value={emphasis} onChange={(e) => setEmphasis(e.target.value)} placeholder="e.g. restrained anger" /></Field></div></section></div>
      <section className="panel controls-panel"><div className="panel-heading"><div><span className="step-tag">03</span><h2>Set the creative balance</h2></div><span className="optional">You can change these later</span></div><div className="controls-grid">
        <SelectField label="Interpretation balance" hint="Controls which evidence most strongly shapes the concept." value={refinement.balance} onChange={(value) => setRefinement({ ...refinement, balance: value as Refinement["balance"] })} options={[["balanced", "Balanced"], ["lyrics", "Emphasize lyrics"], ["music", "Emphasize musical sound"], ["context", "Emphasize external context"], ["personal", "Emphasize personal reading"]]} />
        <SelectField label="Visual realism" hint="Controls physical plausibility, not emotional intensity." value={refinement.realism} onChange={(value) => setRefinement({ ...refinement, realism: value as Refinement["realism"] })} options={[["realistic", "Realistic"], ["cinematic", "Cinematic"], ["surreal", "Surreal"], ["abstract", "Abstract"], ["mixed", "Mixed"]]} />
        <SelectField label="Environmental scale" hint="A hard geometry rule for the entire world." value={refinement.scale} onChange={(value) => setRefinement({ ...refinement, scale: value as Refinement["scale"] })} options={[["intimate", "Intimate"], ["human", "Human scale"], ["monumental", "Monumental"], ["vast", "Vast"]]} />
        <SelectField label="Emotional intensity" hint="Changes pressure, light, and contrast without changing scale." value={refinement.intensity} onChange={(value) => setRefinement({ ...refinement, intensity: value as Refinement["intensity"] })} options={[["restrained", "Restrained"], ["moderate", "Moderate"], ["intense", "Intense"], ["overwhelming", "Overwhelming"]]} />
        <SelectField label="World type" hint="Constrains the environmental vocabulary; Auto follows the song." value={refinement.worldType} onChange={(value) => setRefinement({ ...refinement, worldType: value as Refinement["worldType"] })} options={[["auto", "Let AI choose"], ["urban", "Urban"], ["industrial", "Industrial"], ["natural", "Natural"], ["interior", "Interior"], ["cosmic", "Cosmic"], ["dreamlike", "Dreamlike"], ["abstract", "Abstract"]]} />
        <Field label="Final guidance"><input value={refinement.userNote} onChange={(e) => setRefinement({ ...refinement, userNote: e.target.value })} placeholder="One last nuance to preserve" /></Field>
      </div><button className="primary-button wide" onClick={generate}><Sparkles size={17} /> Interpret song & build world prompt <ArrowRight size={17} /></button></section>
    </section>}
    {step === "generating" && <section className="loading-state"><span className="loading-orbit"><LoaderCircle size={38} /></span><p className="kicker">Evidence synthesis</p><h1>{identification ? "Analyzing sound and translating it into space…" : "Listening for a match…"}</h1><p>{identification ? "We’re measuring the recording and combining its musical structure with available lyrics, context, and your guidance." : "Preparing an identity result for you to confirm."}</p><div className="loading-lines"><span /><span /><span /></div></section>}
    {step === "results" && analysis && <Results analysis={analysis} refinement={refinement} setRefinement={setRefinement} regenerate={generate} edit={() => navigate("confirm")} copy={copyPrompt} copied={copied} download={download} />}
  </div><footer id="privacy"><div><span className="brand small"><span className="brand-mark"><span /><span /><span /><span /></span><span>sonosphere</span></span><p>Music understanding for worlds not yet built.</p></div><p>Prototype phase · No permanent audio storage · Optional World Labs generation</p></footer></main>;
}

function Results({ analysis, refinement, setRefinement, regenerate, edit, copy, copied, download }: { analysis: SongWorldAnalysis; refinement: Refinement; setRefinement: (value: Refinement) => void; regenerate: () => void; edit: () => void; copy: (kind: "marble" | "full") => void; copied: "marble" | "full" | null; download: () => void }) {
  const weights = Object.entries(analysis.weights) as Array<[string, number]>;
  const confidenceLabel = analysis.confidence.overallInterpretation >= 0.78 ? "High confidence" : analysis.confidence.overallInterpretation >= 0.52 ? "Moderate confidence" : "Exploratory reading";
  const aiFallback = analysis.worldPrompt.limitations.some((item) => item.includes("Live AI generation failed"));
  const dynamicContrast = analysis.music.overall.dynamicRange < 0.35 ? "Restrained" : analysis.music.overall.dynamicRange < 0.65 ? "Moderate" : "Wide";
  const regionLabel = (label: string, index: number) => label === "opening" || label === "intro" ? "Opening" : label === "ending" || label === "outro" ? "Ending" : label === "development" || label === "unknown" ? `Region ${index + 1}` : label.replaceAll("_", " ");
  return <section className="results-layout">
    <div className="result-hero"><div><p className="kicker">World analysis complete</p><h1>{analysis.worldPrompt.title}</h1><p>{analysis.worldPrompt.oneSentenceConcept}</p><div className="result-meta"><span><Music2 size={15} /> {analysis.song.confirmedTitle || "Untitled"}</span><span>{analysis.song.confirmedArtist || "Unknown artist"}</span><span className="confidence-pill">{confidenceLabel} · {Math.round(analysis.confidence.overallInterpretation * 100)}%</span><span>Fallback level {analysis.fallbackLevel}</span></div></div><div className="hero-actions"><button className="secondary-button" onClick={edit}><ArrowLeft size={16} /> Edit song & settings</button><button className="secondary-button" onClick={() => copy("marble")}>{copied === "marble" ? <Check size={16} /> : <Clipboard size={16} />}{copied === "marble" ? "Copied" : "Copy Marble prompt"}</button><button className="secondary-button" onClick={download}><FileJson size={16} /> Download JSON</button></div></div>
    {aiFallback && <div className="error-banner result-warning"><CircleAlert size={18} /><span><strong>Live AI was unavailable.</strong> This is the simpler local fallback prompt, not the full lyric-aware AI interpretation. See Limits & uncertainty for details.</span></div>}
    <div className="results-grid"><div className="results-main">
      <section className="result-section"><div className="section-label"><span>01</span><p>Interpretation</p></div><p className="interpretation-summary">{analysis.interpretation.summary}</p><div className="theme-grid">{analysis.interpretation.coreThemes.map((theme) => <article className="theme-card" key={theme.name}><div><span className="theme-dot" /><small>{Math.round(theme.confidence * 100)}% confidence</small></div><h3>{theme.name}</h3><p>{theme.description}</p><footer>{theme.evidenceSources.map((source) => <span key={source}>{source.replaceAll("_", " ")}</span>)}</footer></article>)}</div>
        <div className="conflict-callout"><span>EMOTIONAL TENSION</span><strong>{analysis.interpretation.emotionalConflicts[0]?.sideA} <i>↔</i> {analysis.interpretation.emotionalConflicts[0]?.sideB}</strong><p>{analysis.interpretation.emotionalConflicts[0]?.explanation}</p></div>
      </section>
      <section className="result-section"><div className="section-label"><span>02</span><p>Emotional movement</p></div><div className="arc-chart">{analysis.interpretation.emotionalArc.map((arc, index) => <div className="arc-item" key={arc.sectionId}><div className="arc-bar-wrap"><span className="arc-value">{Math.round(arc.intensity * 100)}</span><span className="arc-bar" style={{ height: `${Math.max(18, arc.intensity * 124)}px` }} /></div><strong>{analysis.music.sections[index] ? regionLabel(analysis.music.sections[index].label, index) : arc.sectionId}</strong><small>{arc.emotionalState}</small></div>)}</div><div className="music-facts"><span><small>Estimated tempo</small><strong>{analysis.music.tempoBpm ? Math.round(analysis.music.tempoBpm) : "—"} BPM</strong></span><span><small>Estimated tonality</small><strong>{analysis.music.key || "Unknown"} · {analysis.music.mode.charAt(0).toUpperCase() + analysis.music.mode.slice(1)}</strong></span><span><small>Dynamic contrast</small><strong>{dynamicContrast} ({Math.round(analysis.music.overall.dynamicRange * 100)}/100)</strong></span><span><small>Structure</small><strong>{analysis.music.sections.length} acoustic regions</strong></span></div><p className="music-note">These are analyzer estimates. Regions mark changes in timbre and energy; they are not verified verse, chorus, or bridge labels.</p></section>
      <section className="result-section"><div className="section-label"><span>03</span><p>Spatial translation</p></div><div className="metaphor"><Layers3 size={22} /><div><small>CENTRAL SPATIAL METAPHOR</small><h2>{analysis.spatialInterpretation.centralSpatialMetaphor.concept}</h2><p>{analysis.spatialInterpretation.centralSpatialMetaphor.explanation}</p></div></div><div className="journey"><div className="journey-head"><span><small>TOPOLOGY</small><strong>{analysis.spatialInterpretation.journey.topology}</strong></span><p>{analysis.spatialInterpretation.journey.transformationLogic}</p></div><div className="journey-entry"><small>ENTRY EXPERIENCE</small><p>{analysis.spatialInterpretation.journey.entryExperience}</p></div><div className="journey-grid">{analysis.spatialInterpretation.journey.areas.map((area) => <article key={area.name}><small>{area.role}</small><strong>{area.name}</strong><p>{area.description}</p><em>Connects to {area.connections.join(" · ")}</em></article>)}</div><div className="journey-orientation"><small>ORIENTATION</small><p>{analysis.spatialInterpretation.journey.orientationStrategy}</p></div></div><div className="symbols"><h3>Symbolic landmarks</h3>{analysis.spatialInterpretation.symbolicElements.map((symbol) => <article key={symbol.object}><span className="symbol-orb" /><div><strong>{symbol.object}</strong><p>{symbol.meaning}</p><small>{symbol.placement}</small></div></article>)}</div></section>
      <section className="result-section prompt-section"><div className="section-label"><span>04</span><p>Marble-ready prompt</p></div><div className="prompt-header"><div><h2>World Labs · Marble 1.1 Plus</h2><p>One primary explorable area, optimized below the documented 2,000-character limit</p></div><button onClick={() => copy("marble")}>{copied === "marble" ? <Check size={16} /> : <Clipboard size={16} />}{copied === "marble" ? "Copied" : "Copy Marble prompt"}</button></div><div className="marble-status"><span>SINGLE-AREA PROMPT</span><strong>{analysis.worldPrompt.marblePrompt.length.toLocaleString()} / 2,000 characters</strong></div><div className="prompt-copy marble-copy">{analysis.worldPrompt.marblePrompt.split("\n\n").map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div></section>
      <WorldGeneration prompt={analysis.worldPrompt.marblePrompt} title={analysis.worldPrompt.title} />
      <section className="result-section full-plan-section"><div className="section-label"><span>06</span><p>Full creative world plan</p></div><details><summary><span><strong>Preserve the complete multi-region concept</strong><small>Use for design reference, iteration, or a future composed-world workflow · {analysis.worldPrompt.prompt.length.toLocaleString()} characters</small></span><ChevronDown size={17} /></summary><div className="full-plan-actions"><button className="secondary-button" onClick={() => copy("full")}>{copied === "full" ? <Check size={15} /> : <Clipboard size={15} />}{copied === "full" ? "Copied" : "Copy full plan"}</button></div><div className="full-plan-copy">{analysis.worldPrompt.prompt.split("\n\n").map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>{analysis.worldPrompt.negativePrompt && <div className="negative"><span>AVOID</span><p>{analysis.worldPrompt.negativePrompt}</p></div>}</details></section>
    </div><aside className="results-sidebar">
      <section className="sidebar-card"><div className="sidebar-title"><h3>Evidence mix</h3><span>Adaptive</span></div>{weights.map(([key, value]) => <div className="weight" key={key}><div><span>{key.replace(/([A-Z])/g, " $1")}</span><strong>{Math.round(value * 100)}%</strong></div><i><span style={{ width: `${value * 100}%` }} /></i></div>)}<p>Weights respond to source availability, confidence, and your chosen balance.</p></section>
      <section className="sidebar-card"><div className="sidebar-title"><h3>Evidence sources</h3><span>{analysis.evidenceSummary.filter((item) => item.available).length}/4</span></div>{analysis.evidenceSummary.map((item) => <div className={`evidence-row ${item.available ? "available" : ""}`} key={item.label}><span>{item.available ? <Check size={13} /> : <X size={13} />}</span><div><strong>{item.label}</strong><small>{item.detail}</small></div><em>{Math.round(item.confidence * 100)}%</em></div>)}</section>
      <section className="sidebar-card refine-card"><div className="sidebar-title"><h3>Refine this world</h3><RotateCcw size={15} /></div><SelectField label="Balance" value={refinement.balance} onChange={(value) => setRefinement({ ...refinement, balance: value as Refinement["balance"] })} options={[["balanced", "Balanced"], ["lyrics", "Lyrics"], ["music", "Musical sound"], ["context", "External context"], ["personal", "Personal reading"]]} /><SelectField label="Realism" value={refinement.realism} onChange={(value) => setRefinement({ ...refinement, realism: value as Refinement["realism"] })} options={[["realistic", "Realistic"], ["cinematic", "Cinematic"], ["surreal", "Surreal"], ["abstract", "Abstract"], ["mixed", "Mixed"]]} /><SelectField label="Scale" value={refinement.scale} onChange={(value) => setRefinement({ ...refinement, scale: value as Refinement["scale"] })} options={[["intimate", "Intimate"], ["human", "Human"], ["monumental", "Monumental"], ["vast", "Vast"]]} /><Field label="Guidance"><textarea rows={3} value={refinement.userNote} onChange={(e) => setRefinement({ ...refinement, userNote: e.target.value })} placeholder="Focus the next version…" /></Field><button className="primary-button" onClick={regenerate}><Sparkles size={16} /> Regenerate prompt</button></section>
      <section className="sidebar-card limitations"><h3>Limits & uncertainty</h3>{analysis.worldPrompt.limitations.map((item) => <p key={item}><CircleAlert size={14} />{item}</p>)}</section>
    </aside></div>
    <div className="download-strip"><div><Download size={20} /><span><strong>Keep the complete analysis</strong><small>Structured, serializable, and ready for a future world-generation pipeline.</small></span></div><button onClick={download}>Download analysis JSON <ArrowRight size={16} /></button></div>
  </section>;
}
