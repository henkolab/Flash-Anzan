// Shared (client + server) logic: types, defaults, validation and the
// question generator for the flash-anzan trainer.

export type Operation = "add" | "subtract" | "multiply" | "divide";

export const OPERATIONS: { id: Operation; label: string; symbol: string }[] = [
  { id: "add", label: "Add", symbol: "+" },
  { id: "subtract", label: "Subtract", symbol: "−" },
  { id: "multiply", label: "Multiply", symbol: "×" },
  { id: "divide", label: "Divide", symbol: "÷" },
];

export const SYMBOL: Record<Operation, string> = {
  add: "+",
  subtract: "−",
  multiply: "×",
  divide: "÷",
};

export interface ProfileSettings {
  name: string;
  ageGroup: string;
  operations: Operation[];
  /** digits of each number (max digits when variableDigits is on) */
  digits: number;
  /** numbers may have fewer digits than `digits` */
  variableDigits: boolean;
  /** how many numbers are flashed per question */
  count: number;
  /** how long each number stays on screen (ms) */
  intervalMs: number;
  /** blank pause between numbers (ms) */
  gapMs: number;
  /** digits of the multiplier / divisor */
  multiplierDigits: number;
  /** allow the running total to drop below zero */
  allowNegative: boolean;
  /** questions per session */
  rounds: number;
  /** countdown seconds before the first number */
  countdown: number;
  /** beep on every number */
  sound: boolean;
}

export interface Profile extends ProfileSettings {
  id: number;
}

export const LIMITS = {
  digits: [1, 8],
  count: [2, 30],
  intervalMs: [100, 10000],
  gapMs: [0, 2000],
  multiplierDigits: [1, 3],
  rounds: [1, 100],
  countdown: [0, 10],
} as const;

export const DEFAULT_SETTINGS: ProfileSettings = {
  name: "New profile",
  ageGroup: "",
  operations: ["add", "subtract"],
  digits: 2,
  variableDigits: false,
  count: 5,
  intervalMs: 1000,
  gapMs: 150,
  multiplierDigits: 1,
  allowNegative: false,
  rounds: 10,
  countdown: 3,
  sound: true,
};

export const SEED_PROFILES: ProfileSettings[] = [
  {
    name: "Starters",
    ageGroup: "Ages 5–7",
    operations: ["add"],
    digits: 1,
    variableDigits: false,
    count: 3,
    intervalMs: 2000,
    gapMs: 300,
    multiplierDigits: 1,
    allowNegative: false,
    rounds: 10,
    countdown: 3,
    sound: true,
  },
  {
    name: "Explorers",
    ageGroup: "Ages 8–10",
    operations: ["add", "subtract"],
    digits: 2,
    variableDigits: false,
    count: 4,
    intervalMs: 1500,
    gapMs: 200,
    multiplierDigits: 1,
    allowNegative: false,
    rounds: 10,
    countdown: 3,
    sound: true,
  },
  {
    name: "Challengers",
    ageGroup: "Ages 11–13",
    operations: ["add", "subtract", "multiply", "divide"],
    digits: 2,
    variableDigits: true,
    count: 5,
    intervalMs: 1200,
    gapMs: 150,
    multiplierDigits: 1,
    allowNegative: false,
    rounds: 10,
    countdown: 3,
    sound: true,
  },
  {
    name: "Masters",
    ageGroup: "Ages 14+",
    operations: ["add", "subtract", "multiply", "divide"],
    digits: 3,
    variableDigits: false,
    count: 7,
    intervalMs: 800,
    gapMs: 100,
    multiplierDigits: 2,
    allowNegative: true,
    rounds: 10,
    countdown: 3,
    sound: false,
  },
];

