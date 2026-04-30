"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";

/* ─── Types ───────────────────────────────────────────────────────── */

interface StepTiming {
  step: string;
  label: string;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  durationLabel?: string;
}

interface PipelineTimings {
  pipelineStartedAt: string;
  pipelineCompletedAt?: string;
  totalDurationMs?: number;
  totalDurationLabel?: string;
  steps: StepTiming[];
}

interface JobStatus {
  jobId: string;
  status: string;
  progress: number;
  statusLabel: string;
  name: string;
  videoUrl: string | null;
  error: string | null;
  createdAt: string;
  elapsedMs: number;
  stepTimings: PipelineTimings | null;
}

/* ─── Helpers ─────────────────────────────────────────────────────── */

const STEPS = [
  { key: "face_swapping",    label: "Face Swap",         icon: "🎭", desc: "Swapping your face into the video" },
  { key: "audio_processing", label: "Audio Generation",  icon: "🎵", desc: "Adding your name to the voiceover" },
  { key: "merging",          label: "Final Render",      icon: "🔀", desc: "Merging video + audio & uploading" },
  { key: "done",             label: "Complete",          icon: "✓",  desc: "Your video is ready to watch!" },
];

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const rem = Math.round(s % 60);
  return `${m}m ${rem}s`;
}

function LiveTimer({ startTime }: { startTime: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(interval);
  }, []);
  const elapsed = now - new Date(startTime).getTime();
  return <span className="font-mono text-amber-400 tabular-nums">{formatDuration(elapsed)}</span>;
}

/* ─── Page ────────────────────────────────────────────────────────── */

