"use client";

import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";

type Attachment = { key: string; name: string; url: string };
type BrushKind = "ballpoint" | "fountain" | "brush" | "pencil" | "highlighter";
type ShapeKind = "line" | "rectangle" | "ellipse" | "triangle" | "arrow";
type Tool = "hand" | "pen" | "highlighter" | "eraser" | "lasso" | "shape" | "tape" | "stamp";
type EraserMode = "partial" | "whole";
type FitMode = "page" | "width" | "custom";
type SaveStatus = "loading" | "saved" | "saving" | "error";
type Point = { x: number; y: number; pressure: number; tiltX?: number; tiltY?: number; time?: number };
type Bounds = { x: number; y: number; w: number; h: number };

type InkStroke = {
  id: string;
  kind?: "stroke";
  mode: "draw" | "erase";
  color: string;
  width: number;
  opacity?: number;
  brush?: BrushKind;
  smoothing?: number;
  points: Point[];
};
type ShapeItem = {
  id: string;
  kind: "shape";
  shape: ShapeKind;
  color: string;
  width: number;
  opacity?: number;
  start: Point;
  end: Point;
};
type TapeItem = { id: string; kind: "tape"; x: number; y: number; w: number; h: number; color: string; revealed?: boolean };
type StampItem = { id: string; kind: "stamp"; x: number; y: number; text: string; color: string; size: number };
type AnnotationItem = InkStroke | ShapeItem | TapeItem | StampItem;
type AnnotationDocument = { version: 1 | 2; pages: Record<string, AnnotationItem[]>; bookmarks?: number[] };

type Interaction =
  | { type: "stroke"; stroke: InkStroke; rulerSnap: boolean }
  | { type: "shape"; start: Point; end: Point }
  | { type: "tape"; start: Point; end: Point }
  | { type: "lasso"; points: Point[] }
  | { type: "move"; start: Point; base: AnnotationDocument; preview: AnnotationDocument }
  | { type: "eraseWhole"; base: AnnotationDocument; preview: AnnotationDocument };

const PDFJS_CLIENT_PATH = "/pdf.min.mjs";
const emptyAnnotations = (): AnnotationDocument => ({ version: 2, pages: {}, bookmarks: [] });
const makeId = () => typeof crypto !== "undefined" && "randomUUID" in crypto
  ? crypto.randomUUID()
  : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const cloneDocument = (document: AnnotationDocument): AnnotationDocument =>
  typeof structuredClone === "function" ? structuredClone(document) : JSON.parse(JSON.stringify(document)) as AnnotationDocument;

function normalizeDocument(value?: Partial<AnnotationDocument> | null): AnnotationDocument {
  if (!value?.pages || typeof value.pages !== "object") return emptyAnnotations();
  return { version: 2, pages: value.pages, bookmarks: Array.isArray(value.bookmarks) ? value.bookmarks : [] };
}

function isStroke(item: AnnotationItem): item is InkStroke {
  return !item.kind || item.kind === "stroke";
}

function rgba(hex: string, opacity: number) {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((part) => part + part).join("") : clean;
  const value = Number.parseInt(full, 16);
  if (!Number.isFinite(value)) return `rgba(31,79,157,${opacity})`;
  return `rgba(${(value >> 16) & 255},${(value >> 8) & 255},${value & 255},${opacity})`;
}

function pressureWidth(stroke: InkStroke, point: Point, canvasWidth: number) {
  const base = Math.max(.8, stroke.width * canvasWidth);
  if (stroke.mode === "erase" || stroke.brush === "ballpoint" || stroke.brush === "highlighter") return base;
  const pressure = clamp(point.pressure || .35, .05, 1);
  if (stroke.brush === "pencil") return base * (.55 + pressure * .65);
  if (stroke.brush === "fountain") return base * (.62 + pressure * .62);
  return base * (.35 + pressure * 1.05);
}