function clampInt(v: unknown, [min, max]: readonly [number, number], fallback: number) {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export type SanitizeResult =
  | { ok: true; value: ProfileSettings }
  | { ok: false; error: string };

export function sanitizeSettings(input: unknown): SanitizeResult {
  if (!input || typeof input !== "object") {
    return { ok: false, error: "Invalid request body" };
  }
  const o = input as Record<string, unknown>;
  const name = typeof o.name === "string" ? o.name.trim().slice(0, 60) : "";
  if (!name) return { ok: false, error: "Please give the profile a name" };
  const ageGroup =
    typeof o.ageGroup === "string" ? o.ageGroup.trim().slice(0, 40) : "";
  const ops = Array.isArray(o.operations)
    ? OPERATIONS.map((x) => x.id).filter((id) => (o.operations as unknown[]).includes(id))
    : [];
  if (ops.length === 0) {
    return { ok: false, error: "Select at least one operation" };
  }
  const d = DEFAULT_SETTINGS;
  const value: ProfileSettings = {
    name,
    ageGroup,
    operations: ops,
    digits: clampInt(o.digits, LIMITS.digits, d.digits),
    variableDigits: Boolean(o.variableDigits),
    count: clampInt(o.count, LIMITS.count, d.count),
    intervalMs: clampInt(o.intervalMs, LIMITS.intervalMs, d.intervalMs),
    gapMs: clampInt(o.gapMs, LIMITS.gapMs, d.gapMs),
    multiplierDigits: clampInt(o.multiplierDigits, LIMITS.multiplierDigits, d.multiplierDigits),
    allowNegative: Boolean(o.allowNegative),
    rounds: clampInt(o.rounds, LIMITS.rounds, d.rounds),
    countdown: clampInt(o.countdown, LIMITS.countdown, d.countdown),
    sound: Boolean(o.sound),
  };
  return { ok: true, value };
}

// ---------------------------------------------------------------------------
// Question generator
// ---------------------------------------------------------------------------

export interface Step {
  /** null for the very first number */
  op: Operation | null;
  value: number;
  /** running total after this step */
  total: number;
}

export interface Question {
  steps: Step[];
  answer: number;
  /** show +/−/×/÷ signs (hidden for add-only profiles) */
  showSigns: boolean;
}

const rnd = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];

function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function attempt(s: ProfileSettings): Step[] {
  const hasDivide = s.operations.includes("divide");
  const hi = 10 ** s.digits - 1;
  const lo = s.digits === 1 ? 1 : 10 ** (s.digits - 1);
  const cap = 10 ** (s.digits + 1) - 1; // limit for multiplication results
  const maxMul = 10 ** s.multiplierDigits - 1;

  const operand = () => {
    if (s.variableDigits) {
      const dg = rnd(1, s.digits);
      return rnd(dg === 1 ? 1 : 10 ** (dg - 1), 10 ** dg - 1);
    }
    return rnd(lo, hi);
  };

  let start = operand();
  if (hasDivide) {
    // Bias the first number toward highly divisible values.
    const m = pick([2, 3, 4, 5, 6, 8, 9, 10, 12, 24]);
    const adj = Math.floor(start / m) * m;
    if (adj >= lo && adj <= hi) start = adj;
  }

  const steps: Step[] = [{ op: null, value: start, total: start }];
  let total = start;

  const tryOperand = (op: Operation): number | null => {
    switch (op) {
      case "add":
        return operand();
      case "subtract": {
        const v = operand();
        if (s.allowNegative || v <= total) return v;
        if (total < 1) return null;
        return rnd(Math.min(lo, total), Math.min(hi, total));
      }
      case "multiply": {
        if (total === 0) return null;
        const maxM = Math.min(maxMul, Math.floor(cap / Math.abs(total)));
        if (maxM < 2) return null;
        return rnd(2, maxM);
      }
      case "divide": {
        if (total === 0) return null;
        const divs: number[] = [];
        for (let d = 2; d <= maxMul; d++) if (total % d === 0) divs.push(d);
        return divs.length ? pick(divs) : null;
      }
    }
  };

  for (let i = 1; i < s.count; i++) {
    let chosen: { op: Operation; v: number } | null = null;
    for (const op of shuffle(s.operations)) {
      const v = tryOperand(op);
      if (v !== null) {
        chosen = { op, v };
        break;
      }
    }
    if (!chosen) break;
    switch (chosen.op) {
      case "add":
        total += chosen.v;
        break;
      case "subtract":
        total -= chosen.v;
        break;
      case "multiply":
        total *= chosen.v;
        break;
      case "divide":
        total /= chosen.v;
        break;
    }
    steps.push({ op: chosen.op, value: chosen.v, total });
  }
  return steps;
}

export function generateQuestion(s: ProfileSettings): Question {
  let best: Step[] = [];
  for (let i = 0; i < 400; i++) {
    const steps = attempt(s);
    if (steps.length > best.length) best = steps;
    if (steps.length >= s.count) break;
  }
  return {
    steps: best,
    answer: best[best.length - 1].total,
    showSigns: s.operations.some((o) => o !== "add"),
  };
}

export function stepText(step: Step, showSigns: boolean): string {
  if (step.op === null || !showSigns) return String(step.value);
  return `${SYMBOL[step.op]} ${step.value}`;
}

export function formatNumber(n: number): string {
  return n < 0 ? `−${Math.abs(n)}` : String(n);
}

export function describeProfile(p: ProfileSettings): string {
  const ops = OPERATIONS.filter((o) => p.operations.includes(o.id))
    .map((o) => o.symbol)
    .join(" ");
  return `${ops} · ${p.variableDigits ? "1–" : ""}${p.digits}-digit · ${p.count} numbers · ${(p.intervalMs / 1000).toFixed(1)}s`;
}
