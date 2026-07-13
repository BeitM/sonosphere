"use client";

import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronDown, CircleAlert, Clipboard, Download, FileAudio, FileJson, Layers3, LoaderCircle, Music2, RotateCcw, Sparkles, Upload, X } from "lucide-react";
import type { Refinement, SongIdentification, SongWorldAnalysis } from "@/lib/schemas";

type Step = "upload" | "confirm" | "generating" | "results";
type FixtureId = "known" | "obscure" | "instrumental";
const maxBytes = 25 * 1024 * 1024;
const accepted = [".mp3", ".wav", ".m4a", ".flac"];
const defaults: Refinement = { balance: "balanced", realism: "mixed", scale: "monumental", intensity: "intense", worldType: "auto", userNote: "" };

const demos: Array<{ id: FixtureId; eyebrow: string; title: string; meta: string; confidence: string }> = [
  { id: "known", eyebrow: "High information", title: "Amazing Grace", meta: "Strong lyrics + context", confidence: "98% match" },
  { id: "obscure", eyebrow: "Limited context", title: "Glass Orchard", meta: "Lyrics + music only", confidence: "78% match" },
  { id: "instrumental", eyebrow: "Unknown original", title: "Untitled Current", meta: "Sound-led interpretation", confidence: "8% match" },
];

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: Array<[string, string]>; onChange: (value: string) => void }) {
  return <Field label={label}><span className="select-wrap"><select value={value} onChange={(event) => onChange(event.target.value)}>{options.map(([key, text]) => <option value={key} key={key}>{text}</option>)}</select><ChevronDown size={16} /></span></Field>;
}

function Header({ step, reset }: { step: Step; reset: () => void }) {
  return <header className="topbar">
    <button className="brand" onClick={reset} aria-label="Sonosphere home"><span className="brand-mark"><span /><span /><span /><span /></span><span>sonosphere</span></button>
    <div className="topbar-right"><span className="mode"><span /> Development mode</span>{step !== "upload" && <button className="text-button" onClick={reset}>New analysis</button>}<a href="#privacy" className="text-link">Privacy</a></div>
  </header>;
}

function Progress({ step }: { step: Step }) {
  const current = step === "upload" ? 1 : step === "confirm" ? 2 : step === "generating" ? 3 : 4;
  return <div className="progress" aria-label={`Step ${current} of 4`}>
    {["Upload", "Confirm", "Interpret", "World prompt"].map((label, index) => <div className={`progress-item ${index + 1 < current ? "complete" : ""} ${index + 1 === current ? "active" : ""}`} key={label}><span>{index + 1 < current ? <Check size={13} /> : index + 1}</span><em>{label}</em>{index < 3 && <i />}</div>)}
  </div>;
}