function drawStroke(context: CanvasRenderingContext2D, stroke: InkStroke, width: number, height: number) {
  if (!stroke.points.length) return;
  const points = stroke.points.map((point) => ({ ...point, x: point.x * width, y: point.y * height }));
  context.save();
  context.globalCompositeOperation = stroke.mode === "erase" ? "destination-out" : "source-over";
  context.strokeStyle = stroke.mode === "erase" ? "rgba(0,0,0,1)" : rgba(stroke.color, stroke.opacity ?? (stroke.brush === "highlighter" ? .28 : stroke.brush === "pencil" ? .72 : 1));
  context.fillStyle = context.strokeStyle;
  context.lineCap = "round";
  context.lineJoin = "round";

  if (points.length === 1) {
    context.beginPath();
    context.arc(points[0].x, points[0].y, pressureWidth(stroke, points[0], width) / 2, 0, Math.PI * 2);
    context.fill();
    context.restore();
    return;
  }

  let previous = points[0];
  let smoothedPressure = previous.pressure || .35;
  for (let index = 1; index < points.length; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    const end = next ? { x: (current.x + next.x) / 2, y: (current.y + next.y) / 2 } : current;
    smoothedPressure = smoothedPressure * .72 + (current.pressure || .35) * .28;
    const tilt = stroke.brush === "pencil" ? 1 + Math.min(.3, Math.hypot(current.tiltX ?? 0, current.tiltY ?? 0) / 180) : 1;
    context.lineWidth = pressureWidth(stroke, { ...current, pressure: smoothedPressure }, width) * tilt;
    context.beginPath();
    context.moveTo(previous.x, previous.y);
    context.quadraticCurveTo(current.x, current.y, end.x, end.y);
    context.stroke();
    if (stroke.brush === "pencil" && index % 3 === 0) {
      context.globalAlpha = .12;
      context.beginPath();
      context.arc(current.x + Math.sin(index * 17) * context.lineWidth * .18, current.y + Math.cos(index * 13) * context.lineWidth * .18, Math.max(.35, context.lineWidth * .12), 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = 1;
    }
    previous = { ...current, x: end.x, y: end.y };
  }
  context.restore();
}

function drawShape(context: CanvasRenderingContext2D, item: ShapeItem, width: number, height: number, selected = false) {
  const start = { x: item.start.x * width, y: item.start.y * height };
  const end = { x: item.end.x * width, y: item.end.y * height };
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  const w = Math.abs(end.x - start.x);
  const h = Math.abs(end.y - start.y);
  context.save();
  context.strokeStyle = rgba(item.color, item.opacity ?? 1);
  context.lineWidth = Math.max(1, item.width * width);
  context.lineCap = "round";
  context.lineJoin = "round";
  context.beginPath();
  if (item.shape === "rectangle") context.rect(x, y, w, h);
  else if (item.shape === "ellipse") context.ellipse(x + w / 2, y + h / 2, Math.max(1, w / 2), Math.max(1, h / 2), 0, 0, Math.PI * 2);
  else if (item.shape === "triangle") {
    context.moveTo(x + w / 2, y);
    context.lineTo(x + w, y + h);
    context.lineTo(x, y + h);
    context.closePath();
  } else {
    context.moveTo(start.x, start.y);
    context.lineTo(end.x, end.y);
    if (item.shape === "arrow") {
      const angle = Math.atan2(end.y - start.y, end.x - start.x);
      const head = Math.max(10, context.lineWidth * 4);
      context.moveTo(end.x, end.y);
      context.lineTo(end.x - head * Math.cos(angle - Math.PI / 6), end.y - head * Math.sin(angle - Math.PI / 6));
      context.moveTo(end.x, end.y);
      context.lineTo(end.x - head * Math.cos(angle + Math.PI / 6), end.y - head * Math.sin(angle + Math.PI / 6));
    }
  }
  context.stroke();
  if (selected) {
    context.setLineDash([6, 5]);
    context.strokeStyle = "#655ce8";
    context.lineWidth = 1.5;
    context.strokeRect(x - 5, y - 5, w + 10, h + 10);
  }
  context.restore();
}

function drawItem(context: CanvasRenderingContext2D, item: AnnotationItem, width: number, height: number) {
  if (isStroke(item)) return drawStroke(context, item, width, height);
  if (item.kind === "shape") return drawShape(context, item, width, height);
  if (item.kind === "tape") {
    context.save();
    context.fillStyle = item.revealed ? rgba(item.color, .13) : rgba(item.color, .96);
    context.strokeStyle = rgba(item.color, item.revealed ? .32 : .9);
    context.lineWidth = 1;
    context.fillRect(item.x * width, item.y * height, item.w * width, item.h * height);
    context.strokeRect(item.x * width, item.y * height, item.w * width, item.h * height);
    context.restore();
    return;
  }
  context.save();
  context.fillStyle = item.color;
  context.font = `700 ${Math.max(14, item.size * width)}px system-ui`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(item.text, item.x * width, item.y * height);
  context.restore();
}

function itemBounds(item: AnnotationItem): Bounds {
  if (isStroke(item)) {
    const xs = item.points.map((point) => point.x);
    const ys = item.points.map((point) => point.y);
    const pad = item.width * 2;
    return { x: Math.min(...xs) - pad, y: Math.min(...ys) - pad, w: Math.max(...xs) - Math.min(...xs) + pad * 2, h: Math.max(...ys) - Math.min(...ys) + pad * 2 };
  }
  if (item.kind === "shape") return { x: Math.min(item.start.x, item.end.x), y: Math.min(item.start.y, item.end.y), w: Math.abs(item.end.x - item.start.x), h: Math.abs(item.end.y - item.start.y) };
  if (item.kind === "tape") return { x: item.x, y: item.y, w: item.w, h: item.h };
  return { x: item.x - item.size, y: item.y - item.size, w: item.size * 2, h: item.size * 2 };
}

function combinedBounds(items: AnnotationItem[]): Bounds | null {
  if (!items.length) return null;
  const bounds = items.map(itemBounds);
  const x = Math.min(...bounds.map((item) => item.x));
  const y = Math.min(...bounds.map((item) => item.y));
  const right = Math.max(...bounds.map((item) => item.x + item.w));
  const bottom = Math.max(...bounds.map((item) => item.y + item.h));
  return { x, y, w: right - x, h: bottom - y };
}

function pointInPolygon(point: Point, polygon: Point[]) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / ((b.y - a.y) || 1e-8) + a.x) inside = !inside;
  }
  return inside;
}

function distanceToSegment(point: Point, a: Point, b: Point) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const t = clamp(((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy || 1));
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
}

function hitItem(item: AnnotationItem, point: Point, radius: number) {
  const bounds = itemBounds(item);
  if (point.x < bounds.x - radius || point.x > bounds.x + bounds.w + radius || point.y < bounds.y - radius || point.y > bounds.y + bounds.h + radius) return false;
  if (isStroke(item)) return item.points.some((sample, index) => index === 0 ? Math.hypot(sample.x - point.x, sample.y - point.y) < radius : distanceToSegment(point, item.points[index - 1], sample) < radius + item.width);
  return true;
}

function transformItem(item: AnnotationItem, selected: Set<string>, dx: number, dy: number, scale = 1, center?: Point): AnnotationItem {
  if (!selected.has(item.id)) return item;
  const move = (point: Point) => ({ ...point, x: clamp((point.x - (center?.x ?? 0)) * scale + (center?.x ?? 0) + dx), y: clamp((point.y - (center?.y ?? 0)) * scale + (center?.y ?? 0) + dy) });
  if (isStroke(item)) return { ...item, width: item.width * scale, points: item.points.map(move) };
  if (item.kind === "shape") return { ...item, width: item.width * scale, start: move(item.start), end: move(item.end) };
  if (item.kind === "tape") {
    const origin = move({ x: item.x, y: item.y, pressure: .5 });
    return { ...item, x: origin.x, y: origin.y, w: item.w * scale, h: item.h * scale };
  }
  const origin = move({ x: item.x, y: item.y, pressure: .5 });
  return { ...item, x: origin.x, y: origin.y, size: item.size * scale };
}

function recognizeShape(stroke: InkStroke): ShapeKind | null {
  if (stroke.points.length < 5) return null;
  const first = stroke.points[0];
  const last = stroke.points[stroke.points.length - 1];
  const diagonal = Math.hypot(last.x - first.x, last.y - first.y);
  const maxDeviation = Math.max(...stroke.points.map((point) => distanceToSegment(point, first, last)));
  if (diagonal > .035 && maxDeviation < Math.max(.008, diagonal * .035)) return "line";
  const bounds = itemBounds(stroke);
  const closed = Math.hypot(last.x - first.x, last.y - first.y) < Math.max(.035, Math.hypot(bounds.w, bounds.h) * .22);
  if (!closed || bounds.w < .025 || bounds.h < .025) return null;
  const cx = bounds.x + bounds.w / 2;
  const cy = bounds.y + bounds.h / 2;
  const radial = stroke.points.map((point) => Math.hypot((point.x - cx) / Math.max(bounds.w, .001), (point.y - cy) / Math.max(bounds.h, .001)));
  const average = radial.reduce((sum, value) => sum + value, 0) / radial.length;
  const variance = radial.reduce((sum, value) => sum + (value - average) ** 2, 0) / radial.length;
  if (variance < .012) return "ellipse";
  let corners = 0;
  for (let index = 4; index < stroke.points.length - 4; index += 4) {
    const a = stroke.points[index - 4];
    const b = stroke.points[index];
    const c = stroke.points[index + 4];
    const angle = Math.abs(Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(b.y - a.y, b.x - a.x));
    if (Math.min(angle, Math.PI * 2 - angle) > .55) corners += 1;
  }
  return corners <= 4 ? "triangle" : "rectangle";
}

