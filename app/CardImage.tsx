"use client";

import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

type Attachment = {
  id: string;
  key: string;
  name: string;
  type: string;
  size: number;
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
type AnnotationDocument = { version: 1; pages: Record<string, InkStroke[]> };
type Tool = "pen" | "eraser" | "hand";

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

async function loadAnnotations(key: string) {
  const response = await fetch(`/api/annotations?key=${encodeURIComponent(key)}&_=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) throw new Error("No se pudieron cargar los trazos");
  const payload = await response.json() as { annotations?: AnnotationDocument };
  return payload.annotations?.pages ? payload.annotations : emptyAnnotations();
}

function paintCanvas(canvas: HTMLCanvasElement | null, document: AnnotationDocument, width: number, height: number) {
  if (!canvas || !width || !height) return;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(width * ratio);
  canvas.height = Math.floor(height * ratio);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const context = canvas.getContext("2d");
  if (!context) return;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, width, height);
  for (const stroke of document.pages["1"] ?? []) drawStroke(context, stroke, width, height);
}

export function AnnotatedCardImage({ attachment }: { attachment: Attachment }) {
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [annotations, setAnnotations] = useState<AnnotationDocument>(emptyAnnotations);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    let cancelled = false;
    loadAnnotations(attachment.key).then((value) => {
      if (!cancelled) setAnnotations(value);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [attachment.key]);

  useEffect(() => {
    const image = imgRef.current;
    if (!image) return;
    const update = () => {
      const rect = image.getBoundingClientRect();
      if (rect.width && rect.height) setSize({ width: rect.width, height: rect.height });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(image);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    paintCanvas(canvasRef.current, annotations, size.width, size.height);
  }, [annotations, size]);

  return (
    <div className="card-image-view">
      <img ref={imgRef} src={attachment.url} alt={attachment.name} onLoad={() => {
        const rect = imgRef.current?.getBoundingClientRect();
        if (rect?.width && rect.height) setSize({ width: rect.width, height: rect.height });
      }} />
      <canvas ref={canvasRef} aria-hidden="true" />
    </div>
  );
}

export function ImageAnnotator({ attachment, title, onClose }: { attachment: Attachment; title: string; onClose: () => void }) {
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState("#1f4f9d");
  const [brushSize, setBrushSize] = useState(4);
  const [annotations, setAnnotations] = useState<AnnotationDocument>(emptyAnnotations);
  const [status, setStatus] = useState("Cargando trazos…");
  const [size, setSize] = useState({ width: 0, height: 0 });
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const currentStrokeRef = useRef<InkStroke | null>(null);
  const annotationsRef = useRef<AnnotationDocument>(emptyAnnotations());
  const saveChainRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let cancelled = false;
    loadAnnotations(attachment.key).then((value) => {
      if (cancelled) return;
      annotationsRef.current = value;
      setAnnotations(value);
      setStatus("Guardado");
    }).catch(() => setStatus("No se pudieron cargar los trazos"));
    return () => { cancelled = true; };
  }, [attachment.key]);

  useEffect(() => {
    annotationsRef.current = annotations;
  }, [annotations]);

  useEffect(() => {
    const image = imgRef.current;
    if (!image) return;
    const update = () => {
      const rect = image.getBoundingClientRect();
      if (rect.width && rect.height) setSize({ width: rect.width, height: rect.height });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(image);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  const redraw = useCallback((doc: AnnotationDocument) => {
    paintCanvas(canvasRef.current, doc, size.width, size.height);
  }, [size.height, size.width]);

  useEffect(() => redraw(annotations), [annotations, redraw]);

  function pointFromEvent(event: ReactPointerEvent<HTMLCanvasElement>): InkPoint | null {
    const canvas = canvasRef.current;
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
    if (tool === "hand") return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointFromEvent(event);
    if (!point || !size.width) return;
    currentStrokeRef.current = {
      id: strokeId(),
      mode: tool === "eraser" ? "erase" : "draw",
      color,
      width: (tool === "eraser" ? brushSize * 5 : brushSize) / size.width,
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
    if (Math.hypot(point.x - previous.x, point.y - previous.y) < 0.0015) return;
    stroke.points.push(point);
    redraw({
      ...annotationsRef.current,
      pages: { ...annotationsRef.current.pages, "1": [...(annotationsRef.current.pages["1"] ?? []), stroke] },
    });
  }

  function save(next: AnnotationDocument) {
    setStatus("Guardando…");
    saveChainRef.current = saveChainRef.current.catch(() => undefined).then(async () => {
      const response = await fetch("/api/annotations", {
        method: "PUT",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key: attachment.key, annotations: next }),
      });
      if (!response.ok) throw new Error();
      setStatus("Guardado");
    }).catch(() => setStatus("Error al guardar"));
  }

  function finishStroke(event: ReactPointerEvent<HTMLCanvasElement>) {
    const stroke = currentStrokeRef.current;
    if (!stroke) return;
    event.preventDefault();
    currentStrokeRef.current = null;
    const next: AnnotationDocument = {
      version: 1,
      pages: { ...annotationsRef.current.pages, "1": [...(annotationsRef.current.pages["1"] ?? []), stroke] },
    };
    annotationsRef.current = next;
    setAnnotations(next);
    save(next);
  }

  function undo() {
    const strokes = annotationsRef.current.pages["1"] ?? [];
    if (!strokes.length) return;
    const next: AnnotationDocument = {
      version: 1,
      pages: { ...annotationsRef.current.pages, "1": strokes.slice(0, -1) },
    };
    annotationsRef.current = next;
    setAnnotations(next);
    save(next);
  }

  return (
    <section className="image-annotator">
      <header>
        <button onClick={onClose} className="image-editor-close">×</button>
        <div><strong>{title || attachment.name}</strong><small>{status}</small></div>
        <button onClick={undo} disabled={!(annotations.pages["1"]?.length)}>↶</button>
      </header>
      <div className="image-editor-toolbar">
        <button className={tool === "hand" ? "active" : ""} onClick={() => setTool("hand")}>✋ Mover</button>
        <button className={tool === "pen" ? "active" : ""} onClick={() => setTool("pen")}>✎ Lápiz</button>
        <button className={tool === "eraser" ? "active" : ""} onClick={() => setTool("eraser")}>⌫ Goma</button>
        <label><input type="color" value={color} onChange={(event) => setColor(event.target.value)} /> Color</label>
        <label className="image-brush">Trazo <input type="range" min="2" max="14" value={brushSize} onChange={(event) => setBrushSize(Number(event.target.value))} /></label>
      </div>
      <div className="image-editor-stage">
        <div className="image-editor-wrap">
          <img ref={imgRef} src={attachment.url} alt={attachment.name} onLoad={() => {
            const rect = imgRef.current?.getBoundingClientRect();
            if (rect?.width && rect.height) setSize({ width: rect.width, height: rect.height });
          }} />
          <canvas
            ref={canvasRef}
            style={{ pointerEvents: tool === "hand" ? "none" : "auto" }}
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
