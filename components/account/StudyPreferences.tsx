"use client";
import { useState } from "react";
import BottomSheet from "../sheets/BottomSheet";
export default function StudyPreferences({
  settings,
  onClose,
  onSave,
}: {
  settings: { dailyReviewGoal: number; dailyNewLimit: number };
  onClose: () => void;
  onSave: (settings: {
    dailyReviewGoal: number;
    dailyNewLimit: number;
  }) => void;
}) {
  const [goal, setGoal] = useState(settings.dailyReviewGoal),
    [fresh, setFresh] = useState(settings.dailyNewLimit);
  return (
    <BottomSheet
      title="Tu ritmo de tarjetas"
      subtitle="Puedes empezar a estudiar sin cambiar estas preferencias."
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave({ dailyReviewGoal: goal, dailyNewLimit: fresh });
        }}
      >
        <label>
          Tarjetas por sesión recomendada
          <input
            type="number"
            required
            min={1}
            max={500}
            value={goal}
            onChange={(e) => setGoal(Number(e.target.value))}
          />
        </label>
        <label>
          Máximo de tarjetas nuevas
          <input
            type="number"
            required
            min={0}
            max={500}
            value={fresh}
            onChange={(e) => setFresh(Number(e.target.value))}
          />
        </label>
        <button className="primary-button full">Guardar preferencias</button>
      </form>
    </BottomSheet>
  );
}
