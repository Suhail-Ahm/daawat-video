"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

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

const STEP_CONFIG = [
  { key: "face_swapping", label: "Face Swap", icon: "🎭", threshold: 10 },
  { key: "audio_processing", label: "Audio", icon: "🎵", threshold: 65 },
  { key: "merging", label: "Merge & Upload", icon: "🔀", threshold: 85 },
  { key: "done", label: "Done", icon: "🎉", threshold: 100 },
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
  return (
    <span className="font-mono text-amber-400 tabular-nums text-xs">
      {formatDuration(elapsed)}
    </span>
  );
}

export default function StatusPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const router = useRouter();
  const [job, setJob] = useState<JobStatus | null>(null);
  const [polling, setPolling] = useState(true);
  const [elapsedMs, setElapsedMs] = useState(0);

  // Live elapsed timer
  useEffect(() => {
    if (!job?.createdAt || job.status === "done" || job.status === "error") return;
    const start = new Date(job.createdAt).getTime();
    const interval = setInterval(() => {
      setElapsedMs(Date.now() - start);
    }, 100);
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
      } catch {
        /* retry on next interval */
      }
    };

    poll();
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [jobId, polling, router]);

  // Find the timing for a given step key
  const getStepTiming = useMemo(() => {
    return (stepKey: string): StepTiming | undefined => {
      return job?.stepTimings?.steps.find((s) => s.step === stepKey);
    };
  }, [job?.stepTimings]);

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-white">
            {job?.status === "done" ? "🎉" : job?.status === "error" ? "❌" : "⚡"}{" "}
            <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
              {job?.status === "done" ? "Video Ready!" : job?.status === "error" ? "Pipeline Failed" : "Creating Your Video"}
            </span>
          </h1>
          {job && (
            <p className="text-zinc-400">
              Hey <span className="text-amber-400 font-medium">{job.name}</span>, {job.statusLabel?.toLowerCase()}
            </p>
          )}
        </div>

        {/* Progress Card */}
        <Card className="border-zinc-800 bg-zinc-900/80 backdrop-blur-sm shadow-2xl">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-white text-lg">Pipeline Progress</CardTitle>
              {/* Live elapsed clock */}
              <div className="flex items-center gap-1.5 rounded-full bg-zinc-800 px-3 py-1">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Elapsed</span>
                <span className="font-mono text-sm text-amber-400 tabular-nums">
                  {formatDuration(
                    job?.status === "done" || job?.status === "error"
                      ? job.stepTimings?.totalDurationMs || elapsedMs
                      : elapsedMs
                  )}
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">{job?.statusLabel || "Initializing..."}</span>
                <span className="text-amber-400 font-mono">{job?.progress || 0}%</span>
              </div>
              <Progress value={job?.progress || 0} className="h-2" />
            </div>

            {/* Step Tracker with Timings */}
            <div className="space-y-2.5">
              {STEP_CONFIG.map((step, i) => {
                const progress = job?.progress || 0;
                const isActive = job?.status === step.key;
                const isDone = progress >= step.threshold && !isActive && step.key !== "done"
                  ? true
                  : step.key === "done" && job?.status === "done";
                const timing = getStepTiming(step.key);

                return (
                  <div
                    key={step.key}
                    className={`flex items-center gap-3 rounded-lg border p-3 transition-all ${
                      isActive
                        ? "border-amber-500/50 bg-amber-500/10"
                        : isDone
                        ? "border-emerald-500/30 bg-emerald-500/5"
                        : "border-zinc-800 bg-zinc-800/30"
                    }`}
                  >
                    <span className="text-xl w-7 text-center">
                      {isDone ? "✅" : isActive ? step.icon : "⬜"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${
                        isActive ? "text-amber-400" : isDone ? "text-emerald-400" : "text-zinc-500"
                      }`}>
                        Step {i + 1}: {step.label}
                      </p>
                    </div>

                    {/* Timing display */}
                    <div className="flex items-center gap-2 shrink-0">
                      {isDone && timing?.durationLabel && (
                        <span className="font-mono text-xs text-emerald-400/80 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                          {timing.durationLabel}
                        </span>
                      )}
                      {isActive && timing && (
                        <div className="flex items-center gap-1.5">
                          <LiveTimer startTime={timing.startedAt} />
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-amber-500/30 border-t-amber-500" />
                        </div>
                      )}
                      {isDone && step.key === "done" && job?.stepTimings?.totalDurationLabel && (
                        <span className="font-mono text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full font-semibold">
                          Total: {job.stepTimings.totalDurationLabel}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Error State */}
            {job?.status === "error" && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
                <p className="font-medium">Something went wrong</p>
                <p className="mt-1 text-red-500/80">{job.error}</p>
                {job.stepTimings && (
                  <div className="mt-3 pt-3 border-t border-red-500/20">
                    <p className="text-xs text-red-400/60">
                      Failed after {job.stepTimings.totalDurationLabel} at step: {
                        job.stepTimings.steps[job.stepTimings.steps.length - 1]?.label || "unknown"
                      }
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Done summary */}
            {job?.status === "done" && job.stepTimings && (
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-emerald-400/70">Pipeline completed successfully</span>
                  <span className="font-mono text-sm text-emerald-400 font-semibold">
                    {job.stepTimings.totalDurationLabel}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tip */}
        {job?.status !== "done" && job?.status !== "error" && (
          <p className="text-center text-sm text-zinc-500">
            ⏱️ This usually takes 2-4 minutes. Don&apos;t close this page!
          </p>
        )}
      </div>
    </main>
  );
}
