"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";

interface JobResult {
  jobId: string; status: string; name: string; videoUrl: string | null;
  stepTimings: { totalDurationLabel?: string; steps?: { label: string; durationLabel?: string; durationMs?: number }[]; totalDurationMs?: number; } | null;
}

export default function ResultPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const [job, setJob] = useState<JobResult | null>(null);

  useEffect(() => { fetch(`/api/status/${jobId}`).then(r => r.json()).then(setJob).catch(console.error); }, [jobId]);

  if (!job || job.status !== "done" || !job.videoUrl) {
    return (
      <main className="flex min-h-screen items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="h-10 w-10 mx-auto animate-spin rounded-full border-2 border-amber-200 border-t-amber-500" />
          <p className="text-sm text-zinc-400">Loading your video...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center p-4">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-gradient-to-b from-emerald-400/6 via-amber-400/4 to-transparent rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-2xl space-y-8">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/40 bg-emerald-50 px-4 py-1.5 text-sm text-emerald-700">
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            Generated{job.stepTimings?.totalDurationLabel ? ` in ${job.stepTimings.totalDurationLabel}` : ""}
          </div>

          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
            <span className="bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 bg-clip-text text-transparent">Your Video is Ready!</span>
          </h1>
          <p className="text-zinc-500">Here&apos;s your personalized Daawat ad, <span className="text-amber-600 font-medium">{job.name}</span></p>
        </div>

        <div className="glass-strong rounded-2xl overflow-hidden">
          <video src={job.videoUrl} controls autoPlay playsInline className="w-full aspect-video bg-zinc-100" />
          <div className="p-4 sm:p-5 flex flex-col sm:flex-row gap-3">
            <a href={job.videoUrl} download={`daawat_${job.name}.mp4`}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 text-white font-semibold shadow-lg shadow-amber-500/15 hover:shadow-amber-500/25 hover:brightness-110 h-12 px-6 text-sm transition-all">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Download Video
            </a>
            <Button variant="outline"
              className="h-12 rounded-xl border-zinc-200 text-zinc-700 hover:bg-zinc-50 hover:border-zinc-300 px-6"
              onClick={() => {
                if (navigator.share) { navigator.share({ title: `${job.name}'s Daawat Video`, text: "Check out my personalized Daawat ad!", url: window.location.href }); }
                else { navigator.clipboard.writeText(window.location.href); }
              }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
              Share
            </Button>
          </div>
        </div>

        {job.stepTimings?.steps && job.stepTimings.steps.length > 0 && (
          <div className="glass rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">Pipeline Performance</span>
              <span className="font-mono text-sm text-amber-600 font-semibold">{job.stepTimings.totalDurationLabel}</span>
            </div>
            <div className="flex gap-1 h-2 rounded-full overflow-hidden bg-zinc-200">
              {job.stepTimings.steps.map((step, i) => {
                const pct = step.durationMs && job.stepTimings?.totalDurationMs ? (step.durationMs / job.stepTimings.totalDurationMs) * 100 : 33;
                const colors = ["from-amber-400 to-orange-400", "from-sky-400 to-blue-400", "from-violet-400 to-purple-400"];
                return <div key={i} className={`h-full bg-gradient-to-r ${colors[i % colors.length]}`} style={{ width: `${Math.max(5, pct)}%` }} title={`${step.label}: ${step.durationLabel || "—"}`} />;
              })}
            </div>
            <div className="flex justify-between mt-2">
              {job.stepTimings.steps.map((step, i) => <span key={i} className="text-[10px] text-zinc-400">{step.label}</span>)}
            </div>
          </div>
        )}

        <div className="text-center">
          <button className="text-sm text-zinc-400 hover:text-amber-600 transition-colors" onClick={() => (window.location.href = "/")}>← Create another video</button>
        </div>
      </div>
    </main>
  );
}
