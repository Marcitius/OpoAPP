"use client";

import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";

type Attachment = { key: string; name: string; url: string };
type InkPoint = { x: number; y: number; pressure: number };
type InkStroke = {
  id: string;
  mode: "draw" | "erase";
  color: string;
  width: number;
  points: InkPoint[];
};
type AnnotationDocument = { version: 1; pages: Record<string, InkStroke[]> };
type Tool = "hand" | "pen" | "eraser";
type SaveStatus = "loading" | "saved" | "saving" | "error";
type FitMode = "page" | "width" | "custom";

const PDFJS_CLIENT_PATH = "/pdf.min.mjs";
const emptyAnnotations = (): AnnotationDocument => ({ version: 1, pages: {} });
const strokeId = () => typeof crypto !== "undefined" && "randomUUID" in crypto
  ? crypto.randomUUID()
  : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function drawStroke(context: CanvasRenderingContext2D, stroke: InkStroke, width: number, height: number) {
  if (!stroke.points.length) return;
  context.save();
  context.globalCompositeOperation = stroke.mode === "erase" ? "destination-out" : "source-over";
  context.strokeStyle = stroke.color;
  context.fillStyle = stroke.color;
  context.lineCap = "round";
  context.lineJoin = "round";

  const points = stroke.points.map((point) => ({
    x: point.x * width,
    y: point.y * height,
    pressure: point.pressure,
  }));
  const baseWidth = Math.max(1, stroke.width * width);

  const widthForPressure = (pressure: number) => {
    if (stroke.mode === "erase") return baseWidth;
    const normalized = Math.min(1, Math.max(0.08, pressure));
    return Math.max(0.75, baseWidth * (0.72 + Math.sqrt(normalized) * 0.42));
  };

  if (points.length === 1) {
    const radius = widthForPressure(points[0].pressure) / 2;
    context.beginPath();
    context.arc(points[0].x, points[0].y, radius, 0, Math.PI * 2);
    context.fill();
  } else {
    let start = points[0];
    let smoothedPressure = points[0].pressure;
    for (let index = 1; index < points.length; index += 1) {
      const current = points[index];
      const next = points[index + 1];
      const end = next
        ? { x: (current.x + next.x) / 2, y: (current.y + next.y) / 2 }
        : current;
      smoothedPressure = smoothedPressure * 0.68 + current.pressure * 0.32;
      context.lineWidth = widthForPressure(smoothedPressure);
      context.beginPath();
      context.moveTo(start.x, start.y);
      context.quadraticCurveTo(current.x, current.y, end.x, end.y);
      context.stroke();
      start = { ...end, pressure: current.pressure };
    }
  }
  context.restore();
}

async function fetchWithTimeout(url: string, timeoutMs: number) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
      headers: { "cache-control": "no-cache", pragma: "no-cache" },
    });
  } finally {
    window.clearTimeout(timer);
  }
}