function shapeFromStroke(stroke: InkStroke, shape: ShapeKind): ShapeItem {
  const bounds = itemBounds(stroke);
  const start = shape === "line" ? stroke.points[0] : { x: bounds.x, y: bounds.y, pressure: .5 };
  const end = shape === "line" ? stroke.points[stroke.points.length - 1] : { x: bounds.x + bounds.w, y: bounds.y + bounds.h, pressure: .5 };
  return { id: stroke.id, kind: "shape", shape, color: stroke.color, width: stroke.width, opacity: stroke.opacity, start, end };
}

async function fetchWithTimeout(url: string, timeoutMs: number) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { cache: "no-store", signal: controller.signal, headers: { "cache-control": "no-cache", pragma: "no-cache" } });
  } finally {
    window.clearTimeout(timer);
  }
}

function PdfThumbnail({ pdf, page, active, bookmarked, onSelect }: { pdf: PDFDocumentProxy; page: number; active: boolean; bookmarked: boolean; onSelect: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let cancelled = false;
    let task: { promise: Promise<unknown>; cancel: () => void } | null = null;
    void pdf.getPage(page).then((pdfPage) => {
      if (cancelled || !ref.current) return;
      const base = pdfPage.getViewport({ scale: 1 });
      const viewport = pdfPage.getViewport({ scale: 118 / base.width });
      ref.current.width = Math.floor(viewport.width);
      ref.current.height = Math.floor(viewport.height);
      const context = ref.current.getContext("2d");
      if (!context) return;
      task = pdfPage.render({ canvas: ref.current, canvasContext: context, viewport });
      return task.promise;
    }).catch(() => undefined);
    return () => { cancelled = true; try { task?.cancel(); } catch { /* completed */ } };
  }, [page, pdf]);
  return <button className={`pdf-thumbnail ${active ? "active" : ""}`} onClick={onSelect}><span>{bookmarked ? "★" : page}</span><canvas ref={ref} /></button>;
}

