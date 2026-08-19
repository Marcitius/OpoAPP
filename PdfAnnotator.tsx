"use client";

import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";

type Attachment = {
  key: string;
  name: string;
  url: string;
};

type InkPoint = { x: number; y: number; pressure: number };
type InkStroke = {
  id: string;
  mode: "draw" | "erase";
  color: string;
  width: number;
  points: InkPoint[];
};
type AnnotationDocument = {
  version: 1;
  pages: Record<string, InkStroke[]>;
};
type Tool = "hand" | "pen" | "eraser";
type SaveStatus = "loading" | "saved" | "saving" | "error";
type FitMode = "page" | "width" | "custom";

const PDFJS_CLIENT_PATH = "/pdf.min.mjs";
const PDF_FETCH_TIMEOUT_MS = 30_000;
const ANNOTATION_FETCH_TIMEOUT_MS = 12_000;

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

  if (points.length === 1) {
    const radius = baseWidth * (0.35 + points[0].pressure * 0.35);
    context.beginPath();
    context.arc(points[0].x, points[0].y, radius, 0, Math.PI * 2);
    context.fill();
  } else {
    for (let index = 1; index < points.length; index += 1) {
      const previous = points[index - 1];
      const current = points[index];
      const pressure = (previous.pressure + current.pressure) / 2;
      context.lineWidth = baseWidth * (0.55 + pressure * 0.9);
      context.beginPath();
      context.moveTo(previous.x, previous.y);
      context.lineTo(current.x, current.y);
      context.stroke();
    }
  }
  context.restore();
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 20_000,
) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timeout);
  }
}

function requestError(reason: unknown, fallback: string) {
  if (reason instanceof DOMException && reason.name === "AbortError") {
    return "La carga ha tardado demasiado. Pulsa Reintentar.";
  }
  return reason instanceof Error ? reason.message : fallback;
}

async function loadPdfBytes(key: string) {
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const query = new URLSearchParams({
        key,
        _: `${Date.now()}-${attempt}`,
      });
      const response = await fetchWithTimeout(
        `/api/files?${query.toString()}`,
        {
          cache: "no-store",
          headers: {
            "cache-control": "no-cache",
            pragma: "no-cache",
          },
        },
        PDF_FETCH_TIMEOUT_MS,
      );

      if (!response.ok) {
        let detail = "";
        try {
          const payload = await response.json() as { error?: string };
          detail = payload.error ?? "";
        } catch {
          // El cuerpo puede ser binario o estar vacío.
        }
        throw new Error(detail || `No se pudo abrir el PDF (${response.status})`);
      }

      const data = await response.arrayBuffer();
      if (!data.byteLength) throw new Error("El PDF está vacío");
      return data;
    } catch (reason) {
      lastError = reason;
      if (attempt === 0) {
        await new Promise((resolve) => window.setTimeout(resolve, 450));
      }
    }
  }

  throw new Error(requestError(lastError, "No se pudo descargar el PDF"));
}

async function loadAnnotations(key: string): Promise<
  { ok: true; annotations: AnnotationDocument } | { ok: false; message: string }