export function Studio() {
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [fixtureId, setFixtureId] = useState<FixtureId>("known");
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
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => { setStep("upload"); setFile(null); setIdentification(null); setAnalysis(null); setError(""); setTitle(""); setArtist(""); setAlbum(""); setManualLyrics(""); setManualContext(""); setPersonal(""); setVisualPreference(""); setEmphasis(""); setRefinement(defaults); };
  const chooseFile = (next: File | null) => {
    setError("");
    if (!next) return;
    const supported = accepted.some((ext) => next.name.toLowerCase().endsWith(ext));
    if (!supported) return setError("Use an MP3, WAV, M4A, or FLAC audio file.");
    if (!next.size) return setError("That file appears to be empty or unreadable.");
    if (next.size > maxBytes) return setError("Choose a file smaller than 25 MB for this prototype.");
    setFile(next);
  };

  const identify = async (overrideFixture?: FixtureId) => {
    const selectedFixture = overrideFixture ?? fixtureId;
    let selectedFile = file;
    if (!selectedFile && overrideFixture) {
      const names = { known: "amazing-grace-demo.mp3", obscure: "glass-orchard-demo.mp3", instrumental: "unknown-original-instrumental.mp3" };
      selectedFile = new File(["sonosphere development fixture"], names[overrideFixture], { type: "audio/mpeg" });
      setFile(selectedFile);
    }
    if (!selectedFile) return setError("Choose an audio file or start with one of the development examples.");
    setFixtureId(selectedFixture); setError(""); setStep("generating");
    try {
      const body = new FormData(); body.append("audio", selectedFile); body.append("fixtureId", selectedFixture); body.append("title", title); body.append("artist", artist);
      const response = await fetch("/api/song/identify", { method: "POST", body });
      const json = await response.json() as SongIdentification & { error?: string }; if (!response.ok) throw new Error(json.error || "Identification failed.");
      setIdentification(json); setTitle(title || json.title || ""); setArtist(artist || json.artist || ""); setAlbum(album || json.album || ""); setStep("confirm");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Identification failed."); setStep("upload"); }
  };

  const generate = async () => {
    if (!identification) return;
    setError(""); setStep("generating");
    try {
      const response = await fetch("/api/world/generate-prompt", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fixtureId, identification, confirmed: { title, artist, album }, manualLyrics: manualLyrics || undefined, personalInterpretation: personal || undefined, visualPreference: visualPreference || undefined, emphasisNote: emphasis || undefined, manualContext: manualContext || undefined, refinement }) });
      const json = await response.json() as SongWorldAnalysis & { error?: string }; if (!response.ok) throw new Error(json.error || "Prompt generation failed.");
      setAnalysis(json); setStep("results"); window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Prompt generation failed."); setStep("confirm"); }
  };

  const copyPrompt = async () => { if (!analysis) return; await navigator.clipboard.writeText(analysis.worldPrompt.prompt); setCopied(true); setTimeout(() => setCopied(false), 1800); };
  const download = () => { if (!analysis) return; const url = URL.createObjectURL(new Blob([JSON.stringify(analysis, null, 2)], { type: "application/json" })); const link = document.createElement("a"); link.href = url; link.download = `${(title || "song").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-world-analysis.json`; link.click(); URL.revokeObjectURL(url); };

  return <main><Header step={step} reset={reset} /><div className="page-shell"><Progress step={step} />
    {error && <div className="error-banner"><CircleAlert size={18} /><span>{error}</span><button onClick={() => setError("")} aria-label="Dismiss error"><X size={16} /></button></div>}
    {step === "upload" && <section className="upload-layout">
      <div className="hero-block"><p className="kicker">Music interpretation studio</p><h1>Turn a song into<br />a world.</h1><p className="lede">Upload a track. Sonosphere gathers the meaning, maps its emotional movement, and writes a detailed prompt for a coherent, explorable 3D environment.</p>
        <div className="trust-row"><span><Check size={15} /> Audio is temporary</span><span><Check size={15} /> No 3D generation yet</span><span><Check size={15} /> Works without API keys</span></div>
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
          <button className="primary-button" onClick={() => identify()}><Sparkles size={17} /> Identify song <ArrowRight size={17} /></button>
          <p className="privacy-note"><span>Private by design.</span> In mock mode, only the filename and basic file metadata reach the local server; the audio is not stored or sent to a third party.</p>
        </section>
        <aside className="demo-panel"><div className="demo-heading"><p>Or explore a test case</p><span>DEVELOPMENT FIXTURES</span></div>{demos.map((demo) => <button className="demo-card" onClick={() => identify(demo.id)} key={demo.id}><span className={`demo-art art-${demo.id}`}><Music2 size={18} /></span><span className="demo-copy"><small>{demo.eyebrow}</small><strong>{demo.title}</strong><em>{demo.meta}</em></span><span className="demo-confidence">{demo.confidence}</span><ArrowRight size={17} /></button>)}<p className="demo-footnote">These fixtures let you test every fallback level before external providers are connected.</p></aside>
      </div></section>}
    {step === "confirm" && identification && <section className="confirm-layout">
      <div className="section-intro"><button className="back-button" onClick={() => setStep("upload")}><ArrowLeft size={16} /> Back to upload</button><p className="kicker">Identity check</p><h1>Is this the right song?</h1><p>Confirm or correct the detected metadata. Your confirmed values always override recognition.</p></div>
      <div className="confirm-grid"><section className="panel identity-panel"><div className="match-banner"><span className="record-disc"><span /></span><div><small>Detected by {identification.provider}</small><strong>{identification.title || "No confident match"}</strong><span>{identification.artist || "Unknown artist"}{identification.album ? ` · ${identification.album}` : ""}</span></div><div className="confidence-ring" style={{ "--score": `${Math.round(identification.confidence * 360)}deg` } as React.CSSProperties}><span>{Math.round(identification.confidence * 100)}<small>%</small></span></div></div>
        {identification.confidence < 0.5 && <div className="low-confidence"><CircleAlert size={17} /><span><strong>Low-confidence identity.</strong> That’s okay—Sonosphere will rely on the music and your guidance.</span></div>}
        <div className="field-grid"><Field label="Confirmed title"><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Untitled" /></Field><Field label="Confirmed artist"><input value={artist} onChange={(e) => setArtist(e.target.value)} placeholder="Unknown artist" /></Field></div><Field label="Album"><input value={album} onChange={(e) => setAlbum(e.target.value)} placeholder="Optional" /></Field>
        {identification.alternatives && identification.alternatives.length > 1 && <details className="alternatives"><summary>Other possible matches <ChevronDown size={15} /></summary>{identification.alternatives.slice(1).map((match) => <button key={`${match.title}-${match.artist}`} onClick={() => { setTitle(match.title); setArtist(match.artist); }}>{match.title} — {match.artist}<span>{Math.round(match.confidence * 100)}%</span></button>)}</details>}
      </section>
      <section className="panel guidance-panel"><div className="panel-heading"><div><span className="step-tag">02</span><h2>Shape the reading</h2></div><span className="optional">All optional</span></div><Field label="Personal interpretation"><textarea rows={3} value={personal} onChange={(e) => setPersonal(e.target.value)} placeholder="What does this song mean to you?" /></Field><Field label="Pasted lyrics" hint="Used for internal theme analysis. Accuracy and rights remain unverified."><textarea rows={3} value={manualLyrics} onChange={(e) => setManualLyrics(e.target.value)} placeholder="Paste lyrics for testing when a provider has none…" /></Field><Field label="Context or source note"><textarea rows={2} value={manualContext} onChange={(e) => setManualContext(e.target.value)} placeholder="Artist statement, album note, or factual context…" /></Field><div className="field-grid"><Field label="Visual preference"><input value={visualPreference} onChange={(e) => setVisualPreference(e.target.value)} placeholder="e.g. weathered stone" /></Field><Field label="Emphasize"><input value={emphasis} onChange={(e) => setEmphasis(e.target.value)} placeholder="e.g. restrained anger" /></Field></div></section></div>
      <section className="panel controls-panel"><div className="panel-heading"><div><span className="step-tag">03</span><h2>Set the creative balance</h2></div><span className="optional">You can change these later</span></div><div className="controls-grid">
        <SelectField label="Interpretation balance" value={refinement.balance} onChange={(value) => setRefinement({ ...refinement, balance: value as Refinement["balance"] })} options={[["balanced", "Balanced"], ["lyrics", "Emphasize lyrics"], ["music", "Emphasize musical sound"], ["context", "Emphasize external context"], ["personal", "Emphasize personal reading"]]} />
        <SelectField label="Visual realism" value={refinement.realism} onChange={(value) => setRefinement({ ...refinement, realism: value as Refinement["realism"] })} options={[["realistic", "Realistic"], ["cinematic", "Cinematic"], ["surreal", "Surreal"], ["abstract", "Abstract"], ["mixed", "Mixed"]]} />
        <SelectField label="Environmental scale" value={refinement.scale} onChange={(value) => setRefinement({ ...refinement, scale: value as Refinement["scale"] })} options={[["intimate", "Intimate"], ["human", "Human scale"], ["monumental", "Monumental"], ["vast", "Vast"]]} />
        <SelectField label="Emotional intensity" value={refinement.intensity} onChange={(value) => setRefinement({ ...refinement, intensity: value as Refinement["intensity"] })} options={[["restrained", "Restrained"], ["moderate", "Moderate"], ["intense", "Intense"], ["overwhelming", "Overwhelming"]]} />
        <SelectField label="World type" value={refinement.worldType} onChange={(value) => setRefinement({ ...refinement, worldType: value as Refinement["worldType"] })} options={[["auto", "Let AI choose"], ["urban", "Urban"], ["industrial", "Industrial"], ["natural", "Natural"], ["interior", "Interior"], ["cosmic", "Cosmic"], ["dreamlike", "Dreamlike"], ["abstract", "Abstract"]]} />
        <Field label="Final guidance"><input value={refinement.userNote} onChange={(e) => setRefinement({ ...refinement, userNote: e.target.value })} placeholder="One last nuance to preserve" /></Field>
      </div><button className="primary-button wide" onClick={generate}><Sparkles size={17} /> Interpret song & build world prompt <ArrowRight size={17} /></button></section>
    </section>}
    {step === "generating" && <section className="loading-state"><span className="loading-orbit"><LoaderCircle size={38} /></span><p className="kicker">Evidence synthesis</p><h1>{identification ? "Translating meaning into space…" : "Listening for a match…"}</h1><p>{identification ? "We’re combining lyrical, musical, contextual, and personal evidence into one coherent navigable world." : "Checking the development recognition provider and preparing a result you can confirm."}</p><div className="loading-lines"><span /><span /><span /></div></section>}
    {step === "results" && analysis && <Results analysis={analysis} refinement={refinement} setRefinement={setRefinement} regenerate={generate} copy={copyPrompt} copied={copied} download={download} />}
  </div><footer id="privacy"><div><span className="brand small"><span className="brand-mark"><span /><span /><span /><span /></span><span>sonosphere</span></span><p>Music understanding for worlds not yet built.</p></div><p>Prototype phase · No permanent audio storage · No 3D generation</p></footer></main>;
}

