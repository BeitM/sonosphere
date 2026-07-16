"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, Expand, LoaderCircle, RotateCcw, TriangleAlert } from "lucide-react";
import type { WorldLabsWorld } from "@/lib/worldlabs/schemas";

type ViewerStatus = "loading" | "ready" | "error";

export function WorldViewer({ world }: { world: WorldLabsWorld }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const resetViewRef = useRef<(() => void) | null>(null);
  const qualities = useMemo(() => Object.entries(world.spzUrls).filter((entry): entry is [string, string] => Boolean(entry[1])), [world.spzUrls]);
  const preferred = qualities.find(([name]) => name === "500k")?.[0] ?? qualities.find(([name]) => name === "100k")?.[0] ?? qualities[0]?.[0] ?? "";
  const [quality, setQuality] = useState(preferred);
  const [status, setStatus] = useState<ViewerStatus>("loading");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const splatUrl = world.spzUrls[quality] ?? qualities[0]?.[1];

  useEffect(() => {
    if (!splatUrl || !hostRef.current) { setStatus("error"); setError("This world did not include a renderable SPZ asset."); return; }
    const host = hostRef.current;
    let disposed = false;
    let cleanup = () => {};
    setStatus("loading"); setProgress(0); setError("");

    void (async () => {
      try {
        const THREE = await import("three");
        const [{ OrbitControls }, { SparkRenderer, SplatMesh }] = await Promise.all([
          import("three/examples/jsm/controls/OrbitControls.js"),
          import("@sparkjsdev/spark"),
        ]);
        if (disposed) return;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x101713);
        const camera = new THREE.PerspectiveCamera(58, 1, 0.01, 5_000);
        const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        host.replaceChildren(renderer.domElement);

        const spark = new SparkRenderer({ renderer });
        scene.add(spark);
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.screenSpacePanning = true;

        const splats = new SplatMesh({
          url: splatUrl,
          onProgress: (event: ProgressEvent) => {
            if (!disposed && event.lengthComputable && event.total > 0) setProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
          },
        });
        const metricScale = world.semantics.metricScaleFactor || 1;
        splats.scale.setScalar(metricScale);
        splats.rotation.x = Math.PI;
        splats.position.y = world.semantics.groundPlaneOffset || 0;
        scene.add(splats);

        const resize = () => {
          const width = Math.max(1, host.clientWidth);
          const height = Math.max(1, host.clientHeight);
          renderer.setSize(width, height, false);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
        };
        const observer = new ResizeObserver(resize);
        observer.observe(host);
        resize();

        cleanup = () => {
          resetViewRef.current = null;
          renderer.setAnimationLoop(null);
          observer.disconnect();
          controls.dispose();
          splats.dispose();
          renderer.dispose();
          renderer.domElement.remove();
        };

        await splats.initialized;
        if (disposed) return;
        splats.updateMatrixWorld(true);
        const bounds = splats.getBoundingBox(false).applyMatrix4(splats.matrixWorld);
        const center = bounds.getCenter(new THREE.Vector3());
        const size = Math.max(bounds.getSize(new THREE.Vector3()).length(), 1);
        const resetView = () => {
          controls.target.copy(center);
          camera.position.copy(center).add(new THREE.Vector3(size * 0.12, size * 0.08, size * 0.42));
          camera.near = Math.max(size / 100_000, 0.01);
          camera.far = Math.max(size * 20, 1_000);
          camera.updateProjectionMatrix();
          controls.minDistance = Math.max(size * 0.005, 0.02);
          controls.maxDistance = Math.max(size * 2, 50);
          controls.update();
        };
        resetViewRef.current = resetView;
        resetView();
        setProgress(100); setStatus("ready");

        renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });
      } catch (cause) {
        if (!disposed) { setStatus("error"); setError(cause instanceof Error ? cause.message : "The 3D world could not be loaded."); }
      }
    })();

    return () => { disposed = true; cleanup(); };
  }, [splatUrl, world.semantics.groundPlaneOffset, world.semantics.metricScaleFactor]);

  const fullscreen = async () => {
    if (!frameRef.current) return;
    if (document.fullscreenElement) await document.exitFullscreen(); else await frameRef.current.requestFullscreen();
  };

  return <div className="world-viewer" ref={frameRef}>
    <div className="viewer-toolbar"><div><strong>Interactive SPZ world</strong><span>Drag to orbit · Scroll to zoom · Right-drag to pan</span></div><div>{qualities.length > 1 && <label>Quality<select value={quality} onChange={(event) => setQuality(event.target.value)}>{qualities.map(([name]) => <option value={name} key={name}>{name.replace("full_res", "full resolution")}</option>)}</select></label>}<button type="button" onClick={() => resetViewRef.current?.()} disabled={status !== "ready"} aria-label="Reset world view"><RotateCcw size={15} /></button><button type="button" onClick={fullscreen} aria-label="Toggle fullscreen"><Expand size={15} /></button><a href={world.marbleUrl} target="_blank" rel="noreferrer">Marble <ExternalLink size={14} /></a></div></div>
    <div className="viewer-canvas" ref={hostRef} aria-label={`Interactive 3D view of ${world.displayName}`} />
    {status === "loading" && <div className="viewer-overlay" role="status"><LoaderCircle size={26} /><strong>Loading world geometry</strong><span>{progress ? `${progress}%` : "Preparing SparkJS renderer…"}</span></div>}
    {status === "error" && <div className="viewer-overlay viewer-error" role="alert"><TriangleAlert size={26} /><strong>Embedded viewer unavailable</strong><span>{error}</span><a href={world.marbleUrl} target="_blank" rel="noreferrer">Explore in Marble <ExternalLink size={14} /></a></div>}
    <div className="viewer-attribution">Rendered with SparkJS · World generated by World Labs</div>
  </div>;
}