export default function PdfAnnotator({ attachment, title, onClose }: { attachment: Attachment; title: string; onClose: () => void }) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [tool, setTool] = useState<Tool>("pen");
  const [brush, setBrush] = useState<BrushKind>("ballpoint");
  const [shapeKind, setShapeKind] = useState<ShapeKind>("line");
  const [eraserMode, setEraserMode] = useState<EraserMode>("partial");
  const [color, setColor] = useState("#1f4f9d");
  const [brushSize, setBrushSize] = useState(4);
  const [smoothing, setSmoothing] = useState(55);
  const [zoom, setZoom] = useState(1);
  const [fitMode, setFitMode] = useState<FitMode>("page");
  const [writingZoom, setWritingZoom] = useState(false);
  const [ruler, setRuler] = useState(false);
  const [rulerAngle, setRulerAngle] = useState(0);
  const [rulerOffset, setRulerOffset] = useState(50);
  const [stamp, setStamp] = useState("✓");
  const [showPages, setShowPages] = useState(false);
  const [status, setStatus] = useState<SaveStatus>("loading");
  const [message, setMessage] = useState("Preparando el cuadernillo…");
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [annotations, setAnnotations] = useState<AnnotationDocument>(emptyAnnotations);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [historyState, setHistoryState] = useState({ undo: 0, redo: 0 });
  const [reloadToken, setReloadToken] = useState(0);

  const stageRef = useRef<HTMLDivElement>(null);
  const pageWrapRef = useRef<HTMLDivElement>(null);
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);
  const committedCanvasRef = useRef<HTMLCanvasElement>(null);
  const liveCanvasRef = useRef<HTMLCanvasElement>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const interactionRef = useRef<Interaction | null>(null);
  const snappedShapeRef = useRef<ShapeItem | null>(null);
  const holdTimerRef = useRef<number | null>(null);
  const liveFrameRef = useRef<number | null>(null);
  const annotationsRef = useRef<AnnotationDocument>(emptyAnnotations());
  const undoRef = useRef<AnnotationDocument[]>([]);
  const redoRef = useRef<AnnotationDocument[]>([]);
  const saveChainRef = useRef<Promise<void>>(Promise.resolve());
  const saveVersionRef = useRef(0);
  const renderCommittedRef = useRef<(document?: AnnotationDocument) => void>(() => undefined);

  const selectedItems = useMemo(
    () => (annotations.pages[String(pageNumber)] ?? []).filter((item) => selectedIds.has(item.id)),
    [annotations.pages, pageNumber, selectedIds],
  );
  const selectionBounds = useMemo(() => combinedBounds(selectedItems), [selectedItems]);

  useEffect(() => { annotationsRef.current = annotations; }, [annotations]);

  useEffect(() => {
    const target = pageWrapRef.current;
    if (!target) return;
    const block = (event: Event) => { event.preventDefault(); window.getSelection()?.removeAllRanges(); };
    target.addEventListener("contextmenu", block);
    target.addEventListener("selectstart", block);
    target.addEventListener("dragstart", block);
    return () => { target.removeEventListener("contextmenu", block); target.removeEventListener("selectstart", block); target.removeEventListener("dragstart", block); };
  }, []);

  useEffect(() => {
    interactionRef.current = null;
    activePointerIdRef.current = null;
    snappedShapeRef.current = null;
    if (holdTimerRef.current !== null) window.clearTimeout(holdTimerRef.current);
  }, [pageNumber, tool]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const update = () => {
      const rect = stage.getBoundingClientRect();
      const visualWidth = window.visualViewport?.width ?? window.innerWidth;
      const visualHeight = window.visualViewport?.height ?? window.innerHeight;
      setStageSize({ width: Math.max(1, Math.min(rect.width || visualWidth, visualWidth)), height: Math.max(1, Math.min(rect.height || visualHeight, Math.max(1, visualHeight - rect.top))) });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(stage);
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);
    return () => { observer.disconnect(); window.removeEventListener("resize", update); window.visualViewport?.removeEventListener("resize", update); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let loaded: PDFDocumentProxy | null = null;
    const loadingTimer = window.setTimeout(() => {
      if (cancelled) return;
      setPdf(null);
      setCanvasSize({ width: 0, height: 0 });
      setPageNumber(1);
      setStatus("loading");
      setMessage("Descargando PDF…");
    }, 0);
    void (async () => {
      try {
        const cacheBust = `${attachment.url}${attachment.url.includes("?") ? "&" : "?"}_=${Date.now()}`;
        const [pdfjs, response] = await Promise.all([import(/* @vite-ignore */ PDFJS_CLIENT_PATH) as Promise<typeof import("pdfjs-dist")>, fetchWithTimeout(cacheBust, 30000)]);
        if (!response.ok) throw new Error(`No se pudo abrir el PDF (${response.status})`);
        const data = await response.arrayBuffer();
        if (!data.byteLength) throw new Error("El PDF está vacío");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        loaded = await pdfjs.getDocument({ data }).promise;
        if (cancelled) return void loaded.destroy();
        setPdf(loaded);
        setStatus("saved");
        setMessage("Guardado");
        try {
          const responseAnnotations = await fetchWithTimeout(`/api/annotations?key=${encodeURIComponent(attachment.key)}&_=${Date.now()}`, 12000);
          if (responseAnnotations.ok) {
            const saved = await responseAnnotations.json() as { annotations?: AnnotationDocument };
            const document = normalizeDocument(saved.annotations);
            annotationsRef.current = document;
            setAnnotations(document);
            undoRef.current = [];
            redoRef.current = [];
            setHistoryState({ undo: 0, redo: 0 });
          }
        } catch { /* El PDF sigue siendo utilizable sin red. */ }
      } catch (reason) {
        if (cancelled) return;
        setStatus("error");
        setMessage(reason instanceof Error && reason.name === "AbortError" ? "La carga ha tardado demasiado" : reason instanceof Error ? reason.message : "No se pudo abrir el PDF");
      }
    })();
    return () => { cancelled = true; window.clearTimeout(loadingTimer); if (loaded) void loaded.destroy(); };
  }, [attachment.key, attachment.url, reloadToken]);

  const prepareCanvas = useCallback((canvas: HTMLCanvasElement, width: number, height: number) => {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(width * ratio));
    canvas.height = Math.max(1, Math.floor(height * ratio));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const context = canvas.getContext("2d");
    context?.setTransform(ratio, 0, 0, ratio, 0, 0);
  }, []);

  useEffect(() => {
    if (!pdf || !stageSize.width || !stageSize.height) return;
    let cancelled = false;
    let renderTask: { promise: Promise<unknown>; cancel: () => void } | null = null;
    void pdf.getPage(pageNumber).then(async (page) => {
      if (cancelled) return;
      const base = page.getViewport({ scale: 1 });
      const visualWidth = window.visualViewport?.width ?? window.innerWidth;
      const visualHeight = window.visualViewport?.height ?? window.innerHeight;
      const rect = stageRef.current?.getBoundingClientRect();
      const availableWidth = Math.max(80, Math.min(rect?.width || stageSize.width, visualWidth) - 18);
      const availableHeight = Math.max(80, Math.min(rect?.height || stageSize.height, Math.max(80, visualHeight - (rect?.top ?? 0))) - 18);
      const widthScale = availableWidth / base.width;
      const pageScale = Math.min(widthScale, availableHeight / base.height);
      const desiredScale = fitMode === "page" ? pageScale : fitMode === "width" ? widthScale : pageScale * zoom;
      const viewport = page.getViewport({ scale: Math.max(.05, desiredScale) });
      const canvas = pdfCanvasRef.current;
      if (!canvas || !committedCanvasRef.current || !liveCanvasRef.current) return;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(viewport.width * ratio);
      canvas.height = Math.floor(viewport.height * ratio);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      prepareCanvas(committedCanvasRef.current, viewport.width, viewport.height);
      prepareCanvas(liveCanvasRef.current, viewport.width, viewport.height);
      const context = canvas.getContext("2d");
      if (!context) return;
      renderTask = page.render({ canvas, canvasContext: context, viewport, transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0] });
      await renderTask.promise;
      if (!cancelled) { setCanvasSize({ width: viewport.width, height: viewport.height }); setMessage("Guardado"); }
    }).catch((reason) => {
      if (cancelled || (reason instanceof Error && reason.name === "RenderingCancelledException")) return;
      setStatus("error");
      setMessage("No se pudo dibujar esta página");
    });
    return () => { cancelled = true; try { renderTask?.cancel(); } catch { /* completed */ } };
  }, [fitMode, pageNumber, pdf, prepareCanvas, stageSize.height, stageSize.width, zoom]);

  const renderCommitted = useCallback((document = annotationsRef.current) => {
    const canvas = committedCanvasRef.current;
    if (!canvas || !canvasSize.width || !canvasSize.height) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, canvasSize.width, canvasSize.height);
    for (const item of document.pages[String(pageNumber)] ?? []) drawItem(context, item, canvasSize.width, canvasSize.height);
  }, [canvasSize.height, canvasSize.width, pageNumber]);

  useEffect(() => { renderCommittedRef.current = renderCommitted; renderCommitted(annotations); }, [annotations, renderCommitted]);

  const clearLive = useCallback(() => {
    const canvas = liveCanvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, canvasSize.width, canvasSize.height);
  }, [canvasSize.height, canvasSize.width]);

  const rulerLine = useCallback(() => {
    const angle = rulerAngle * Math.PI / 180;
    const cx = .5;
    const cy = rulerOffset / 100;
    const length = 1.5;
    return { a: { x: cx - Math.cos(angle) * length, y: cy - Math.sin(angle) * length, pressure: .5 }, b: { x: cx + Math.cos(angle) * length, y: cy + Math.sin(angle) * length, pressure: .5 } };
  }, [rulerAngle, rulerOffset]);

  const renderLiveNow = useCallback(() => {
    clearLive();
    const canvas = liveCanvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context || !canvasSize.width || !canvasSize.height) return;
    const interaction = interactionRef.current;
    if (interaction?.type === "stroke") {
      if (snappedShapeRef.current) drawShape(context, snappedShapeRef.current, canvasSize.width, canvasSize.height);
      else if (interaction.stroke.mode === "erase") {
        const points = interaction.stroke.points;
        context.save();
        context.strokeStyle = "rgba(73,78,75,.72)";
        context.lineWidth = Math.max(6, interaction.stroke.width * canvasSize.width);
        context.lineCap = "round";
        context.lineJoin = "round";
        context.setLineDash([3, 5]);
        context.beginPath();
        points.forEach((point, index) => index ? context.lineTo(point.x * canvasSize.width, point.y * canvasSize.height) : context.moveTo(point.x * canvasSize.width, point.y * canvasSize.height));
        context.stroke();
        context.restore();
      } else drawStroke(context, interaction.stroke, canvasSize.width, canvasSize.height);
    } else if (interaction?.type === "shape") {
      drawShape(context, { id: "preview", kind: "shape", shape: shapeKind, color, width: brushSize / canvasSize.width, start: interaction.start, end: interaction.end }, canvasSize.width, canvasSize.height);
    } else if (interaction?.type === "tape") {
      const x = Math.min(interaction.start.x, interaction.end.x);
      const y = Math.min(interaction.start.y, interaction.end.y);
      drawItem(context, { id: "preview", kind: "tape", x, y, w: Math.abs(interaction.end.x - interaction.start.x), h: Math.abs(interaction.end.y - interaction.start.y), color: "#f3d85a" }, canvasSize.width, canvasSize.height);
    } else if (interaction?.type === "lasso") {
      context.save();
      context.strokeStyle = "#655ce8";
      context.lineWidth = 1.5;
      context.setLineDash([6, 5]);
      context.beginPath();
      interaction.points.forEach((point, index) => index ? context.lineTo(point.x * canvasSize.width, point.y * canvasSize.height) : context.moveTo(point.x * canvasSize.width, point.y * canvasSize.height));
      context.stroke();
      context.restore();
    }
    if (selectionBounds) {
      context.save();
      context.strokeStyle = "#655ce8";
      context.fillStyle = rgba("#655ce8", .08);
      context.lineWidth = 1.5;
      context.setLineDash([7, 5]);
      context.fillRect(selectionBounds.x * canvasSize.width, selectionBounds.y * canvasSize.height, selectionBounds.w * canvasSize.width, selectionBounds.h * canvasSize.height);
      context.strokeRect(selectionBounds.x * canvasSize.width, selectionBounds.y * canvasSize.height, selectionBounds.w * canvasSize.width, selectionBounds.h * canvasSize.height);
      context.restore();
    }
    if (ruler) {
      const line = rulerLine();
      context.save();
      context.strokeStyle = rgba("#d7b05a", .7);
      context.lineWidth = 24;
      context.beginPath();
      context.moveTo(line.a.x * canvasSize.width, line.a.y * canvasSize.height);
      context.lineTo(line.b.x * canvasSize.width, line.b.y * canvasSize.height);
      context.stroke();
      context.strokeStyle = rgba("#7b5b21", .78);
      context.lineWidth = 1;
      context.stroke();
      context.restore();
    }
  }, [brushSize, canvasSize.height, canvasSize.width, clearLive, color, ruler, rulerLine, selectionBounds, shapeKind]);

  useEffect(() => { renderLiveNow(); }, [renderLiveNow, selectedIds]);

  function scheduleLive() {
    if (liveFrameRef.current !== null) return;
    liveFrameRef.current = window.requestAnimationFrame(() => { liveFrameRef.current = null; renderLiveNow(); });
  }

  function queueSave(next: AnnotationDocument) {
    const version = ++saveVersionRef.current;
    setStatus("saving");
    setMessage("Guardando anotaciones…");
    saveChainRef.current = saveChainRef.current.catch(() => undefined).then(async () => {
      const response = await fetch("/api/annotations", { method: "PUT", cache: "no-store", headers: { "content-type": "application/json" }, body: JSON.stringify({ key: attachment.key, annotations: next }) });
      if (!response.ok) throw new Error("No se pudieron guardar las anotaciones");
      if (version === saveVersionRef.current) { setStatus("saved"); setMessage("Guardado"); }
    }).catch((reason) => { if (version === saveVersionRef.current) { setStatus("error"); setMessage(reason instanceof Error ? reason.message : "Error al guardar"); } });
  }

  function applyDocument(next: AnnotationDocument, base = annotationsRef.current) {
    undoRef.current.push(cloneDocument(base));
    if (undoRef.current.length > 60) undoRef.current.shift();
    redoRef.current = [];
    setHistoryState({ undo: undoRef.current.length, redo: 0 });
    annotationsRef.current = next;
    setAnnotations(next);
    queueSave(next);
  }

  function pointFromNative(event: PointerEvent): Point | null {
    const canvas = liveCanvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return {
      x: clamp((event.clientX - rect.left) / rect.width),
      y: clamp((event.clientY - rect.top) / rect.height),
      pressure: event.pointerType === "pen" ? clamp(event.pressure || .08, .05, 1) : .5,
      tiltX: event.tiltX,
      tiltY: event.tiltY,
      time: event.timeStamp,
    };
  }

  function eventPoints(event: ReactPointerEvent<HTMLCanvasElement>) {
    const native = event.nativeEvent;
    const coalesced = typeof native.getCoalescedEvents === "function" ? native.getCoalescedEvents() : [];
    return (coalesced.length ? coalesced : [native]).map(pointFromNative).filter((point): point is Point => point !== null);
  }

  function projectToRuler(point: Point) {
    const { a, b } = rulerLine();
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const t = ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy || 1);
    return { ...point, x: a.x + t * dx, y: a.y + t * dy };
  }

  function addPoints(event: ReactPointerEvent<HTMLCanvasElement>, interaction: Extract<Interaction, { type: "stroke" }>) {
    let added = false;
    for (const raw of eventPoints(event)) {
      const point = interaction.rulerSnap ? projectToRuler(raw) : raw;
      const previous = interaction.stroke.points.at(-1);
      const threshold = .00022 + (smoothing / 100) * .00038;
      if (previous && Math.hypot(point.x - previous.x, point.y - previous.y) < threshold) continue;
      interaction.stroke.points.push(point);
      added = true;
    }
    return added;
  }

  function scheduleShapeRecognition(stroke: InkStroke) {
    if (holdTimerRef.current !== null) window.clearTimeout(holdTimerRef.current);
    snappedShapeRef.current = null;
    holdTimerRef.current = window.setTimeout(() => {
      const recognized = recognizeShape(stroke);
      if (recognized) { snappedShapeRef.current = shapeFromStroke(stroke, recognized); scheduleLive(); }
    }, 430);
  }

  function removeWholeAt(point: Point, interaction: Extract<Interaction, { type: "eraseWhole" }>) {
    const key = String(pageNumber);
    const current = interaction.preview.pages[key] ?? [];
    const nextItems = current.filter((item) => !hitItem(item, point, Math.max(.012, brushSize / Math.max(canvasSize.width, 1) * 4)));
    if (nextItems.length === current.length) return;
    interaction.preview = { ...interaction.preview, pages: { ...interaction.preview.pages, [key]: nextItems } };
    renderCommittedRef.current(interaction.preview);
  }

  function pointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (tool === "hand") return;
    event.preventDefault();
    event.stopPropagation();
    window.getSelection()?.removeAllRanges();
    if (event.pointerType === "touch") return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (activePointerIdRef.current !== null) return;
    const point = eventPoints(event)[0];
    if (!point || !canvasSize.width) return;
    activePointerIdRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);

    if (tool === "stamp") {
      const next = cloneDocument(annotationsRef.current);
      const key = String(pageNumber);
      next.pages[key] = [...(next.pages[key] ?? []), { id: makeId(), kind: "stamp", x: point.x, y: point.y, text: stamp, color, size: Math.max(.018, brushSize / canvasSize.width * 5) }];
      applyDocument(next);
      activePointerIdRef.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
      return;
    }

    if (tool === "tape") {
      const tape = [...(annotationsRef.current.pages[String(pageNumber)] ?? [])].reverse().find((item) => item.kind === "tape" && hitItem(item, point, .004));
      if (tape?.kind === "tape") {
        const next = cloneDocument(annotationsRef.current);
        const target = next.pages[String(pageNumber)].find((item) => item.id === tape.id) as TapeItem;
        target.revealed = !target.revealed;
        applyDocument(next);
        activePointerIdRef.current = null;
        event.currentTarget.releasePointerCapture(event.pointerId);
        return;
      }
      interactionRef.current = { type: "tape", start: point, end: point };
    } else if (tool === "shape") interactionRef.current = { type: "shape", start: point, end: point };
    else if (tool === "lasso") {
      if (selectionBounds && point.x >= selectionBounds.x && point.x <= selectionBounds.x + selectionBounds.w && point.y >= selectionBounds.y && point.y <= selectionBounds.y + selectionBounds.h) {
        const base = cloneDocument(annotationsRef.current);
        interactionRef.current = { type: "move", start: point, base, preview: base };
      } else {
        setSelectedIds(new Set());
        interactionRef.current = { type: "lasso", points: [point] };
      }
    } else if (tool === "eraser" && eraserMode === "whole") {
      const base = cloneDocument(annotationsRef.current);
      interactionRef.current = { type: "eraseWhole", base, preview: base };
      removeWholeAt(point, interactionRef.current);
    } else {
      const isHighlighter = tool === "highlighter";
      const selectedBrush: BrushKind = isHighlighter ? "highlighter" : brush;
      const widthMultiplier = tool === "eraser" ? 6 : isHighlighter ? 4.5 : 1;
      const line = rulerLine();
      const rulerSnap = ruler && distanceToSegment(point, line.a, line.b) < .035;
      const stroke: InkStroke = { id: makeId(), kind: "stroke", mode: tool === "eraser" ? "erase" : "draw", color, width: brushSize * widthMultiplier / canvasSize.width, opacity: isHighlighter ? .28 : selectedBrush === "pencil" ? .72 : 1, brush: selectedBrush, smoothing: smoothing / 100, points: [rulerSnap ? projectToRuler(point) : point] };
      interactionRef.current = { type: "stroke", stroke, rulerSnap };
      if (stroke.mode === "draw" && !rulerSnap) scheduleShapeRecognition(stroke);
    }
    scheduleLive();
  }

  function pointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (event.pointerType === "touch") { event.preventDefault(); event.stopPropagation(); return; }
    const interaction = interactionRef.current;
    if (!interaction || activePointerIdRef.current !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    const point = eventPoints(event).at(-1);
    if (!point) return;
    if (interaction.type === "stroke") {
      if (addPoints(event, interaction)) {
        if (interaction.stroke.mode === "draw" && !interaction.rulerSnap) scheduleShapeRecognition(interaction.stroke);
        scheduleLive();
      }
    } else if (interaction.type === "shape" || interaction.type === "tape") {
      interaction.end = point;
      scheduleLive();
    } else if (interaction.type === "lasso") {
      const previous = interaction.points.at(-1);
      if (!previous || Math.hypot(previous.x - point.x, previous.y - point.y) > .002) interaction.points.push(point);
      scheduleLive();
    } else if (interaction.type === "eraseWhole") removeWholeAt(point, interaction);
    else {
      const dx = point.x - interaction.start.x;
      const dy = point.y - interaction.start.y;
      const selected = selectedIds;
      const key = String(pageNumber);
      const preview = cloneDocument(interaction.base);
      preview.pages[key] = (preview.pages[key] ?? []).map((item) => transformItem(item, selected, dx, dy));
      interaction.preview = preview;
      renderCommittedRef.current(preview);
    }
  }

  function finishInteraction(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (event.pointerType === "touch") { event.preventDefault(); event.stopPropagation(); return; }
    const interaction = interactionRef.current;
    if (!interaction || activePointerIdRef.current !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    if (holdTimerRef.current !== null) window.clearTimeout(holdTimerRef.current);
    if (interaction.type === "stroke") addPoints(event, interaction);
    const key = String(pageNumber);
    if (interaction.type === "stroke") {
      const next = cloneDocument(annotationsRef.current);
      const item = snappedShapeRef.current ?? interaction.stroke;
      next.pages[key] = [...(next.pages[key] ?? []), item];
      applyDocument(next);
    } else if (interaction.type === "shape") {
      if (Math.hypot(interaction.end.x - interaction.start.x, interaction.end.y - interaction.start.y) > .006) {
        const next = cloneDocument(annotationsRef.current);
        next.pages[key] = [...(next.pages[key] ?? []), { id: makeId(), kind: "shape", shape: shapeKind, color, width: brushSize / canvasSize.width, start: interaction.start, end: interaction.end }];
        applyDocument(next);
      }
    } else if (interaction.type === "tape") {
      const x = Math.min(interaction.start.x, interaction.end.x);
      const y = Math.min(interaction.start.y, interaction.end.y);
      const w = Math.abs(interaction.end.x - interaction.start.x);
      const h = Math.abs(interaction.end.y - interaction.start.y);
      if (w > .01 && h > .005) {
        const next = cloneDocument(annotationsRef.current);
        next.pages[key] = [...(next.pages[key] ?? []), { id: makeId(), kind: "tape", x, y, w, h, color: "#f3d85a" }];
        applyDocument(next);
      }
    } else if (interaction.type === "lasso") {
      const ids = new Set((annotationsRef.current.pages[key] ?? []).filter((item) => {
        const bounds = itemBounds(item);
        return pointInPolygon({ x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2, pressure: .5 }, interaction.points);
      }).map((item) => item.id));
      setSelectedIds(ids);
    } else if (interaction.type === "move" || interaction.type === "eraseWhole") {
      if (JSON.stringify(interaction.preview) !== JSON.stringify(interaction.base)) applyDocument(interaction.preview, interaction.base);
      else renderCommittedRef.current(annotationsRef.current);
    }
    interactionRef.current = null;
    snappedShapeRef.current = null;
    activePointerIdRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    clearLive();
    window.requestAnimationFrame(renderLiveNow);
  }

  function undo() {
    const previous = undoRef.current.pop();
    if (!previous) return;
    redoRef.current.push(cloneDocument(annotationsRef.current));
    annotationsRef.current = previous;
    setAnnotations(previous);
    setSelectedIds(new Set());
    setHistoryState({ undo: undoRef.current.length, redo: redoRef.current.length });
    queueSave(previous);
  }

  function redo() {
    const next = redoRef.current.pop();
    if (!next) return;
    undoRef.current.push(cloneDocument(annotationsRef.current));
    annotationsRef.current = next;
    setAnnotations(next);
    setSelectedIds(new Set());
    setHistoryState({ undo: undoRef.current.length, redo: redoRef.current.length });
    queueSave(next);
  }

  function changeZoom(delta: number) {
    setZoom((current) => Math.max(.4, Math.min(3, Math.round(((fitMode === "custom" ? current : 1) + delta) * 100) / 100)));
    setFitMode("custom");
  }

  function toggleWritingZoom() {
    if (writingZoom) { setWritingZoom(false); setZoom(1); setFitMode("page"); }
    else { setWritingZoom(true); setZoom(1.9); setFitMode("custom"); }
  }

  function toggleBookmark() {
    const next = cloneDocument(annotationsRef.current);
    const bookmarks = new Set(next.bookmarks ?? []);
    if (bookmarks.has(pageNumber)) bookmarks.delete(pageNumber); else bookmarks.add(pageNumber);
    next.bookmarks = [...bookmarks].sort((a, b) => a - b);
    applyDocument(next);
  }

  function transformSelection(scale: number) {
    if (!selectionBounds || !selectedIds.size) return;
    const center = { x: selectionBounds.x + selectionBounds.w / 2, y: selectionBounds.y + selectionBounds.h / 2, pressure: .5 };
    const next = cloneDocument(annotationsRef.current);
    const key = String(pageNumber);
    next.pages[key] = (next.pages[key] ?? []).map((item) => transformItem(item, selectedIds, 0, 0, scale, center));
    applyDocument(next);
  }

  function duplicateSelection() {
    if (!selectedIds.size) return;
    const next = cloneDocument(annotationsRef.current);
    const key = String(pageNumber);
    const copies = (next.pages[key] ?? []).filter((item) => selectedIds.has(item.id)).map((item) => {
      const copy = { ...item, id: makeId() } as AnnotationItem;
      return transformItem(copy, new Set([copy.id]), .018, .018);
    });
    next.pages[key] = [...(next.pages[key] ?? []), ...copies];
    applyDocument(next);
    setSelectedIds(new Set(copies.map((item) => item.id)));
  }

  function deleteSelection() {
    if (!selectedIds.size) return;
    const next = cloneDocument(annotationsRef.current);
    const key = String(pageNumber);
    next.pages[key] = (next.pages[key] ?? []).filter((item) => !selectedIds.has(item.id));
    applyDocument(next);
    setSelectedIds(new Set());
  }

  function clearPage() {
    if (!(annotationsRef.current.pages[String(pageNumber)] ?? []).length || !window.confirm("¿Borrar todas las anotaciones de esta página? Podrás deshacerlo.")) return;
    const next = cloneDocument(annotationsRef.current);
    next.pages[String(pageNumber)] = [];
    applyDocument(next);
  }

  const chooseBrush = (next: BrushKind) => {
    setSelectedIds(new Set());
    setBrush(next);
    setTool(next === "highlighter" ? "highlighter" : "pen");
    const presets: Record<BrushKind, number> = { ballpoint: 4, fountain: 5, brush: 7, pencil: 4, highlighter: 8 };
    setBrushSize(presets[next]);
  };

  function selectTool(next: Tool) {
    setSelectedIds(new Set());
    if (next === "pen" && brush === "highlighter") setBrush("ballpoint");
    setTool(next);
  }

  function selectPage(next: number) {
    setSelectedIds(new Set());
    setPageNumber(next);
  }

  return (
    <section className="pdf-editor pdf-ink-studio" aria-label={`Editor de ${title}`}>
      <header className="pdf-editor-head">
        <button className="pdf-close" onClick={onClose} aria-label="Cerrar editor">×</button>
        <div className="pdf-title"><strong>{title}</strong><span className={`pdf-save ${status}`}>● {message}</span></div>
        <div className="pdf-head-actions">
          <button className={(annotations.bookmarks ?? []).includes(pageNumber) ? "active" : ""} onClick={toggleBookmark} title="Marcar página">★</button>
          <button className={showPages ? "active" : ""} onClick={() => setShowPages((value) => !value)} title="Miniaturas">▦</button>
          <div className="pdf-pages"><button disabled={pageNumber <= 1} onClick={() => selectPage(pageNumber - 1)}>‹</button><span>{pageNumber} / {pdf?.numPages ?? "—"}</span><button disabled={!pdf || pageNumber >= pdf.numPages} onClick={() => selectPage(pageNumber + 1)}>›</button></div>
        </div>
      </header>

      <div className="pdf-toolbar" role="toolbar" aria-label="Herramientas de escritura">
        <div className="pdf-toolbar-row">
          <div className="pdf-tool-group">
            <button className={tool === "hand" ? "active" : ""} onClick={() => selectTool("hand")} title="Mover">✋ <span>Mover</span></button>
            <button className={tool === "pen" ? "active" : ""} onClick={() => selectTool("pen")} title="Escribir">✎ <span>Escribir</span></button>
            <button className={tool === "highlighter" ? "active" : ""} onClick={() => chooseBrush("highlighter")} title="Subrayador">▰ <span>Subrayar</span></button>
            <button className={tool === "eraser" ? "active" : ""} onClick={() => selectTool("eraser")} title="Goma">⌫ <span>Goma</span></button>
            <button className={tool === "lasso" ? "active" : ""} onClick={() => selectTool("lasso")} title="Lazo">♧ <span>Lazo</span></button>
            <button className={tool === "shape" ? "active" : ""} onClick={() => selectTool("shape")} title="Figuras">△ <span>Figuras</span></button>
            <button className={tool === "tape" ? "active" : ""} onClick={() => selectTool("tape")} title="Cinta de estudio">▰ <span>Cinta</span></button>
            <button className={tool === "stamp" ? "active" : ""} onClick={() => selectTool("stamp")} title="Sellos">✓ <span>Sellos</span></button>
          </div>
          <div className="pdf-history-tools"><button onClick={undo} disabled={!historyState.undo} title="Deshacer">↶</button><button onClick={redo} disabled={!historyState.redo} title="Rehacer">↷</button><button onClick={clearPage} title="Limpiar página">⌫ todo</button></div>
        </div>

        <div className="pdf-toolbar-row pdf-options-row">
          {(tool === "pen" || tool === "highlighter") && <div className="pdf-presets" aria-label="Tipos de lápiz">
            <button className={brush === "ballpoint" && tool === "pen" ? "active" : ""} onClick={() => chooseBrush("ballpoint")}>Bolígrafo</button>
            <button className={brush === "fountain" && tool === "pen" ? "active" : ""} onClick={() => chooseBrush("fountain")}>Pluma</button>
            <button className={brush === "brush" && tool === "pen" ? "active" : ""} onClick={() => chooseBrush("brush")}>Pincel</button>
            <button className={brush === "pencil" && tool === "pen" ? "active" : ""} onClick={() => chooseBrush("pencil")}>Lápiz</button>
            <button className={tool === "highlighter" ? "active" : ""} onClick={() => chooseBrush("highlighter")}>Marcador</button>
          </div>}
          {tool === "shape" && <select value={shapeKind} onChange={(event) => setShapeKind(event.target.value as ShapeKind)} aria-label="Tipo de figura"><option value="line">Línea</option><option value="arrow">Flecha</option><option value="rectangle">Rectángulo</option><option value="ellipse">Círculo / elipse</option><option value="triangle">Triángulo</option></select>}
          {tool === "eraser" && <div className="pdf-segmented"><button className={eraserMode === "partial" ? "active" : ""} onClick={() => setEraserMode("partial")}>Por zona</button><button className={eraserMode === "whole" ? "active" : ""} onClick={() => setEraserMode("whole")}>Trazo entero</button></div>}
          {tool === "stamp" && <div className="pdf-segmented"><button className={stamp === "✓" ? "active" : ""} onClick={() => setStamp("✓")}>✓</button><button className={stamp === "✕" ? "active" : ""} onClick={() => setStamp("✕")}>✕</button><button className={stamp === "?" ? "active" : ""} onClick={() => setStamp("?")}>?</button></div>}
          <label className="pdf-color"><input type="color" value={color} onChange={(event) => setColor(event.target.value)} /><span style={{ background: color }} /></label>
          <label className="pdf-size"><span>Grosor</span><input type="range" min="2" max="16" value={brushSize} onChange={(event) => setBrushSize(Number(event.target.value))} /></label>
          {(tool === "pen" || tool === "highlighter") && <label className="pdf-size"><span>Estabilizar</span><input type="range" min="0" max="100" value={smoothing} onChange={(event) => setSmoothing(Number(event.target.value))} /></label>}
          <button className={`pdf-option-button ${ruler ? "active" : ""}`} onClick={() => setRuler((value) => !value)}>📏 Regla</button>
          {ruler && <><label className="pdf-size"><span>Ángulo</span><input type="range" min="-90" max="90" value={rulerAngle} onChange={(event) => setRulerAngle(Number(event.target.value))} /></label><label className="pdf-size"><span>Posición</span><input type="range" min="5" max="95" value={rulerOffset} onChange={(event) => setRulerOffset(Number(event.target.value))} /></label></>}
          <span className="pdf-pencil-status">Pencil · palma bloqueada</span>
          <div className="pdf-fit"><button className={fitMode === "page" && !writingZoom ? "active" : ""} onClick={() => { setWritingZoom(false); setZoom(1); setFitMode("page"); }}>Hoja</button><button className={fitMode === "width" ? "active" : ""} onClick={() => { setWritingZoom(false); setFitMode("width"); }}>Ancho</button><button className={writingZoom ? "active" : ""} onClick={toggleWritingZoom}>Escritura</button></div>
          <div className="pdf-zoom"><button onClick={() => changeZoom(-.15)}>−</button><span>{fitMode === "page" ? "Hoja" : fitMode === "width" ? "Ancho" : `${Math.round(zoom * 100)}%`}</span><button onClick={() => changeZoom(.15)}>＋</button></div>
        </div>
      </div>

      <div className={`pdf-selection-bar ${selectedIds.size ? "" : "empty"}`} aria-hidden={!selectedIds.size}>
        {selectedIds.size > 0 && <><strong>{selectedIds.size} seleccionado{selectedIds.size === 1 ? "" : "s"}</strong><button onClick={() => transformSelection(.9)}>Reducir</button><button onClick={() => transformSelection(1.1)}>Ampliar</button><button onClick={duplicateSelection}>Duplicar</button><button className="danger" onClick={deleteSelection}>Eliminar</button><button onClick={() => setSelectedIds(new Set())}>Cerrar</button></>}
      </div>

      <div className={`pdf-workspace ${showPages ? "with-pages" : ""}`}>
        {showPages && pdf && <aside className="pdf-page-drawer"><div><strong>Páginas</strong><button onClick={() => setShowPages(false)}>×</button></div>{Array.from({ length: pdf.numPages }, (_, index) => index + 1).map((page) => <PdfThumbnail key={page} pdf={pdf} page={page} active={page === pageNumber} bookmarked={(annotations.bookmarks ?? []).includes(page)} onSelect={() => selectPage(page)} />)}</aside>}
        <div className={`pdf-stage ${tool === "hand" ? "hand" : "drawing"}`} ref={stageRef}>
          {!pdf && status !== "error" && <div className="pdf-loading"><span /><p>{message}</p></div>}
          {status === "error" && !pdf && <div className="pdf-loading error"><strong>No se pudo abrir</strong><p>{message}</p><button onClick={() => setReloadToken((value) => value + 1)}>Reintentar</button><button onClick={onClose}>Volver</button></div>}
          <div className="pdf-page-wrap" ref={pageWrapRef} style={{ width: canvasSize.width || undefined, height: canvasSize.height || undefined }}>
            <canvas ref={pdfCanvasRef} className="pdf-page-canvas" />
            <canvas ref={committedCanvasRef} className="pdf-committed-canvas" />
            <canvas ref={liveCanvasRef} className="pdf-live-canvas" style={{ pointerEvents: tool === "hand" ? "none" : "auto" }} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={finishInteraction} onPointerCancel={finishInteraction} onLostPointerCapture={finishInteraction} />
          </div>
        </div>
      </div>
    </section>
  );
}
