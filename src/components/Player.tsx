"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  describeProfile,
  formatNumber,
  generateQuestion,
  OPERATIONS,
  stepText,
  type Profile,
  type Question,
} from "@/lib/anzan";

type Phase = "idle" | "countdown" | "flash" | "answer" | "result";

const STORAGE_KEY = "anzan.profileId";

export default function Player({ profiles }: { profiles: Profile[] }) {
  const [selectedId, setSelectedId] = useState<number | null>(profiles[0]?.id ?? null);
  const [speedMs, setSpeedMs] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [question, setQuestion] = useState<Question | null>(null);
  const [round, setRound] = useState(0);
  const [countText, setCountText] = useState("");
  const [shown, setShown] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [typed, setTyped] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);

  const stageRef = useRef<HTMLDivElement>(null);
  const runId = useRef(0);
  const audioRef = useRef<AudioContext | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Restore the last-used profile on this browser.
  useEffect(() => {
    const saved = Number(localStorage.getItem(STORAGE_KEY));
    if (saved && profiles.some((p) => p.id === saved)) setSelectedId(saved);
  }, [profiles]);

  const profile = useMemo(
    () => profiles.find((p) => p.id === selectedId) ?? profiles[0] ?? null,
    [profiles, selectedId],
  );

  const interval = speedMs ?? profile?.intervalMs ?? 1000;

  const beep = useCallback((freq = 880, ms = 70) => {
    try {
      const ctx = audioRef.current;
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      gain.gain.value = 0.08;
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + ms / 1000);
    } catch {
      /* audio is optional */
    }
  }, []);

  const stop = useCallback(() => {
    runId.current++;
    setPhase("idle");
    setShown(null);
  }, []);

  const play = useCallback(
    async (q: Question) => {
      if (!profile) return;
      const run = ++runId.current;
      const alive = () => runId.current === run;
      const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

      if (profile.sound) {
        try {
          audioRef.current ??= new AudioContext();
          await audioRef.current.resume();
        } catch {
          /* ignore */
        }
      }

      setQuestion(q);
      setTyped("");
      setShown(null);
      setProgress(0);

      if (profile.countdown > 0) {
        setPhase("countdown");
        for (let c = profile.countdown; c >= 1; c--) {
          setCountText(String(c));
          if (profile.sound) beep(520, 90);
          await sleep(1000);
          if (!alive()) return;
        }
        setCountText("GO!");
        if (profile.sound) beep(1040, 160);
        await sleep(500);
        if (!alive()) return;
      }

      setPhase("flash");
      for (let i = 0; i < q.steps.length; i++) {
        setProgress(i + 1);
        setShown(stepText(q.steps[i], q.showSigns));
        if (profile.sound) beep();
        await sleep(interval);
        if (!alive()) return;
        setShown(null);
        if (profile.gapMs > 0) await sleep(profile.gapMs);
        if (!alive()) return;
      }
      await sleep(150);
      if (!alive()) return;
      setPhase("answer");
    },
    [profile, interval, beep],
  );

  const startNew = useCallback(() => {
    if (!profile) return;
    const nextRound = round >= profile.rounds ? 1 : round + 1;
    setRound(nextRound);
    void play(generateQuestion(profile));
  }, [profile, round, play]);

  const replay = useCallback(() => {
    if (question) void play(question);
  }, [question, play]);

  const reveal = useCallback(() => setPhase("result"), []);

  // Focus the answer box when it appears.
  useEffect(() => {
    if (phase === "answer") inputRef.current?.focus();
  }, [phase]);

  // Keyboard shortcuts for the presenting teacher.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      const inField = tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA";
      if (e.key === "Escape" && phase !== "idle" && !document.fullscreenElement) {
        stop();
        return;
      }
      if (inField) return;
      if (e.key === " " || e.key === "Enter") {
        if (phase === "idle" || phase === "result") {
          e.preventDefault();
          startNew();
        } else if (phase === "answer") {
          e.preventDefault();
          reveal();
        }
      } else if (e.key.toLowerCase() === "r" && (phase === "answer" || phase === "result")) {
        replay();
      } else if (e.key.toLowerCase() === "f") {
        void toggleFullscreen();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    const onFs = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  useEffect(() => () => void runId.current++, []);

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await stageRef.current?.requestFullscreen();
    } catch {
      /* not supported */
    }
  }

  function selectProfile(id: number) {
    setSelectedId(id);
    setSpeedMs(null);
    setRound(0);
    localStorage.setItem(STORAGE_KEY, String(id));
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl bg-white p-10 text-center shadow">
        <h2 className="text-2xl font-bold">No profiles yet</h2>
        <p className="mt-2 text-slate-600">Create a setting profile to start presenting.</p>
        <Link
          href="/profiles"
          className="mt-6 inline-block rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white hover:bg-indigo-500"
        >
          Create a profile
        </Link>
      </div>
    );
  }

  const typedNum = typed.trim() === "" ? null : Number(typed.replace("−", "-"));
  const correct = typedNum !== null && question ? typedNum === question.answer : null;
  const sessionDone = round >= profile.rounds;
  const numLen = shown ? shown.replace(/\s/g, "").length : 1;
  const flashSize = `clamp(3rem, min(${Math.min(24, 150 / (numLen + 2))}vw, 34vh), 22rem)`;

  return (
    <div className="space-y-4">
      {/* Controls above the stage (hidden when the stage is fullscreen) */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white px-5 py-3 shadow-sm">
        {/* Left Side: Profile Selector + Edit Button grouped together */}
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-3">
            <div className="relative w-64 sm:w-72">
              <select
                value={profile.id}
                onChange={(e) => selectProfile(Number(e.target.value))}
                disabled={phase === "countdown" || phase === "flash"}
                className="h-10 w-full appearance-none truncate rounded-lg border border-slate-300 bg-slate-50/50 pl-3 pr-10 text-sm font-semibold text-slate-800 transition hover:border-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
              >
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.ageGroup ? ` — ${p.ageGroup}` : ""}
                  </option>
                ))}
              </select>

              {/* Custom spaced arrow icon */}
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-slate-500">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </label>

          <Link
            href="/profiles"
            className=" inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-900"
          >
            <svg className="h-4 w-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            Edit profiles
          </Link>
        </div>

        {/* Right Side: Fullscreen utility button */}
        <button
          onClick={toggleFullscreen}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-900 cursor-pointer"
          title="Shortcut: F"
        >
          <svg className="h-4 w-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
          Fullscreen
        </button>
      </div>

      {/* The stage */}
      <div
        ref={stageRef}
        className={`relative flex select-none flex-col items-center justify-center overflow-hidden bg-slate-950 text-white ${
          isFullscreen ? "h-screen w-screen" : "min-h-[68vh] rounded-3xl shadow-xl"
        }`}
      >
        {/* top bar inside stage */}
        <div className="absolute left-0 right-0 top-0 flex items-center justify-between p-8 text-sm text-slate-400">
        {/* Left Side */}
        <div className="flex items-center gap-3">
          {isFullscreen ? (
            <span>
              {profile.name}
              {profile.ageGroup ? ` · ${profile.ageGroup}` : ""}
            </span>
          ) : (
            round > 0 && (
              <span className="rounded-full bg-slate-800 px-3 py-1">
                Question {round} / {profile.rounds}
              </span>
            )
          )}
        </div>

        {/* Right Side */}
        <div className="flex items-center gap-3">
          {isFullscreen && round > 0 && (
            <span className="rounded-full bg-slate-800 px-3 py-1">
              Question {round} / {profile.rounds}
            </span>
          )}
          {phase !== "idle" && (
            <button
              onClick={stop}
              className="rounded-full bg-slate-800 px-3 py-1 hover:bg-slate-700 cursor-pointer"
            >
              Stop {!isFullscreen && '(Esc)'}
            </button>
          )}
          {isFullscreen && (
            <button
              onClick={toggleFullscreen}
              className="rounded-full bg-slate-800 px-3 py-1 hover:bg-slate-700"
            >
              Exit fullscreen (Esc)
            </button>
          )}
        </div>
      </div>

        {phase === "idle" && (
          <div className="flex flex-col items-center px-6 text-center">
            {/* Title */}
            <h2 className="text-4xl font-extrabold tracking-tight text-white sm:text-6xl">
              Flash Anzan
            </h2>

            {/* Key Stats (Automatically strips the redundant leading math symbols) */}
            <p className="mt-3 text-lg font-medium tracking-wide text-slate-300 sm:text-xl">
              {describeProfile({ ...profile, intervalMs: interval }).replace(/^[^·]+·\s*/, "")}
            </p>

            {/* Operation Pills */}
            <div className="mt-5 flex flex-wrap justify-center gap-2.5">
              {OPERATIONS.filter((o) => profile.operations.includes(o.id)).map((o) => (
                <span
                  key={o.id}
                  className="rounded-full border border-indigo-400/25 bg-indigo-500/15 px-4 py-1 text-sm font-semibold text-indigo-200 shadow-sm"
                >
                  {o.symbol} {o.label}
                </span>
              ))}
            </div>

            {/* Primary Call to Action */}
            <button
              onClick={startNew}
              className="mt-10 rounded-2xl bg-emerald-500 px-16 py-4 text-2xl font-extrabold text-slate-950 shadow-xl shadow-emerald-500/20 ring-1 ring-emerald-400 transition-all hover:bg-emerald-400 hover:shadow-emerald-400/30 active:scale-95 cursor-pointer"
            >
              {sessionDone && round > 0 ? "New session" : "Start"}
            </button>

            {/* Keyboard Shortcuts with Keycaps */}
            <div className="mt-12 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <kbd className="rounded border border-slate-700 bg-slate-800/80 px-2 py-0.5 font-sans text-[11px] font-semibold text-slate-300">
                  Space
                </kbd>
                <span>Start</span>
              </span>
              <span className="flex items-center gap-1.5">
                <kbd className="rounded border border-slate-700 bg-slate-800/80 px-2 py-0.5 font-sans text-[11px] font-semibold text-slate-300">
                  R
                </kbd>
                <span>Replay</span>
              </span>
              <span className="flex items-center gap-1.5">
                <kbd className="rounded border border-slate-700 bg-slate-800/80 px-2 py-0.5 font-sans text-[11px] font-semibold text-slate-300">
                  F
                </kbd>
                <span>Fullscreen</span>
              </span>
            </div>
          </div>
        )}

        {phase === "countdown" && (
          <div key={countText} className="animate-pulse text-[clamp(6rem,30vh,20rem)] font-black text-amber-300">
            {countText}
          </div>
        )}

        {phase === "flash" && (
          <>
            <div
              className="font-black tabular-nums leading-none tracking-tight"
              style={{ fontSize: flashSize, minHeight: flashSize }}
            >
              {shown ?? "\u00A0"}
            </div>
            <div className="absolute bottom-8 flex gap-2">
              {question?.steps.map((_, i) => (
                <span
                  key={i}
                  className={`h-2.5 w-2.5 rounded-full ${i < progress ? "bg-indigo-400" : "bg-slate-700"}`}
                />
              ))}
            </div>
          </>
        )}

        {phase === "answer" && (
          <div className="w-full max-w-xl px-6 text-center">
            <h2 className="text-4xl font-bold sm:text-5xl">What is the answer?</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                reveal();
              }}
              className="mt-8"
            >
              {/* <input
                ref={inputRef}
                value={typed}
                onChange={(e) => setTyped(e.target.value.replace(/[^0-9-−]/g, ""))}
                inputMode="numeric"
                placeholder="Type an answer (optional)"
                className="w-full rounded-2xl border-2 border-slate-700 bg-slate-900 px-6 py-5 text-center text-5xl font-bold tabular-nums text-white placeholder:text-lg placeholder:font-normal placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none"
              /> */}
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <button
                  type="submit"
                  className="rounded-xl bg-emerald-500 px-8 py-3 text-xl font-bold text-slate-950 hover:bg-emerald-400 cursor-pointer"
                >
                  Show answer
                </button>
                <button
                  type="button"
                  onClick={replay}
                  className="rounded-xl bg-slate-800 px-6 py-3 text-xl font-semibold hover:bg-slate-700 cursor-pointer"
                >
                  Replay (R)
                </button>
              </div>
            </form>
          </div>
        )}

        {phase === "result" && question && (
          <div className="w-full max-w-4xl px-6 text-center">
            {correct !== null && (
              <div
                className={`mb-2 text-2xl font-bold ${correct ? "text-emerald-400" : "text-rose-400"}`}
              >
                {correct ? "✓ Correct!" : `✗ You typed ${typed}`}
              </div>
            )}
            <div className="text-lg uppercase tracking-widest text-slate-400">The answer is</div>
            <div className="text-[clamp(5rem,22vh,14rem)] font-black leading-tight tabular-nums text-emerald-400">
              {formatNumber(question.answer)}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-2xl tabular-nums">
              {question.steps.map((s, i) => (
                <span key={i} className="rounded-lg bg-slate-800 px-3 py-1">
                  {stepText(s, question.showSigns)}
                </span>
              ))}
            </div>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <button
                onClick={startNew}
                className="rounded-xl bg-emerald-500 px-8 py-3 text-xl font-bold text-slate-950 hover:bg-emerald-400 cursor-pointer"
              >
                {sessionDone ? "New session" : "Next question"}
              </button>
              <button
                onClick={replay}
                className="rounded-xl bg-slate-800 px-6 py-3 text-xl font-semibold hover:bg-slate-700 cursor-pointer"
              >
                Replay same numbers (R)
              </button>
              <button
                onClick={stop}
                className="rounded-xl bg-slate-800 px-6 py-3 text-xl font-semibold hover:bg-slate-700 cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