export default function PdfAnnotator({
  attachment,
  title,
  onClose,
}: {
  attachment: Attachment;
  title: string;
  onClose: () => void;
}) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState("#1f4f9d");
  const [brushSize, setBrushSize] = useState(4);
  const [zoom, setZoom] = useState(1);
  const [fitMode, setFitMode] = useState<FitMode>("page");
  const [status, setStatus] = useState<SaveStatus>("loading");
  const [message, setMessage] = useState("Preparando el cuadernillo…");
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [annotations, setAnnotations] = useState<AnnotationDocument>(emptyAnnotations);
  const [reloadToken, setReloadToken] = useState(0);

  const stageRef = useRef<HTMLDivElement>(null);
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);
  const inkCanvasRef = useRef<HTMLCanvasElement>(null);
  const pageWrapRef = useRef<HTMLDivElement>(null);
  const currentStrokeRef = useRef<InkStroke | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const annotationsRef = useRef<AnnotationDocument>(emptyAnnotations());
  const saveChainRef = useRef<Promise<void>>(Promise.resolve());
  const saveVersionRef = useRef(0);

  useEffect(() => {
    annotationsRef.current = annotations;
  }, [annotations]);

  useEffect(() => {
    const pageWrap = pageWrapRef.current;
    if (!pageWrap) return;

    const blockNativeSelection = (event: Event) => {
      event.preventDefault();
      window.getSelection()?.removeAllRanges();
    };

    pageWrap.addEventListener("contextmenu", blockNativeSelection);
    pageWrap.addEventListener("selectstart", blockNativeSelection);
    pageWrap.addEventListener("dragstart", blockNativeSelection);

    return () => {
      pageWrap.removeEventListener("contextmenu", blockNativeSelection);
      pageWrap.removeEventListener("selectstart", blockNativeSelection);
      pageWrap.removeEventListener("dragstart", blockNativeSelection);
    };
  }, []);

  useEffect(() => {
    currentStrokeRef.current = null;
    activePointerIdRef.current = null;
    window.getSelection()?.removeAllRanges();
  }, [pageNumber, tool]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const update = () => {
      const rect = stage.getBoundingClientRect();
      const visualWidth = window.visualViewport?.width ?? window.innerWidth;
      const visualHeight = window.visualViewport?.height ?? window.innerHeight;
      setStageSize({
        width: Math.max(1, Math.min(rect.width || visualWidth, visualWidth)),
        height: Math.max(1, Math.min(rect.height || visualHeight, Math.max(1, visualHeight - rect.top))),
      });
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(stage);
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let loadedDocument: PDFDocumentProxy | null = null;

    setPdf(null);
    setCanvasSize({ width: 0, height: 0 });
    setPageNumber(1);
    setStatus("loading");
    setMessage("Descargando PDF…");

    (async () => {
      try {
        const cacheBust = `${attachment.url}${attachment.url.includes("?") ? "&" : "?"}_=${Date.now()}`;
        const [pdfjs, response] = await Promise.all([
          import(/* @vite-ignore */ PDFJS_CLIENT_PATH) as Promise<typeof import("pdfjs-dist")>,
          fetchWithTimeout(cacheBust, 30000),
        ]);

        if (!response.ok) throw new Error(`No se pudo abrir el PDF (${response.status})`);
        const data = await response.arrayBuffer();
        if (!data.byteLength) throw new Error("El PDF está vacío");
        if (cancelled) return;

        setMessage("Procesando PDF…");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        loadedDocument = await pdfjs.getDocument({ data }).promise;
        if (cancelled) {
          void loadedDocument.destroy();
          return;
        }

        setPdf(loadedDocument);
        setStatus("saved");
        setMessage("Guardado");

        try {
          const annotationResponse = await fetchWithTimeout(
            `/api/annotations?key=${encodeURIComponent(attachment.key)}&_=${Date.now()}`,
            12000,
          );
          if (annotationResponse.ok) {
            const saved = await annotationResponse.json() as { annotations?: AnnotationDocument };
            const loaded = saved.annotations?.pages ? saved.annotations : emptyAnnotations();
            annotationsRef.current = loaded;
            setAnnotations(loaded);
          }
        } catch {
          // El PDF debe poder abrir aunque las anotaciones tarden o fallen temporalmente.
        }
      } catch (reason) {
        if (cancelled) return;
        setStatus("error");
        setMessage(
          reason instanceof Error && reason.name === "AbortError"
            ? "La carga ha tardado demasiado"
            : reason instanceof Error
              ? reason.message
              : "No se pudo abrir el PDF",
        );
      }
    })();

    return () => {
      cancelled = true;
      if (loadedDocument) void loadedDocument.destroy();
    };
  }, [attachment.key, attachment.url, reloadToken]);

  const redrawInk = useCallback((document: AnnotationDocument, page = pageNumber) => {
    const canvas = inkCanvasRef.current;
    if (!canvas || !canvasSize.width || !canvasSize.height) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, canvasSize.width, canvasSize.height);
    for (const stroke of document.pages[String(page)] ?? []) {
      drawStroke(context, stroke, canvasSize.width, canvasSize.height);
    }
  }, [canvasSize.height, canvasSize.width, pageNumber]);

  useEffect(() => {
    if (!pdf || !stageSize.width || !stageSize.height) return;
    let cancelled = false;
    let renderTask: { promise: Promise<unknown>; cancel: () => void } | null = null;

    pdf.getPage(pageNumber).then(async (page) => {
      if (cancelled) return;

      const base = page.getViewport({ scale: 1 });
      const visualWidth = window.visualViewport?.width ?? window.innerWidth;
      const visualHeight = window.visualViewport?.height ?? window.innerHeight;
      const rect = stageRef.current?.getBoundingClientRect();

      const measuredWidth = rect?.width || stageSize.width || visualWidth;
      const measuredHeight = rect?.height || stageSize.height || visualHeight;
      const availableWidth = Math.max(80, Math.min(measuredWidth, visualWidth) - 16);
      const availableHeight = Math.max(
        80,
        Math.min(measuredHeight, Math.max(80, visualHeight - (rect?.top ?? 0))) - 16,
      );

      const widthScale = availableWidth / base.width;
      const pageScale = Math.min(widthScale, availableHeight / base.height);
      const desiredScale = fitMode === "page"
        ? pageScale
        : fitMode === "width"
          ? widthScale
          : pageScale * zoom;

      const scale = Math.max(0.05, desiredScale);
      const viewport = page.getViewport({ scale });
      const canvas = pdfCanvasRef.current;
      const inkCanvas = inkCanvasRef.current;
      if (!canvas || !inkCanvas) return;

      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(viewport.width * ratio);
      canvas.height = Math.floor(viewport.height * ratio);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      inkCanvas.width = Math.floor(viewport.width * ratio);
      inkCanvas.height = Math.floor(viewport.height * ratio);
      inkCanvas.style.width = `${viewport.width}px`;
      inkCanvas.style.height = `${viewport.height}px`;

      const context = canvas.getContext("2d");
      if (!context) return;

      renderTask = page.render({
        canvas,
        canvasContext: context,
        viewport,
        transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0],
      });

      await renderTask.promise;
      if (cancelled) return;

      setCanvasSize({ width: viewport.width, height: viewport.height });
      setMessage("Guardado");
    }).catch((reason) => {
      if (cancelled || (reason instanceof Error && reason.name === "RenderingCancelledException")) return;
      setStatus("error");
      setMessage("No se pudo dibujar esta página");
    });

    return () => {
      cancelled = true;
      try {
        renderTask?.cancel();
      } catch {
        // Ya había terminado.
      }
    };
  }, [fitMode, pageNumber, pdf, stageSize.height, stageSize.width, zoom]);

  useEffect(() => {
    redrawInk(annotations);
  }, [annotations, redrawInk]);

  function queueSave(next: AnnotationDocument) {
    const version = ++saveVersionRef.current;
    setStatus("saving");
    setMessage("Guardando trazos…");
    saveChainRef.current = saveChainRef.current
      .catch(() => undefined)
      .then(async () => {
        const response = await fetch("/api/annotations", {
          method: "PUT",
          cache: "no-store",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ key: attachment.key, annotations: next }),
        });
        if (!response.ok) throw new Error("No se pudieron guardar los trazos");
        if (version === saveVersionRef.current) {
          setStatus("saved");
          setMessage("Guardado");
        }
      })
      .catch((reason) => {
        if (version === saveVersionRef.current) {
          setStatus("error");
          setMessage(reason instanceof Error ? reason.message : "Error al guardar");
        }
      });
  }

  function pointFromNativeEvent(event: PointerEvent): InkPoint | null {
    const canvas = inkCanvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
      pressure: event.pointerType === "pen"
        ? Math.min(1, Math.max(0.08, event.pressure || 0.08))
        : 0.5,
    };
  }

  function pointsFromEvent(event: ReactPointerEvent<HTMLCanvasElement>) {
    const nativeEvent = event.nativeEvent;
    const coalesced = typeof nativeEvent.getCoalescedEvents === "function"
      ? nativeEvent.getCoalescedEvents()
      : [];
    const samples = coalesced.length ? coalesced : [nativeEvent];
    return samples
      .map(pointFromNativeEvent)
      .filter((point): point is InkPoint => point !== null);
  }

  function previewStroke(stroke: InkStroke) {
    redrawInk({
      ...annotationsRef.current,
      pages: {
        ...annotationsRef.current.pages,
        [String(pageNumber)]: [...(annotationsRef.current.pages[String(pageNumber)] ?? []), stroke],
      },
    });
  }

  function appendEventPoints(event: ReactPointerEvent<HTMLCanvasElement>, stroke: InkStroke) {
    let added = false;
    for (const point of pointsFromEvent(event)) {
      const previous = stroke.points[stroke.points.length - 1];
      if (previous && Math.hypot(point.x - previous.x, point.y - previous.y) < 0.00055) continue;
      stroke.points.push(point);
      added = true;
    }
    return added;
  }

  function pointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (tool === "hand") return;
    event.preventDefault();
    event.stopPropagation();
    window.getSelection()?.removeAllRanges();

    // En iPad, Apple Pencil llega como `pen` y la palma/dedos como `touch`.
    // Ignorar cualquier touch evita que la mano dibuje o termine el trazo activo.
    if (event.pointerType === "touch") return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (activePointerIdRef.current !== null) return;

    const point = pointsFromEvent(event)[0];
    if (!point || !canvasSize.width) return;
    activePointerIdRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    currentStrokeRef.current = {
      id: strokeId(),
      mode: tool === "eraser" ? "erase" : "draw",
      color,
      width: (tool === "eraser" ? brushSize * 5 : brushSize) / canvasSize.width,
      points: [point],
    };
    previewStroke(currentStrokeRef.current);
  }

  function pointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (event.pointerType === "touch") {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const stroke = currentStrokeRef.current;
    if (!stroke || activePointerIdRef.current !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    if (appendEventPoints(event, stroke)) previewStroke(stroke);
  }

  function finishStroke(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (event.pointerType === "touch") {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const stroke = currentStrokeRef.current;
    if (!stroke || activePointerIdRef.current !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    appendEventPoints(event, stroke);
    currentStrokeRef.current = null;
    activePointerIdRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const pageKey = String(pageNumber);
    const next: AnnotationDocument = {
      version: 1,
      pages: {
        ...annotationsRef.current.pages,
        [pageKey]: [...(annotationsRef.current.pages[pageKey] ?? []), stroke],
      },
    };
    annotationsRef.current = next;
    setAnnotations(next);
    queueSave(next);
  }

  function undo() {
    const pageKey = String(pageNumber);
    const strokes = annotationsRef.current.pages[pageKey] ?? [];
    if (!strokes.length) return;
    const next = {
      ...annotationsRef.current,
      pages: { ...annotationsRef.current.pages, [pageKey]: strokes.slice(0, -1) },
    };
    annotationsRef.current = next;
    setAnnotations(next);
    queueSave(next);
  }

  function changeZoom(delta: number) {
    setZoom((current) => {
      const base = fitMode === "custom" ? current : 1;
      return Math.max(0.25, Math.min(3, Math.round((base + delta) * 100) / 100));
    });
    setFitMode("custom");
  }

  return (
    <section
      className="pdf-editor pdf-draw-only"
      aria-label={`Editor de ${title}`}
      style={{ width: "100vw", maxWidth: "100vw", minWidth: 0, overflow: "hidden" }}
    >
      <header className="pdf-editor-head" style={{ width: "100%", minWidth: 0, maxWidth: "100vw" }}>
        <button className="pdf-close" onClick={onClose} aria-label="Cerrar editor">×</button>
        <div className="pdf-title">
          <strong>{title}</strong>
          <span className={`pdf-save ${status}`}>● {message}</span>
        </div>
        <div className="pdf-pages">
          <button disabled={pageNumber <= 1} onClick={() => setPageNumber((page) => page - 1)} aria-label="Página anterior">‹</button>
          <span>{pageNumber} / {pdf?.numPages ?? "—"}</span>
          <button disabled={!pdf || pageNumber >= pdf.numPages} onClick={() => setPageNumber((page) => page + 1)} aria-label="Página siguiente">›</button>
        </div>
      </header>

      <div
        className="pdf-toolbar"
        role="toolbar"
        aria-label="Herramientas de escritura"
        style={{ width: "100%", minWidth: 0, maxWidth: "100vw" }}
      >
        <div className="pdf-tool-group">
          <button className={tool === "hand" ? "active" : ""} onClick={() => setTool("hand")} title="Mover">✋ <span>Mover</span></button>
          <button className={tool === "pen" ? "active" : ""} onClick={() => setTool("pen")} title="Lápiz">✎ <span>Lápiz</span></button>
          <button className={tool === "eraser" ? "active" : ""} onClick={() => setTool("eraser")} title="Goma">⌫ <span>Goma</span></button>
          <button onClick={undo} disabled={!(annotations.pages[String(pageNumber)]?.length)} title="Deshacer">↶ <span>Deshacer</span></button>
          <button onClick={() => setReloadToken((value) => value + 1)} title="Recargar">↻ <span>Recargar</span></button>
        </div>

        <div className="pdf-tool-options">
          <label className="pdf-color" title="Color">
            <input type="color" value={color} onChange={(event) => setColor(event.target.value)} />
            <span style={{ background: color }} />
          </label>
          <span className="pdf-pencil-status" title="Los dedos y la palma no dibujan ni seleccionan el PDF">
            Pencil · palma bloqueada
          </span>
          <label className="pdf-size">
            <span>Trazo</span>
            <input type="range" min="2" max="12" value={brushSize} onChange={(event) => setBrushSize(Number(event.target.value))} />
          </label>
          <div className="pdf-fit" aria-label="Tamaño de la hoja">
            <button className={fitMode === "page" ? "active" : ""} onClick={() => { setZoom(1); setFitMode("page"); }}>Hoja completa</button>
            <button className={fitMode === "width" ? "active" : ""} onClick={() => setFitMode("width")}>Al ancho</button>
          </div>
          <div className="pdf-zoom">
            <button onClick={() => changeZoom(-0.15)} aria-label="Desampliar">−</button>
            <span>{fitMode === "page" ? "Hoja" : fitMode === "width" ? "Ancho" : `${Math.round(zoom * 100)}%`}</span>
            <button onClick={() => changeZoom(0.15)} aria-label="Ampliar">＋</button>
          </div>
        </div>
      </div>

      <div
        className={`pdf-stage ${tool === "hand" ? "hand" : "drawing"}`}
        ref={stageRef}
        style={{ width: "100%", maxWidth: "100vw", minWidth: 0 }}
      >
        {!pdf && status !== "error" && <div className="pdf-loading"><span /><p>{message}</p></div>}
        {status === "error" && !pdf && (
          <div className="pdf-loading error">
            <strong>No se pudo abrir</strong>
            <p>{message}</p>
            <button onClick={() => setReloadToken((value) => value + 1)}>Reintentar</button>
            <button onClick={onClose}>Volver</button>
          </div>
        )}

        <div
          className="pdf-page-wrap"
          ref={pageWrapRef}
          style={{ width: canvasSize.width || undefined, height: canvasSize.height || undefined }}
        >
          <canvas ref={pdfCanvasRef} className="pdf-page-canvas" />
          <canvas
            ref={inkCanvasRef}
            className="pdf-ink-canvas"
            style={{ pointerEvents: tool === "hand" ? "none" : "auto" }}
            onPointerDown={pointerDown}
            onPointerMove={pointerMove}
            onPointerUp={finishStroke}
            onPointerCancel={finishStroke}
            onLostPointerCapture={finishStroke}
          />
        </div>
      </div>
    </section>
  );
}
