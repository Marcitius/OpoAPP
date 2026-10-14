"use client";
import { Card, Review } from "../../lib/study/legacy";

export function ActivityChart({ reviews }: { reviews: Review[] }) {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - 6 + index);
    return date;
  });
  const values = days.map(
    (day) =>
      reviews.filter((review) =>
        review.reviewedAt.startsWith(day.toISOString().slice(0, 10)),
      ).length,
  );
  const max = Math.max(1, ...values);
  return (
    <div className="activity-chart">
      {days.map((day, index) => (
        <div key={day.toISOString()}>
          <span className="bar-value">{values[index] || ""}</span>
          <span
            className="bar"
            style={{ height: `${Math.max(7, (values[index] / max) * 150)}px` }}
          />
          <small>
            {new Intl.DateTimeFormat("es-ES", { weekday: "short" })
              .format(day)
              .slice(0, 2)}
          </small>
        </div>
      ))}
    </div>
  );
}

export function MemoryBreakdown({ cards }: { cards: Card[] }) {
  const fresh = cards.filter((card) => card.reviewCount === 0).length;
  const learning = cards.filter(
    (card) => card.reviewCount > 0 && card.intervalDays < 7,
  ).length;
  const solid = cards.filter(
    (card) => card.intervalDays >= 7 && card.intervalDays < 21,
  ).length;
  const mastered = cards.filter((card) => card.intervalDays >= 21).length;
  const total = Math.max(1, cards.length);
  const items = [
    { label: "Nuevas", value: fresh, color: "#B8B7AE" },
    { label: "Aprendiendo", value: learning, color: "#D89B55" },
    { label: "Consolidadas", value: solid, color: "#6C8FA6" },
    { label: "Dominadas", value: mastered, color: "#285943" },
  ];
  return (
    <div className="memory-breakdown">
      <div
        className="memory-donut"
        style={{
          background: `conic-gradient(${items.map((item, index) => `${item.color} ${(items.slice(0, index).reduce((sum, part) => sum + part.value, 0) / total) * 100}% ${(items.slice(0, index + 1).reduce((sum, part) => sum + part.value, 0) / total) * 100}%`).join(",")})`,
        }}
      >
        <span>
          <strong>{cards.length}</strong>
          <small>tarjetas</small>
        </span>
      </div>
      <div>
        {items.map((item) => (
          <p key={item.label}>
            <i style={{ background: item.color }} />
            {item.label}
            <strong>{item.value}</strong>
          </p>
        ))}
      </div>
    </div>
  );
}

export function streakDays(reviews: Review[]) {
  const days = new Set(reviews.map((review) => review.reviewedAt.slice(0, 10)));
  let streak = 0;
  const date = new Date();
  while (days.has(date.toISOString().slice(0, 10))) {
    streak += 1;
    date.setDate(date.getDate() - 1);
  }
  return streak;
}