function Results({ analysis, refinement, setRefinement, regenerate, copy, copied, download }: { analysis: SongWorldAnalysis; refinement: Refinement; setRefinement: (value: Refinement) => void; regenerate: () => void; copy: () => void; copied: boolean; download: () => void }) {
  const weights = Object.entries(analysis.weights) as Array<[string, number]>;
  const confidenceLabel = analysis.confidence.overallInterpretation >= 0.78 ? "High confidence" : analysis.confidence.overallInterpretation >= 0.52 ? "Moderate confidence" : "Exploratory reading";
  return <section className="results-layout">
    <div className="result-hero"><div><p className="kicker">World analysis complete</p><h1>{analysis.worldPrompt.title}</h1><p>{analysis.worldPrompt.oneSentenceConcept}</p><div className="result-meta"><span><Music2 size={15} /> {analysis.song.confirmedTitle || "Untitled"}</span><span>{analysis.song.confirmedArtist || "Unknown artist"}</span><span className="confidence-pill">{confidenceLabel} · {Math.round(analysis.confidence.overallInterpretation * 100)}%</span><span>Fallback level {analysis.fallbackLevel}</span></div></div><div className="hero-actions"><button className="secondary-button" onClick={copy}>{copied ? <Check size={16} /> : <Clipboard size={16} />}{copied ? "Copied" : "Copy prompt"}</button><button className="secondary-button" onClick={download}><FileJson size={16} /> Download JSON</button></div></div>
    <div className="results-grid"><div className="results-main">
      <section className="result-section"><div className="section-label"><span>01</span><p>Interpretation</p></div><p className="interpretation-summary">{analysis.interpretation.summary}</p><div className="theme-grid">{analysis.interpretation.coreThemes.map((theme) => <article className="theme-card" key={theme.name}><div><span className="theme-dot" /><small>{Math.round(theme.confidence * 100)}% confidence</small></div><h3>{theme.name}</h3><p>{theme.description}</p><footer>{theme.evidenceSources.map((source) => <span key={source}>{source.replaceAll("_", " ")}</span>)}</footer></article>)}</div>
        <div className="conflict-callout"><span>EMOTIONAL TENSION</span><strong>{analysis.interpretation.emotionalConflicts[0]?.sideA} <i>↔</i> {analysis.interpretation.emotionalConflicts[0]?.sideB}</strong><p>{analysis.interpretation.emotionalConflicts[0]?.explanation}</p></div>
      </section>
      <section className="result-section"><div className="section-label"><span>02</span><p>Emotional movement</p></div><div className="arc-chart">{analysis.interpretation.emotionalArc.map((arc, index) => <div className="arc-item" key={arc.sectionId}><div className="arc-bar-wrap"><span className="arc-value">{Math.round(arc.intensity * 100)}</span><span className="arc-bar" style={{ height: `${Math.max(18, arc.intensity * 124)}px` }} /></div><strong>{analysis.music.sections[index]?.label.replace("_", " ") || arc.sectionId}</strong><small>{arc.emotionalState}</small></div>)}</div><div className="music-facts"><span><small>Tempo</small><strong>{analysis.music.tempoBpm ?? "—"} BPM</strong></span><span><small>Tonality</small><strong>{analysis.music.key || "Unknown"} · {analysis.music.mode}</strong></span><span><small>Dynamic range</small><strong>{Math.round(analysis.music.overall.dynamicRange * 100)}%</strong></span><span><small>Structure</small><strong>{analysis.music.sections.length} regions</strong></span></div></section>
      <section className="result-section"><div className="section-label"><span>03</span><p>Spatial translation</p></div><div className="metaphor"><Layers3 size={22} /><div><small>CENTRAL SPATIAL METAPHOR</small><h2>{analysis.spatialInterpretation.centralSpatialMetaphor.concept}</h2><p>{analysis.spatialInterpretation.centralSpatialMetaphor.explanation}</p></div></div><div className="journey"><span><small>START</small><strong>{analysis.spatialInterpretation.journey.startingSpace}</strong></span><i /><span><small>DEVELOP</small><strong>{analysis.spatialInterpretation.journey.development}</strong></span><i /><span><small>CLIMAX</small><strong>{analysis.spatialInterpretation.journey.climaxSpace}</strong></span><i /><span><small>END</small><strong>{analysis.spatialInterpretation.journey.endingSpace}</strong></span></div><div className="symbols"><h3>Symbolic landmarks</h3>{analysis.spatialInterpretation.symbolicElements.map((symbol) => <article key={symbol.object}><span className="symbol-orb" /><div><strong>{symbol.object}</strong><p>{symbol.meaning}</p><small>{symbol.placement}</small></div></article>)}</div></section>
      <section className="result-section prompt-section"><div className="section-label"><span>04</span><p>World-generation prompt</p></div><div className="prompt-header"><div><h2>{analysis.worldPrompt.title}</h2><p>Ready for a future text-to-world generator</p></div><button onClick={copy}>{copied ? <Check size={16} /> : <Clipboard size={16} />}{copied ? "Copied" : "Copy"}</button></div><div className="prompt-copy">{analysis.worldPrompt.prompt.split("\n\n").map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div><div className="negative"><span>AVOID</span><p>{analysis.worldPrompt.negativePrompt}</p></div></section>
    </div><aside className="results-sidebar">
      <section className="sidebar-card"><div className="sidebar-title"><h3>Evidence mix</h3><span>Adaptive</span></div>{weights.map(([key, value]) => <div className="weight" key={key}><div><span>{key.replace(/([A-Z])/g, " $1")}</span><strong>{Math.round(value * 100)}%</strong></div><i><span style={{ width: `${value * 100}%` }} /></i></div>)}<p>Weights respond to source availability, confidence, and your chosen balance.</p></section>
      <section className="sidebar-card"><div className="sidebar-title"><h3>Evidence sources</h3><span>{analysis.evidenceSummary.filter((item) => item.available).length}/4</span></div>{analysis.evidenceSummary.map((item) => <div className={`evidence-row ${item.available ? "available" : ""}`} key={item.label}><span>{item.available ? <Check size={13} /> : <X size={13} />}</span><div><strong>{item.label}</strong><small>{item.detail}</small></div><em>{Math.round(item.confidence * 100)}%</em></div>)}</section>
      <section className="sidebar-card refine-card"><div className="sidebar-title"><h3>Refine this world</h3><RotateCcw size={15} /></div><SelectField label="Balance" value={refinement.balance} onChange={(value) => setRefinement({ ...refinement, balance: value as Refinement["balance"] })} options={[["balanced", "Balanced"], ["lyrics", "Lyrics"], ["music", "Musical sound"], ["context", "External context"], ["personal", "Personal reading"]]} /><SelectField label="Realism" value={refinement.realism} onChange={(value) => setRefinement({ ...refinement, realism: value as Refinement["realism"] })} options={[["realistic", "Realistic"], ["cinematic", "Cinematic"], ["surreal", "Surreal"], ["abstract", "Abstract"], ["mixed", "Mixed"]]} /><SelectField label="Scale" value={refinement.scale} onChange={(value) => setRefinement({ ...refinement, scale: value as Refinement["scale"] })} options={[["intimate", "Intimate"], ["human", "Human"], ["monumental", "Monumental"], ["vast", "Vast"]]} /><Field label="Guidance"><textarea rows={3} value={refinement.userNote} onChange={(e) => setRefinement({ ...refinement, userNote: e.target.value })} placeholder="Focus the next version…" /></Field><button className="primary-button" onClick={regenerate}><Sparkles size={16} /> Regenerate prompt</button></section>
      <section className="sidebar-card limitations"><h3>Limits & uncertainty</h3>{analysis.worldPrompt.limitations.map((item) => <p key={item}><CircleAlert size={14} />{item}</p>)}</section>
    </aside></div>
    <div className="download-strip"><div><Download size={20} /><span><strong>Keep the complete analysis</strong><small>Structured, serializable, and ready for a future world-generation pipeline.</small></span></div><button onClick={download}>Download analysis JSON <ArrowRight size={16} /></button></div>
  </section>;
}
