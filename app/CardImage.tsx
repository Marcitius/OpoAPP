"use client";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { useEngine } from "../components/SyncContext";
import {
  attachmentUrl,
  readAnnotations,
  saveAnnotations,
  type Attachment,
  type AnnotationDocument,
} from "../lib/data/files";
type Props = { attachment: Attachment; title?: string; onClose: () => void };
function useImage(a: Attachment) {
  const [url, setUrl] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    attachmentUrl(a)
      .then((x) => {
        if (active) setUrl(x);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [a.key, a.url]);
  return { url, error };
}
function renderInk(
  canvas: HTMLCanvasElement,
  doc: AnnotationDocument,
  width: number,
  height: number,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  canvas.width = width;
  canvas.height = height;
  ctx.clearRect(0, 0, width, height);
  for (const stroke of doc.pages["1"] ?? []) {
    const points = stroke.points ?? [];
    if (!points.length) continue;
    ctx.save();
    ctx.globalCompositeOperation =
      stroke.mode === "erase" ? "destination-out" : "source-over";
    ctx.strokeStyle = stroke.color;
    ctx.fillStyle = stroke.color;
    ctx.lineWidth = Math.max(1, stroke.width * width);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    points.forEach((p: any, i: number) =>
      i
        ? ctx.lineTo(p.x * width, p.y * height)
        : ctx.moveTo(p.x * width, p.y * height),
    );
    if (points.length === 1) {
      ctx.arc(
        points[0].x * width,
        points[0].y * height,
        ctx.lineWidth / 2,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    } else ctx.stroke();
    ctx.restore();
  }
}
export function AnnotatedCardImage({
  attachment,
  onOpen,
}: {
  attachment: Attachment;
  onOpen: () => void;
}) {
  const e = useEngine(),
    { url, error } = useImage(attachment),
    [doc, setDoc] = useState<AnnotationDocument>({ version: 1, pages: {} }),
    canvas = useRef<HTMLCanvasElement>(null),
    img = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const load = () => readAnnotations(e, attachment.key).then(setDoc);
    void load();
    return e.subscribe(() => void load());
  }, [e, attachment.key]);
  const draw = () => {
    if (canvas.current && img.current)
      renderInk(
        canvas.current,
        doc,
        img.current.naturalWidth,
        img.current.naturalHeight,
      );
  };
  useEffect(draw, [doc, url]);
  return error ? (
    <p role="alert">{error}</p>
  ) : (
    <button
      type="button"
      className="answer-image-preview"
      onClick={onOpen}
      style={{
        border: 0,
        padding: 0,
        background: "transparent",
        width: "100%",
      }}
    >
      <div className="image-ink-wrap">
        <img
          ref={img}
          src={url || undefined}
          alt={attachment.name}
          onLoad={draw}
        />
        <canvas ref={canvas} style={{ pointerEvents: "none" }} />
      </div>
    </button>
  );
}
export function ImageLightbox(p: Props) {
  return (
    <section
      className="answer-image-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={p.title}
    >
      <header>
        <button onClick={p.onClose} aria-label="Cerrar">
          ×
        </button>
        <strong>{p.title}</strong>
      </header>
      <AnnotatedCardImage attachment={p.attachment} onOpen={() => {}} />
    </section>
  );
}
export function ImageAnnotator(p: Props) {
  const e = useEngine(),
    { url, error } = useImage(p.attachment),
    [doc, setDoc] = useState<AnnotationDocument>({ version: 1, pages: {} }),
    [color, setColor] = useState("#285943"),
    [width, setWidth] = useState(4),
    [eraser, setEraser] = useState(false),
    [message, setMessage] = useState("");
  const saved = useRef(doc),
    canvas = useRef<HTMLCanvasElement>(null),
    img = useRef<HTMLImageElement>(null),
    stroke = useRef<any>(null);
  useEffect(() => {
    let active = true;
    const load = async () => {
      if (stroke.current) return;
      const d = await readAnnotations(e, p.attachment.key);
      if (active) {
        saved.current = d;
        setDoc(d);
      }
    };
    void load();
    const off = e.subscribe(() => void load());
    return () => {
      active = false;
      off();
    };
  }, [e, p.attachment.key]);
  const draw = (d = doc) => {
    if (canvas.current && img.current)
      renderInk(
        canvas.current,
        d,
        img.current.naturalWidth,
        img.current.naturalHeight,
      );
  };
  useEffect(() => draw(), [doc, url]);
  const point = (event: PointerEvent<HTMLCanvasElement>) => {
    const r = event.currentTarget.getBoundingClientRect();
    return {
      x: (event.clientX - r.left) / r.width,
      y: (event.clientY - r.top) / r.height,
      pressure: event.pressure || 0.5,
    };
  };
  const save = async (next: AnnotationDocument) => {
    const previous = saved.current;
    saved.current = next;
    setDoc(next);
    try {
      await saveAnnotations(e, p.attachment.key, previous, next);
      setMessage("Guardado");
    } catch (err) {
      setMessage((err as Error).message);
    }
  };
  return (
    <section
      className="image-annotator"
      role="dialog"
      aria-modal="true"
      aria-label="Anotar imagen"
    >
      <header>
        <button onClick={p.onClose} aria-label="Cerrar">
          ×
        </button>
        <div>
          <strong>{p.title}</strong>
          <small>
            {message || error || "Escribe con el dedo, lápiz o ratón"}
          </small>
        </div>
        <button
          onClick={() => {
            const current = doc.pages["1"] ?? [];
            void save({ version: 1, pages: { "1": current.slice(0, -1) } });
          }}
          aria-label="Deshacer"
        >
          ↶
        </button>
      </header>
      <div className="pdf-toolbar">
        <label>
          Color
          <input
            type="color"
            value={color}
            onChange={(x) => setColor(x.target.value)}
          />
        </label>
        <label>
          Trazo
          <input
            type="range"
            min={2}
            max={18}
            value={width}
            onChange={(x) => setWidth(+x.target.value)}
          />
        </label>
        <button onClick={() => setEraser((x) => !x)}>
          {eraser ? "Lápiz" : "Goma"}
        </button>
      </div>
      <div className="pdf-stage">
        <div className="image-ink-wrap">
          <img
            ref={img}
            src={url || undefined}
            alt={p.attachment.name}
            onLoad={() => draw()}
          />
          <canvas
            ref={canvas}
            onPointerDown={(event) => {
              event.preventDefault();
              event.currentTarget.setPointerCapture(event.pointerId);
              stroke.current = {
                id: crypto.randomUUID(),
                createdAt: new Date().toISOString(),
                mode: eraser ? "erase" : "draw",
                color,
                width:
                  width / event.currentTarget.getBoundingClientRect().width,
                points: [point(event)],
              };
            }}
            onPointerMove={(event) => {
              if (!stroke.current) return;
              stroke.current.points.push(point(event));
              draw({
                version: 1,
                pages: {
                  "1": [...(saved.current.pages["1"] ?? []), stroke.current],
                },
              });
            }}
            onPointerUp={() => {
              if (!stroke.current) return;
              const next = {
                version: 1 as const,
                pages: {
                  "1": [...(saved.current.pages["1"] ?? []), stroke.current],
                },
              };
              stroke.current = null;
              void save(next);
            }}
            onPointerCancel={() => {
              if (stroke.current) {
                const next = {
                  version: 1 as const,
                  pages: {
                    "1": [...(saved.current.pages["1"] ?? []), stroke.current],
                  },
                };
                stroke.current = null;
                void save(next);
              }
            }}
          />
        </div>
      </div>
    </section>
  );
}
