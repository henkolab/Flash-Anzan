"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  DEFAULT_SETTINGS,
  describeProfile,
  generateQuestion,
  LIMITS,
  OPERATIONS,
  stepText,
  type Operation,
  type Profile,
  type ProfileSettings,
  type Question,
} from "@/lib/anzan";

type Editing = { id: number | null; settings: ProfileSettings };

const scrollbarCls =
  "overflow-y-auto [&::-webkit-scrollbar-track]:my-3.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 hover:[&::-webkit-scrollbar-thumb]:bg-slate-400";

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block whitespace-nowrap text-sm font-semibold text-slate-700">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block whitespace-nowrap text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200";

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex flex-1 cursor-pointer items-center gap-3 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 hover:bg-slate-50">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-5 w-5 shrink-0 accent-indigo-600"
      />
      <span className="text-sm font-medium">{label}</span>
    </label>
  );
}

export default function ProfilesManager({ profiles }: { profiles: Profile[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sample, setSample] = useState<Question | null>(null);

  const set = <K extends keyof ProfileSettings>(key: K, value: ProfileSettings[K]) =>
    setEditing((e) => (e ? { ...e, settings: { ...e.settings, [key]: value } } : e));

  const num = (key: keyof ProfileSettings, v: string) => {
    const n = Number(v);
    set(key, (Number.isFinite(n) ? n : 0) as never);
  };

  function openEditor(next: Editing | null) {
    setEditing(next);
    setError("");
    setSample(null);
  }

  function toggleOp(op: Operation) {
    if (!editing) return;
    const has = editing.settings.operations.includes(op);
    set(
      "operations",
      has ? editing.settings.operations.filter((o) => o !== op) : [...editing.settings.operations, op]
    );
  }

  async function save() {
    if (!editing) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(editing.id ? `/api/profiles/${editing.id}` : "/api/profiles", {
        method: editing.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...editing.settings, ageGroup: "" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not save the profile");
        return;
      }
      openEditor(null);
      router.refresh();
    } catch {
      setError("Could not reach the server");
    } finally {
      setBusy(false);
    }
  }

  async function remove(p: Profile) {
    if (!confirm(`Delete the profile "${p.name}"?`)) return;
    const res = await fetch(`/api/profiles/${p.id}`, { method: "DELETE" });
    if (res.ok) {
      if (editing?.id === p.id) openEditor(null);
      router.refresh();
    }
  }

  async function duplicate(p: Profile) {
    const { id: _id, ...rest } = p;
    void _id;
    const res = await fetch("/api/profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...rest, name: `${p.name} (copy)` }),
    });
    if (res.ok) router.refresh();
  }

  const s = editing?.settings;
  const usesFactor = s?.operations.some((o) => o === "multiply" || o === "divide");

  return (
    <div className="grid gap-6 lg:h-[calc(100vh-13.5rem)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <section className="flex flex-col lg:min-h-0">
        <div className="mb-3 flex shrink-0 items-center justify-between">
          <h2 className="whitespace-nowrap text-lg font-bold">Your profiles ({profiles.length})</h2>
          <button
            onClick={() => openEditor({ id: null, settings: { ...DEFAULT_SETTINGS } })}
            className="whitespace-nowrap rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-500"
          >
            + New profile
          </button>
        </div>

        <ul className={`-m-1 flex-1 space-y-3 p-1 pr-2 ${scrollbarCls}`}>
          {profiles.map((p) => (
            <li
              key={p.id}
              onClick={() => openEditor({ id: p.id, settings: { ...p } })}
              className={`cursor-pointer rounded-xl border bg-white p-4 shadow-sm transition ${
                editing?.id === p.id
                  ? "border-indigo-500 ring-2 ring-indigo-200"
                  : "border-slate-200 hover:border-indigo-300 hover:bg-slate-50/50"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-lg font-bold">{p.name}</div>
                  <div className="mt-1 whitespace-nowrap text-sm text-slate-600">
                    {describeProfile(p)}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1 text-sm">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      duplicate(p);
                    }}
                    className="whitespace-nowrap rounded-md px-2.5 py-1 font-medium text-slate-700 hover:bg-slate-100"
                  >
                    Duplicate
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      remove(p);
                    }}
                    className="whitespace-nowrap rounded-md px-2.5 py-1 font-medium text-rose-600 hover:bg-rose-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
          {profiles.length === 0 && (
            <li className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
              No profiles yet. Create your first one.
            </li>
          )}
        </ul>
      </section>

      {/* Editor */}
      <section className="flex flex-col lg:min-h-0">
        {!editing || !s ? (
          <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-slate-500">
            Select a profile to edit, or create a new one.
          </div>
        ) : (
          <div
            className={`max-h-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${scrollbarCls}`}
          >
            <h2 className="mb-4 text-lg font-bold">
              {editing.id ? "Edit profile" : "New profile"}
            </h2>

            <div>
              <Field label="Profile name">
                <input
                  className={inputCls}
                  value={s.name}
                  maxLength={60}
                  onChange={(e) => set("name", e.target.value)}
                />
              </Field>
            </div>

            <div className="mt-5">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Operations</span>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {OPERATIONS.map((o) => {
                  const on = s.operations.includes(o.id);
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => toggleOp(o.id)}
                      className={`whitespace-nowrap rounded-xl border-2 px-3 py-3 text-center font-semibold transition ${
                        on
                          ? "border-indigo-600 bg-indigo-600 text-white"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                      }`}
                    >
                      <span className="block text-2xl leading-none">{o.symbol}</span>
                      <span className="text-sm">{o.label}</span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Select several to mix them. Division always gives whole numbers.
              </p>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Digits per number">
                <input
                  type="number"
                  className={inputCls}
                  min={LIMITS.digits[0]}
                  max={LIMITS.digits[1]}
                  value={s.digits}
                  onChange={(e) => num("digits", e.target.value)}
                />
              </Field>
              <Field label="Numbers per question">
                <input
                  type="number"
                  className={inputCls}
                  min={LIMITS.count[0]}
                  max={LIMITS.count[1]}
                  value={s.count}
                  onChange={(e) => num("count", e.target.value)}
                />
              </Field>
              <Field label="Questions per session">
                <input
                  type="number"
                  className={inputCls}
                  min={LIMITS.rounds[0]}
                  max={LIMITS.rounds[1]}
                  value={s.rounds}
                  onChange={(e) => num("rounds", e.target.value)}
                />
              </Field>
              <Field label="Seconds per number" hint="How long each number is shown">
                <input
                  type="number"
                  step={0.1}
                  className={inputCls}
                  min={LIMITS.intervalMs[0] / 1000}
                  max={LIMITS.intervalMs[1] / 1000}
                  value={s.intervalMs / 1000}
                  onChange={(e) =>
                    num("intervalMs", String(Math.round(Number(e.target.value) * 1000)))
                  }
                />
              </Field>
              <Field label="Blank pause (ms)" hint="Gap between numbers">
                <input
                  type="number"
                  step={50}
                  className={inputCls}
                  min={LIMITS.gapMs[0]}
                  max={LIMITS.gapMs[1]}
                  value={s.gapMs}
                  onChange={(e) => num("gapMs", e.target.value)}
                />
              </Field>
              <Field label="Countdown (seconds)" hint="0 = start straight away">
                <input
                  type="number"
                  className={inputCls}
                  min={LIMITS.countdown[0]}
                  max={LIMITS.countdown[1]}
                  value={s.countdown}
                  onChange={(e) => num("countdown", e.target.value)}
                />
              </Field>
              {usesFactor && (
                <Field label="Multiplier / divisor digits" hint="1 = ×2…9, 2 = ×2…99">
                  <input
                    type="number"
                    className={inputCls}
                    min={LIMITS.multiplierDigits[0]}
                    max={LIMITS.multiplierDigits[1]}
                    value={s.multiplierDigits}
                    onChange={(e) => num("multiplierDigits", e.target.value)}
                  />
                </Field>
              )}
            </div>

            <div className="mt-5 flex flex-wrap gap-2.5">
              <Toggle
                checked={s.variableDigits}
                onChange={(v) => set("variableDigits", v)}
                label="Mix digit lengths (1 to N)"
              />
              {s.operations.includes("subtract") && (
                <Toggle
                  checked={s.allowNegative}
                  onChange={(v) => set("allowNegative", v)}
                  label="Allow negative totals"
                />
              )}
              <Toggle
                checked={s.sound}
                onChange={(v) => set("sound", v)}
                label="Beep on each number"
              />
            </div>

            {/* Sample */}
            <div className="mt-5 rounded-xl bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <span className="whitespace-nowrap text-sm font-semibold text-slate-700">
                  Sample question
                </span>
                <button
                  type="button"
                  onClick={() => s.operations.length && setSample(generateQuestion(s))}
                  className="whitespace-nowrap rounded-md bg-white px-3 py-1 text-sm font-medium text-indigo-700 shadow-sm ring-1 ring-slate-200 hover:bg-indigo-50"
                >
                  Generate sample
                </button>
              </div>
              {sample ? (
                <div className="mt-3 flex flex-wrap items-center gap-2 text-lg tabular-nums">
                  {sample.steps.map((st, i) => (
                    <span
                      key={i}
                      className="whitespace-nowrap rounded-md bg-white px-2.5 py-1 ring-1 ring-slate-200"
                    >
                      {stepText(st, sample.showSigns)}
                    </span>
                  ))}
                  <span className="whitespace-nowrap font-bold text-emerald-700">
                    = {sample.answer}
                  </span>
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-500">
                  Preview the kind of numbers this profile will produce.
                </p>
              )}
            </div>

            {error && (
              <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
                {error}
              </p>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => openEditor(null)}
                className="whitespace-nowrap rounded-lg px-4 py-2 font-medium text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={busy}
                className="whitespace-nowrap rounded-lg bg-indigo-600 px-6 py-2 font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                {busy ? "Saving…" : "Save profile"}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}