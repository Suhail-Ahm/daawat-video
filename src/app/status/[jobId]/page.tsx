"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";

interface StepTiming { step: string; label: string; startedAt: string; completedAt?: string; durationMs?: number; durationLabel?: string; }
interface PipelineTimings { pipelineStartedAt: string; pipelineCompletedAt?: string; totalDurationMs?: number; totalDurationLabel?: string; steps: StepTiming[]; }
interface JobStatus { jobId: string; status: string; progress: number; statusLabel: string; name: string; videoUrl: string | null; error: string | null; createdAt: string; elapsedMs: number; stepTimings: PipelineTimings | null; }

const STEPS = [
  { key: "face_swapping",    label: "Face Swap",        icon: "🎭", desc: "Swapping your face into the video" },
  { key: "audio_processing", label: "Audio Generation", icon: "🎵", desc: "Adding your name to the voiceover" },
  { key: "merging",          label: "Final Render",     icon: "🔀", desc: "Merging video + audio & uploading" },
  { key: "done",             label: "Complete",         icon: "✓",  desc: "Your video is ready to watch!" },
];

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${Math.round(s % 60)}s`;
}

function LiveTimer({ startTime }: { startTime: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 100); return () => clearInterval(i); }, []);
  return <span className="font-mono text-[#002e82] tabular-nums">{formatDuration(now - new Date(startTime).getTime())}</span>;
}

export default function StatusPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const router = useRouter();
  const [job, setJob] = useState<JobStatus | null>(null);
  const [polling, setPolling] = useState(true);
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    if (!job?.createdAt || job.status === "done" || job.status === "error") return;
    const start = new Date(job.createdAt).getTime();
    const i = setInterval(() => setElapsedMs(Date.now() - start), 100);
    return () => clearInterval(i);
  }, [job?.createdAt, job?.status]);

  useEffect(() => {
    if (!polling) return;
    const poll = async () => {
      try {
        const res = await fetch(`/api/status/${jobId}`); if (!res.ok) return;
        const data: JobStatus = await res.json(); setJob(data);
        if (data.status === "done") { setPolling(false); setElapsedMs(data.stepTimings?.totalDurationMs || data.elapsedMs); setTimeout(() => router.push(`/result/${jobId}`), 2500); }
        else if (data.status === "error") { setPolling(false); setElapsedMs(data.stepTimings?.totalDurationMs || data.elapsedMs); }
      } catch {}
    };
    poll();
    const i = setInterval(poll, 3000);
    return () => clearInterval(i);
  }, [jobId, polling, router]);

  const getStepTiming = useMemo(() => (key: string) => job?.stepTimings?.steps.find((s) => s.step === key), [job?.stepTimings]);
  const currentIdx = STEPS.findIndex((s) => s.key === (job?.status || "pending"));

  return (
    <main className="relative flex min-h-screen items-center justify-center p-4">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[400px] bg-gradient-to-b from-[#e4b573]/8 via-[#002e82]/4 to-transparent rounded-full blur-3xl animate-pulse-glow pointer-events-none" />

      <div className="relative w-full max-w-lg space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#e4b573]/30 bg-[#f0ebe0] px-4 py-1.5 text-sm text-[#002e82]">
            <span className="relative flex h-2 w-2">
              {job?.status !== "done" && job?.status !== "error" && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#e4b573] opacity-75" />}
              <span className={`relative inline-flex h-2 w-2 rounded-full ${job?.status === "done" ? "bg-emerald-500" : job?.status === "error" ? "bg-red-500" : "bg-[#e4b573]"}`} />
            </span>
            {job?.status === "done" ? "Pipeline Complete" : job?.status === "error" ? "Pipeline Failed" : "Processing..."}
          </div>

          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
            {job?.status === "done" ? (
              <span className="bg-gradient-to-r from-emerald-500 to-emerald-600 bg-clip-text text-transparent">Video Ready!</span>
            ) : job?.status === "error" ? (
              <span className="bg-gradient-to-r from-red-500 to-red-600 bg-clip-text text-transparent">Something Broke</span>
            ) : (
              <span className="bg-gradient-to-r from-[#002e82] via-[#1a4a99] to-[#e4b573] bg-clip-text text-transparent animate-gradient">Creating Your Video</span>
            )}
          </h1>

          {job && <p className="text-zinc-500">for <span className="text-zinc-800 font-medium">{job.name}</span></p>}
        </div>

        {/* Progress Card */}
        <div className="glass-strong rounded-2xl p-6 space-y-6">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-zinc-400 uppercase tracking-wider font-medium">Elapsed Time</span>
            <span className="font-mono text-lg text-[#002e82] tabular-nums font-semibold">
              {formatDuration(job?.status === "done" || job?.status === "error" ? job.stepTimings?.totalDurationMs || elapsedMs : elapsedMs)}
            </span>
          </div>

          <div className="space-y-2">
            <div className="h-1.5 rounded-full bg-zinc-200 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-[#002e82] via-[#1a4a99] to-[#e4b573] transition-all duration-700 ease-out" style={{ width: `${job?.progress || 0}%` }} />
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-zinc-500">{job?.statusLabel || "Initializing..."}</span>
              <span className="font-mono text-zinc-400">{job?.progress || 0}%</span>
            </div>
          </div>

          <div className="space-y-2">
            {STEPS.map((step, i) => {
              const isActive = job?.status === step.key;
              const isDone = i < currentIdx || (step.key === "done" && job?.status === "done");
              const timing = getStepTiming(step.key);
              return (
                <div key={step.key} className={`flex items-center gap-3 rounded-xl p-3 transition-all ${isActive ? "bg-[#f0ebe0] ring-1 ring-amber-300/40" : isDone ? "bg-emerald-50/50" : "opacity-40"}`}>
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold transition-all ${isDone ? "bg-emerald-100 text-emerald-600" : isActive ? "bg-[#f0ebe0] text-[#002e82]" : "bg-zinc-100 text-zinc-400"}`}>
                    {isDone ? "✓" : step.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${isActive ? "text-amber-700" : isDone ? "text-emerald-700" : "text-zinc-400"}`}>{step.label}</p>
                    {isActive && <p className="text-[11px] text-zinc-400 mt-0.5">{step.desc}</p>}
                  </div>
                  <div className="shrink-0">
                    {isDone && timing?.durationLabel && <span className="font-mono text-[11px] text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md">{timing.durationLabel}</span>}
                    {isActive && timing && (
                      <div className="flex items-center gap-2">
                        <span className="text-[11px]"><LiveTimer startTime={timing.startedAt} /></span>
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-[1.5px] border-[#e4b573] border-t-[#002e82]" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {job?.status === "error" && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-1">
              <p className="text-xs font-medium text-red-600">Error Details</p>
              <p className="text-[11px] text-red-500 leading-relaxed break-all">{job.error}</p>
            </div>
          )}

          {job?.status === "done" && (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 flex items-center justify-between">
              <span className="text-sm text-emerald-700 font-medium">Redirecting to your video...</span>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-300 border-t-emerald-600" />
            </div>
          )}
        </div>

        {job?.status !== "done" && job?.status !== "error" && (
          <p className="text-center text-[11px] text-zinc-400">Typically takes 2-4 minutes. Don&apos;t close this tab.</p>
        )}
      </div>
    </main>
  );
}
