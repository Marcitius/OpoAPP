"use client";
import { Review, todayKey } from "../../lib/study/legacy";

export function StatCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: string;
}) {
  return (
    <article className={`stat-card ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

export function WeekStrip({ reviews }: { reviews: Review[] }) {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - 6 + index);
    return date;
  });
  return (
    <div className="week-strip">
      {days.map((day) => {
        const key = day.toISOString().slice(0, 10);
        const count = reviews.filter((review) =>
          review.reviewedAt.startsWith(key),
        ).length;
        return (
          <div
            key={key}
            className={count ? "done" : key === todayKey() ? "today" : ""}
          >
            <span>
              {new Intl.DateTimeFormat("es-ES", { weekday: "narrow" }).format(
                day,
              )}
            </span>
            <strong>{day.getDate()}</strong>
            <small>{count || "·"}</small>
          </div>
        );
      })}
    </div>
  );
}

export function Empty({
  icon,
  title,
  copy,
  action,
  onAction,
}: {
  icon: string;
  title: string;
  copy: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <div className="empty-state">
      <span>{icon}</span>
      <h3>{title}</h3>
      <p>{copy}</p>
      <button className="primary-button" onClick={onAction}>
        {action}
      </button>
    </div>
  );
}
