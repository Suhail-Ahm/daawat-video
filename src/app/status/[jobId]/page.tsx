"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface JobStatus {
  jobId: string;
  status: string;
  progress: number;
  statusLabel: string;
  name: string;
  videoUrl: string | null;
  error: string | null;
}

const STEP_ICONS: Record<string, string> = {
  pending: "⏳",
  face_swapping: "🎭",
  audio_processing: "🎵",
  merging: "🔀",
  done: "🎉",
  error: "❌",
};

export default function StatusPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const router = useRouter();
  const [job, setJob] = useState<JobStatus | null>(null);
  const [polling, setPolling] = useState(true);

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
          setTimeout(() => router.push(`/result/${jobId}`), 1500);
        } else if (data.status === "error") {
          setPolling(false);
        }
      } catch {
        /* retry on next interval */
      }
    };

    poll();
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [jobId, polling, router]);

  const steps = [
    { key: "face_swapping", label: "Face Swap", icon: "🎭", threshold: 10 },
    { key: "audio_processing", label: "Audio", icon: "🎵", threshold: 65 },
    { key: "merging", label: "Merge", icon: "🔀", threshold: 85 },
    { key: "done", label: "Done", icon: "🎉", threshold: 100 },
  ];

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-white">
            {STEP_ICONS[job?.status || "pending"]}{" "}
            <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
              {job?.status === "done" ? "Video Ready!" : "Creating Your Video"}
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
          <CardHeader>
            <CardTitle className="text-white text-lg">Pipeline Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">{job?.statusLabel || "Initializing..."}</span>
                <span className="text-amber-400 font-mono">{job?.progress || 0}%</span>
              </div>
              <Progress value={job?.progress || 0} className="h-2" />
            </div>

            {/* Step Tracker */}
            <div className="space-y-3">
              {steps.map((step, i) => {
                const progress = job?.progress || 0;
                const isActive = job?.status === step.key;
                const isDone = progress >= step.threshold && !isActive && step.key !== "done"
                  ? true
                  : step.key === "done" && job?.status === "done";
                const isPending = !isActive && !isDone;

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
                    <span className="text-xl">
                      {isDone ? "✅" : isActive ? step.icon : "⬜"}
                    </span>
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${
                        isActive ? "text-amber-400" : isDone ? "text-emerald-400" : "text-zinc-500"
                      }`}>
                        Step {i + 1}: {step.label}
                      </p>
                    </div>
                    {isActive && (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-amber-500/30 border-t-amber-500" />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Error State */}
            {job?.status === "error" && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
                <p className="font-medium">Something went wrong</p>
                <p className="mt-1 text-red-500/80">{job.error}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tip */}
        <p className="text-center text-sm text-zinc-500">
          ⏱️ This usually takes 3-5 minutes. Don&apos;t close this page!
        </p>
      </div>
    </main>
  );
}