export default function StatusPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const router = useRouter();
  const [job, setJob] = useState<JobStatus | null>(null);
  const [polling, setPolling] = useState(true);
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    if (!job?.createdAt || job.status === "done" || job.status === "error") return;
    const start = new Date(job.createdAt).getTime();
    const interval = setInterval(() => setElapsedMs(Date.now() - start), 100);
    return () => clearInterval(interval);
  }, [job?.createdAt, job?.status]);

  useEffect(() => {
    if (!polling) return;
    const poll = async () => {
      try {
        const res = await fetch(`/api/status/${jobId}`);
        if (!res.ok) return;
        const data: JobStatus = await res.json();
        setJob(data);
        if (data.status === "done") {
          setPolling(false);
          setElapsedMs(data.stepTimings?.totalDurationMs || data.elapsedMs);
          setTimeout(() => router.push(`/result/${jobId}`), 2500);
        } else if (data.status === "error") {
          setPolling(false);
          setElapsedMs(data.stepTimings?.totalDurationMs || data.elapsedMs);
        }
      } catch { /* retry */ }
    };
    poll();
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [jobId, polling, router]);

  const getStepTiming = useMemo(() => {
    return (stepKey: string): StepTiming | undefined => {
      return job?.stepTimings?.steps.find((s) => s.step === stepKey);
    };
  }, [job?.stepTimings]);

  const getStepIndex = (status: string) => STEPS.findIndex((s) => s.key === status);
  const currentIdx = getStepIndex(job?.status || "pending");

  return (
    <main className="relative flex min-h-screen items-center justify-center p-4">
      {/* Ambient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[400px] bg-gradient-to-b from-amber-500/8 via-orange-500/5 to-transparent rounded-full blur-3xl animate-pulse-glow pointer-events-none" />

      <div className="relative w-full max-w-lg space-y-8">

        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/5 px-4 py-1.5 text-sm text-amber-300/90 backdrop-blur-sm">
            <span className="relative flex h-2 w-2">
              {job?.status !== "done" && job?.status !== "error" && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
              )}
              <span className={`relative inline-flex h-2 w-2 rounded-full ${
                job?.status === "done" ? "bg-emerald-400" : job?.status === "error" ? "bg-red-400" : "bg-amber-400"
              }`} />
            </span>
            {job?.status === "done" ? "Pipeline Complete" : job?.status === "error" ? "Pipeline Failed" : "Processing..."}
          </div>

          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
            {job?.status === "done" ? (
              <span className="bg-gradient-to-r from-emerald-300 to-emerald-400 bg-clip-text text-transparent">Video Ready!</span>
            ) : job?.status === "error" ? (
              <span className="bg-gradient-to-r from-red-400 to-red-500 bg-clip-text text-transparent">Something Broke</span>
            ) : (
              <span className="bg-gradient-to-r from-amber-300 via-orange-400 to-red-400 bg-clip-text text-transparent animate-gradient">Creating Your Video</span>
            )}
          </h1>

          {job && (
            <p className="text-zinc-500">
              for <span className="text-zinc-300 font-medium">{job.name}</span>
            </p>
          )}
        </div>

        {/* Progress Card */}
        <div className="glass-strong rounded-2xl p-6 space-y-6">

          {/* Timer bar */}
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-zinc-500 uppercase tracking-wider font-medium">Elapsed Time</span>
            <span className="font-mono text-lg text-amber-400 tabular-nums font-semibold">
              {formatDuration(
                job?.status === "done" || job?.status === "error"
                  ? job.stepTimings?.totalDurationMs || elapsedMs
                  : elapsedMs
              )}
            </span>
          </div>

          {/* Progress bar */}
          <div className="space-y-2">
            <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 transition-all duration-700 ease-out"
                style={{ width: `${job?.progress || 0}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-zinc-500">{job?.statusLabel || "Initializing..."}</span>
              <span className="font-mono text-zinc-400">{job?.progress || 0}%</span>
            </div>
          </div>

          {/* Steps */}
          <div className="space-y-2">
            {STEPS.map((step, i) => {
              const isActive = job?.status === step.key;
              const isDone = i < currentIdx || (step.key === "done" && job?.status === "done");
              const timing = getStepTiming(step.key);

              return (
                <div
                  key={step.key}
                  className={`flex items-center gap-3 rounded-xl p-3 transition-all ${
                    isActive
                      ? "bg-amber-500/[0.07] ring-1 ring-amber-500/20"
                      : isDone
                      ? "bg-emerald-500/[0.04]"
                      : "opacity-40"
                  }`}
                >
                  {/* Step indicator */}
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold transition-all ${
                    isDone
                      ? "bg-emerald-500/15 text-emerald-400"
                      : isActive
                      ? "bg-amber-500/15 text-amber-400"
                      : "bg-zinc-800/60 text-zinc-600"
                  }`}>
                    {isDone ? "✓" : step.icon}
                  </div>

                  {/* Label */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${
                      isActive ? "text-amber-300" : isDone ? "text-emerald-300/90" : "text-zinc-600"
                    }`}>
                      {step.label}
                    </p>
                    {isActive && <p className="text-[11px] text-zinc-500 mt-0.5">{step.desc}</p>}
                  </div>

                  {/* Timing */}
                  <div className="shrink-0">
                    {isDone && timing?.durationLabel && (
                      <span className="font-mono text-[11px] text-emerald-400/70 bg-emerald-500/10 px-2 py-1 rounded-md">
                        {timing.durationLabel}
                      </span>
                    )}
                    {isActive && timing && (
                      <div className="flex items-center gap-2">
                        <span className="text-[11px]"><LiveTimer startTime={timing.startedAt} /></span>
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-[1.5px] border-amber-500/25 border-t-amber-400" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Error detail */}
          {job?.status === "error" && (
            <div className="rounded-xl border border-red-500/15 bg-red-500/5 p-4 space-y-1">
              <p className="text-xs font-medium text-red-400">Error Details</p>
              <p className="text-[11px] text-red-400/70 leading-relaxed break-all">{job.error}</p>
            </div>
          )}

          {/* Done banner */}
          {job?.status === "done" && (
            <div className="rounded-xl bg-gradient-to-r from-emerald-500/10 to-emerald-500/5 border border-emerald-500/15 p-4 flex items-center justify-between">
              <span className="text-sm text-emerald-300 font-medium">Redirecting to your video...</span>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-500/25 border-t-emerald-400" />
            </div>
          )}
        </div>

        {/* Tip */}
        {job?.status !== "done" && job?.status !== "error" && (
          <p className="text-center text-[11px] text-zinc-600">
            Typically takes 2-4 minutes. Don&apos;t close this tab.
          </p>
        )}
      </div>
    </main>
  );
}