> {
  try {
    const query = new URLSearchParams({ key, _: String(Date.now()) });
    const response = await fetchWithTimeout(
      `/api/annotations?${query.toString()}`,
      { cache: "no-store" },
      ANNOTATION_FETCH_TIMEOUT_MS,
    );

    if (!response.ok) {
      const payload = await response.json().catch(() => ({})) as { error?: string };
      return { ok: false, message: payload.error ?? "No se pudieron abrir tus anotaciones" };
    }

    const saved = await response.json() as { annotations?: AnnotationDocument };
    return {
      ok: true,
      annotations: saved.annotations?.pages ? saved.annotations : emptyAnnotations(),
    };
  } catch (reason) {
    return {
      ok: false,
      message: requestError(reason, "No se pudieron abrir tus anotaciones"),
    };
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
  // En modo custom, 100% significa exactamente el tamaño de "Hoja completa".
  const [zoom, setZoom] = useState(1);
  const [fitMode, setFitMode] = useState<FitMode>("page");
  const [status, setStatus] = useState<SaveStatus>("loading");
  const [message, setMessage] = useState("Preparando el cuadernillo…");
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [annotations, setAnnotations] = useState<AnnotationDocument>(emptyAnnotations);
  const [annotationsReady, setAnnotationsReady] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const stageRef = useRef<HTMLDivElement>(null);
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);
  const inkCanvasRef = useRef<HTMLCanvasElement>(null);
  const currentStrokeRef = useRef<InkStroke | null>(null);
  const annotationsRef = useRef<AnnotationDocument>(emptyAnnotations());
  const saveChainRef = useRef<Promise<void>>(Promise.resolve());
  const saveVersionRef = useRef(0);

  useEffect(() => {
    annotationsRef.current = annotations;
  }, [annotations]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const update = () => setStageSize({ width: stage.clientWidth, height: stage.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let loadedDocument: PDFDocumentProxy | null = null;

    setPdf(null);
    setCanvasSize({ width: 0, height: 0 });
    setPageNumber(1);
    setAnnotationsReady(false);
    setStatus("loading");
    setMessage("Descargando PDF…");

    const annotationsPromise = loadAnnotations(attachment.key);

    (async () => {
      try {
        const [pdfjs, data] = await Promise.all([
          import(/* @vite-ignore */ PDFJS_CLIENT_PATH) as Promise<typeof import("pdfjs-dist")>,
          loadPdfBytes(attachment.key),
        ]);

        if (cancelled) return;

        setMessage("Procesando PDF…");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        loadedDocument = await pdfjs.getDocument({ data }).promise;

        if (cancelled) {
          void loadedDocument.destroy();
          return;
        }

        setPdf(loadedDocument);
        setMessage("Cargando anotaciones…");

        // Las anotaciones se cargan aparte: un problema temporal con ellas ya no
        // deja el PDF eternamente bloqueado en la pantalla de carga.
        const saved = await annotationsPromise;
        if (cancelled) return;

        if ("annotations" in saved) {
          annotationsRef.current = saved.annotations;
          setAnnotations(saved.annotations);
          setAnnotationsReady(true);
          setStatus("saved");
          setMessage("Guardado");
        } else {
          setTool("hand");
          setAnnotationsReady(false);
          setStatus("error");
          setMessage(`${saved.message}. Reintenta antes de escribir.`);
        }
      } catch (reason) {
        if (cancelled) return;
        setStatus("error");
        setMessage(requestError(reason, "No se pudo abrir el PDF"));
      }
    })();

    return () => {
      cancelled = true;
      if (loadedDocument) void loadedDocument.destroy();
    };
  }, [attachment.key, reloadToken]);

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
    let renderTask: { cancel: () => void; promise: Promise<unknown> } | null = null;

    pdf.getPage(pageNumber).then(async (page) => {
      if (cancelled) return;

      const base = page.getViewport({ scale: 1 });

      // No imponemos un mínimo artificial de 240px. Ese mínimo era una de las
      // razones por las que "Hoja completa" podía seguir viéndose ampliada.
      const availableWidth = Math.max(80, stageSize.width - 32);
      const availableHeight = Math.max(80, stageSize.height - 32);
      const widthScale = availableWidth / base.width;
      const heightScale = availableHeight / base.height;
      const pageScale = Math.min(widthScale, heightScale);

      // El zoom manual parte de "Hoja completa", no de "Al ancho".
      // Así el botón − permite desampliar realmente por debajo del ajuste a página.
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
      if (annotationsReady) {
        setStatus("saved");
        setMessage("Guardado");
      }
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
  }, [annotationsReady, fitMode, pageNumber, pdf, stageSize.height, stageSize.width, zoom]);

  useEffect(() => {
    redrawInk(annotations);
  }, [annotations, redrawInk]);

  function queueSave(next: AnnotationDocument) {
    if (!annotationsReady) {
      setStatus("error");
      setMessage("Reintenta la carga de anotaciones antes de escribir");
      return;
    }

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

  function pointFromEvent(event: ReactPointerEvent<HTMLCanvasElement>): InkPoint | null {
    const canvas = inkCanvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
      pressure: event.pressure > 0 ? event.pressure : 0.5,
    };
  }

  function pointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (tool === "hand" || !annotationsReady) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointFromEvent(event);
    if (!point || !canvasSize.width) return;
    currentStrokeRef.current = {
      id: strokeId(),
      mode: tool === "eraser" ? "erase" : "draw",
      color,
      width: (tool === "eraser" ? brushSize * 5 : brushSize) / canvasSize.width,
      points: [point],
    };
  }

  function pointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    const stroke = currentStrokeRef.current;
    if (!stroke) return;
    event.preventDefault();
    const point = pointFromEvent(event);
    if (!point) return;
    const previous = stroke.points[stroke.points.length - 1];
    const distance = Math.hypot(point.x - previous.x, point.y - previous.y);
    if (distance < 0.0015) return;
    stroke.points.push(point);
    redrawInk({
      ...annotationsRef.current,
      pages: {
        ...annotationsRef.current.pages,
        [String(pageNumber)]: [...(annotationsRef.current.pages[String(pageNumber)] ?? []), stroke],
      },
    });
  }

  function finishStroke(event: ReactPointerEvent<HTMLCanvasElement>) {
    const stroke = currentStrokeRef.current;
    if (!stroke) return;
    event.preventDefault();
    currentStrokeRef.current = null;
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
    if (!annotationsReady) return;
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

  function adjustZoom(delta: number) {
    setFitMode("custom");
    setZoom((current) => {
      const startingPoint = fitMode === "custom" ? current : 1;
      return Math.min(3, Math.max(0.35, startingPoint + delta));
    });
  }

  function fitWholePage() {
    setZoom(1);
    setFitMode("page");
  }

  return (
    <section className="pdf-editor" aria-label={`Editor de ${title}`}>
      <header className="pdf-editor-head">
        <button className="pdf-close" onClick={onClose} aria-label="Cerrar editor">×</button>
        <div className="pdf-title"><strong>{title}</strong><span className={`pdf-save ${status}`}>● {message}</span></div>
        <div className="pdf-pages">
          <button disabled={pageNumber <= 1} onClick={() => setPageNumber((page) => page - 1)} aria-label="Página anterior">‹</button>
          <span>{pageNumber} / {pdf?.numPages ?? "—"}</span>
          <button disabled={!pdf || pageNumber >= pdf.numPages} onClick={() => setPageNumber((page) => page + 1)} aria-label="Página siguiente">›</button>
        </div>
      </header>

      <div className="pdf-toolbar" role="toolbar" aria-label="Herramientas de escritura">
        <div className="pdf-tool-group">
          <button className={tool === "hand" ? "active" : ""} onClick={() => setTool("hand")} title="Mover">✋ <span>Mover</span></button>
          <button disabled={!annotationsReady} className={tool === "pen" ? "active" : ""} onClick={() => setTool("pen")} title="Lápiz">✎ <span>Lápiz</span></button>
          <button disabled={!annotationsReady} className={tool === "eraser" ? "active" : ""} onClick={() => setTool("eraser")} title="Goma">⌫ <span>Goma</span></button>
          <button onClick={undo} disabled={!annotationsReady || !(annotations.pages[String(pageNumber)]?.length)} title="Deshacer">↶ <span>Deshacer</span></button>
          <button onClick={() => setReloadToken((value) => value + 1)} title="Recargar PDF">↻ <span>Recargar</span></button>
        </div>

        <div className="pdf-tool-options">
          <label className="pdf-color" title="Color"><input type="color" value={color} onChange={(event) => setColor(event.target.value)} /><span style={{ background: color }} /></label>
          <label className="pdf-size"><span>Trazo</span><input type="range" min="2" max="12" value={brushSize} onChange={(event) => setBrushSize(Number(event.target.value))} /></label>
          <div className="pdf-fit" aria-label="Tamaño de la hoja">
            <button className={fitMode === "page" ? "active" : ""} onClick={fitWholePage}>Hoja completa</button>
            <button className={fitMode === "width" ? "active" : ""} onClick={() => setFitMode("width")}>Al ancho</button>
          </div>
          <div className="pdf-zoom">
            <button onClick={() => adjustZoom(-0.15)} aria-label="Desampliar">−</button>
            <span>{fitMode === "page" ? "Hoja" : fitMode === "width" ? "Ancho" : `${Math.round(zoom * 100)}%`}</span>
            <button onClick={() => adjustZoom(0.15)} aria-label="Ampliar">＋</button>
          </div>
        </div>
      </div>

      <div className={`pdf-stage ${tool === "hand" ? "hand" : "drawing"}`} ref={stageRef}>
        {!pdf && status !== "error" && <div className="pdf-loading"><span /><p>{message}</p></div>}
        {status === "error" && !pdf && (
          <div className="pdf-loading error">
            <strong>No se pudo abrir</strong>
            <p>{message}</p>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setReloadToken((value) => value + 1)}>Reintentar</button>
              <button onClick={onClose}>Volver</button>
            </div>
          </div>
        )}

        <div className="pdf-page-wrap" style={{ width: canvasSize.width || undefined, height: canvasSize.height || undefined }}>
          <canvas ref={pdfCanvasRef} className="pdf-page-canvas" />
          <canvas
            ref={inkCanvasRef}
            className="pdf-ink-canvas"
            style={{ pointerEvents: tool === "hand" || !annotationsReady ? "none" : "auto" }}
            onPointerDown={pointerDown}
            onPointerMove={pointerMove}
            onPointerUp={finishStroke}
            onPointerCancel={finishStroke}
          />
        </div>
      </div>
    </section>
  );
}
