import type { Flashcard } from "./store.js";

export function nextReview(card: Flashcard, quality: number): Flashcard {
  // quality: 1 = forgot, 2 = hard, 3 = good, 4 = easy
  let { interval_days, ease_factor, repetitions } = card;

  if (quality < 2) {
    repetitions = 0;
    interval_days = 0;
  } else {
    if (repetitions === 0) {
      interval_days = 1;
    } else if (repetitions === 1) {
      interval_days = 3;
    } else {
      interval_days = Math.round(interval_days * ease_factor);
    }
    repetitions++;
  }

  ease_factor = Math.max(1.3, ease_factor + (0.1 - (4 - quality) * 0.15));

  const next = new Date();
  next.setDate(next.getDate() + interval_days);

  return {
    ...card,
    interval_days,
    ease_factor: Math.round(ease_factor * 100) / 100,
    repetitions,
    next_review: next.toISOString(),
  };
}
