"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/* ─── Types ───────────────────────────────────────────────────────── */

interface StepTiming {
  step: string;
  label: string;
  durationMs?: number;
  durationLabel?: string;
}

interface PipelineTimings {
  totalDurationMs?: number;
  totalDurationLabel?: string;
  steps: StepTiming[];
}

interface JobRecord {
  id: string;
  userName: string;
  userPhone: string;
  status: string;
  progress: number;
  runpodJobId: string | null;
  errorMessage: string | null;
  stepTimings: PipelineTimings | null;
  createdAt: string;
  updatedAt: string;
  finalVideoUrl: string | null;
}

interface JobsResponse {
  jobs: JobRecord[];
  total: number;
  stats: {
    total: number;
    completed: number;
    failed: number;
    inProgress: number;
    avgDurationMs: number;
  };
}

/* ─── Helpers ─────────────────────────────────────────────────────── */

const STATUS_MAP: Record<string, { label: string; color: string; dotColor: string; icon: string }> = {
  pending:          { label: "Queued",     color: "text-zinc-400",    dotColor: "bg-zinc-400",    icon: "⏳" },
  face_swapping:    { label: "Face Swap",  color: "text-amber-400",   dotColor: "bg-amber-400",   icon: "🎭" },
  audio_processing: { label: "Audio",      color: "text-sky-400",     dotColor: "bg-sky-400",     icon: "🎵" },
  merging:          { label: "Merging",    color: "text-violet-400",  dotColor: "bg-violet-400",  icon: "🔀" },
  done:             { label: "Complete",   color: "text-emerald-400", dotColor: "bg-emerald-400", icon: "✓"  },
  error:            { label: "Failed",     color: "text-red-400",     dotColor: "bg-red-400",     icon: "✕"  },
};

function formatDuration(ms: number): string {
  if (ms <= 0) return "—";
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const rem = Math.round(s % 60);
  return `${m}m ${rem}s`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

/* ─── Main Page ───────────────────────────────────────────────────── */

export default function HomePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [selfie, setSelfie] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const [jobsData, setJobsData] = useState<JobsResponse | null>(null);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch("/api/jobs?limit=50");
      if (res.ok) setJobsData(await res.json());
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 10000);
    return () => clearInterval(interval);
  }, [fetchJobs]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelfie(file);
      setPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim() || !phone.trim() || !selfie) {
      setError("Please fill all fields and upload your selfie.");
      return;
    }
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("name", name.trim());
      formData.append("phone", phone.trim());
      formData.append("selfie", selfie);
      const res = await fetch("/api/submit", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Something went wrong"); return; }
      router.push(`/status/${data.jobId}`);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { num: "01", title: "Upload Selfie", desc: "A clear photo of your face" },
    { num: "02", title: "AI Face Swap", desc: "Your face in a Daawat ad" },
    { num: "03", title: "Personalized Audio", desc: "Your name in the voiceover" },
  ];

  return (
    <main className="relative min-h-screen overflow-hidden">

      {/* ─── Hero Section ─────────────────────────────────────────── */}
      <section className="relative px-4 pt-12 pb-16 sm:pt-20 sm:pb-24">
        {/* Ambient glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-gradient-to-b from-amber-500/10 via-orange-500/5 to-transparent rounded-full blur-3xl animate-pulse-glow pointer-events-none" />

        <div className="relative mx-auto max-w-4xl text-center space-y-6">
          {/* Badge */}
          <div className="inline-flex items-center gap-2.5 rounded-full border border-amber-500/20 bg-amber-500/5 px-5 py-2 text-sm text-amber-300/90 backdrop-blur-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
            </span>
            World Biryani Day 2026 — Limited Campaign
          </div>

          {/* Headline */}
          <h1 className="text-5xl sm:text-7xl font-bold tracking-tight leading-[1.1]">
            <span className="text-white">Star in Your</span>
            <br />
            <span className="bg-gradient-to-r from-amber-300 via-orange-400 to-red-400 bg-clip-text text-transparent animate-gradient">
              Own Daawat Ad
            </span>
          </h1>

          {/* Subheadline */}
          <p className="mx-auto max-w-xl text-lg sm:text-xl text-zinc-400 leading-relaxed">
            Upload a selfie, enter your name — our AI puts <em className="text-zinc-300 not-italic font-medium">you</em> in
            a premium Daawat Biryani commercial in under 3 minutes.
          </p>

          {/* How it works */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-0 pt-4">
            {steps.map((step, i) => (
              <div key={step.num} className="flex items-center gap-3 sm:gap-0">
                <div className="flex items-center gap-3 group">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/15 to-orange-500/10 border border-amber-500/10 text-amber-400 text-xs font-bold group-hover:from-amber-500/25 group-hover:to-orange-500/20 transition-all">
                    {step.num}
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-zinc-200">{step.title}</p>
                    <p className="text-xs text-zinc-500">{step.desc}</p>
                  </div>
                </div>
                {i < steps.length - 1 && (
                  <div className="hidden sm:block w-12 mx-4 h-px bg-gradient-to-r from-zinc-700 to-zinc-800" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Form Section ─────────────────────────────────────────── */}
      <section className="relative px-4 pb-20">
        <div className="mx-auto max-w-md">
          <div className="glass-strong rounded-2xl p-6 sm:p-8 shadow-2xl shadow-black/40">
            {/* Form header */}
            <div className="mb-6 space-y-1">
              <h2 className="text-xl font-bold text-white">Create Your Video</h2>
              <p className="text-sm text-zinc-500">Takes ~3 minutes to generate</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Name */}
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Your Name</Label>
                <Input
                  id="name"
                  placeholder="e.g. Suhail Ahmed"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-12 rounded-xl border-zinc-800 bg-zinc-900/80 text-white placeholder:text-zinc-600 focus-visible:ring-amber-500/50 focus-visible:border-amber-500/30 transition-all"
                />
              </div>

              {/* Phone */}
              <div className="space-y-1.5">
                <Label htmlFor="phone" className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="h-12 rounded-xl border-zinc-800 bg-zinc-900/80 text-white placeholder:text-zinc-600 focus-visible:ring-amber-500/50 focus-visible:border-amber-500/30 transition-all"
                />
              </div>

              {/* Selfie Upload */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Your Selfie</Label>
                <div
                  onClick={() => fileRef.current?.click()}
                  className="group relative cursor-pointer rounded-xl border border-dashed border-zinc-700/80 bg-zinc-900/50 p-5 text-center transition-all hover:border-amber-500/40 hover:bg-zinc-900/80 hover:shadow-lg hover:shadow-amber-500/5"
                >
                  {preview ? (
                    <div className="flex items-center gap-4">
                      <img
                        src={preview}
                        alt="Selfie preview"
                        className="h-16 w-16 rounded-xl object-cover ring-2 ring-amber-500/30"
                      />
                      <div className="text-left">
                        <p className="text-sm font-medium text-zinc-300">{selfie?.name}</p>
                        <p className="text-xs text-zinc-500">Click to change</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2 py-2">
                      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-800 text-xl group-hover:bg-amber-500/10 group-hover:text-amber-400 transition-all">
                        📸
                      </div>
                      <p className="text-sm text-zinc-400 group-hover:text-zinc-300 transition-colors">
                        Upload a clear selfie
                      </p>
                      <p className="text-[11px] text-zinc-600">PNG, JPG, WebP — Max 10MB</p>
                    </div>
                  )}
                  <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleFileChange} className="hidden" />
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-400 flex items-start gap-2">
                  <span className="shrink-0 mt-0.5">⚠</span>
                  <span>{error}</span>
                </div>
              )}

              {/* Submit */}
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 text-white font-semibold text-base shadow-xl shadow-amber-500/15 hover:shadow-amber-500/30 hover:brightness-110 disabled:opacity-50 transition-all cursor-pointer"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Processing...
                  </span>
                ) : (
                  "Create My Video →"
                )}
              </Button>
            </form>

            <p className="mt-4 text-center text-[11px] text-zinc-600">
              By submitting, you consent to your image being used in a personalized video.
            </p>
          </div>
        </div>
      </section>

      {/* ─── Job History Section ───────────────────────────────────── */}
      {jobsData && jobsData.total > 0 && (
        <section className="px-4 pb-24">
          <div className="mx-auto max-w-5xl space-y-6">

            {/* Section header */}
            <div className="flex items-end justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white">Pipeline Monitor</h2>
                <p className="text-sm text-zinc-500 mt-1">Real-time job tracking &amp; performance metrics</p>
              </div>
              <button onClick={fetchJobs} className="text-xs text-zinc-500 hover:text-amber-400 transition-colors px-3 py-1.5 rounded-lg hover:bg-amber-500/5">
                ↻ Refresh
              </button>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <MetricCard label="Total Jobs" value={jobsData.stats.total} />
              <MetricCard label="Completed" value={jobsData.stats.completed} accent="emerald" />
              <MetricCard label="Failed" value={jobsData.stats.failed} accent="red" />
              <MetricCard label="Avg Duration" value={jobsData.stats.avgDurationMs > 0 ? formatDuration(jobsData.stats.avgDurationMs) : "—"} accent="amber" isText />
            </div>

            {/* Jobs List */}
            <div className="glass rounded-2xl overflow-hidden">
              {/* Table header */}
              <div className="hidden sm:grid grid-cols-[1fr_120px_100px_100px_80px] gap-2 px-5 py-3 border-b border-white/5 text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                <span>User</span>
                <span>Status</span>
                <span>Duration</span>
                <span>Created</span>
                <span className="text-right">Details</span>
              </div>

              {/* Rows */}
              <div className="divide-y divide-white/[0.03]">
                {jobsData.jobs.map((job) => {
                  const s = STATUS_MAP[job.status] || STATUS_MAP.pending;
                  const isExpanded = expandedJob === job.id;
                  return (
                    <JobRow key={job.id} job={job} statusInfo={s} isExpanded={isExpanded}
                      onToggle={() => setExpandedJob(isExpanded ? null : job.id)} />
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}

/* ─── Metric Card ─────────────────────────────────────────────────── */

function MetricCard({ label, value, accent, isText }: {
  label: string; value: number | string; accent?: string; isText?: boolean;
}) {
  const colorMap: Record<string, string> = {
    emerald: "text-emerald-400",
    red: "text-red-400",
    amber: "text-amber-400",
  };
  const valueColor = accent ? colorMap[accent] || "text-white" : "text-white";

  return (
    <div className="glass rounded-xl p-4 space-y-1.5">
      <p className="text-[11px] text-zinc-500 uppercase tracking-wider font-medium">{label}</p>
      <p className={`${isText ? "text-lg" : "text-2xl"} font-bold ${valueColor} font-mono tabular-nums leading-none`}>
        {value}
      </p>
    </div>
  );
}

/* ─── Job Row ─────────────────────────────────────────────────────── */

function JobRow({ job, statusInfo, isExpanded, onToggle }: {
  job: JobRecord;
  statusInfo: { label: string; color: string; dotColor: string; icon: string };
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const timings = job.stepTimings;
  const isActive = ["pending", "face_swapping", "audio_processing", "merging"].includes(job.status);

  return (
    <>
      <div
        className={`grid grid-cols-1 sm:grid-cols-[1fr_120px_100px_100px_80px] gap-2 sm:gap-2 items-center px-5 py-3.5 cursor-pointer transition-colors hover:bg-white/[0.02] ${isExpanded ? "bg-white/[0.02]" : ""}`}
        onClick={onToggle}
      >
        {/* User */}
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/15 flex items-center justify-center text-amber-400 text-sm font-bold shrink-0 ring-1 ring-amber-500/10">
            {job.userName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-zinc-200 truncate">{job.userName}</p>
            <p className="text-[11px] text-zinc-600 truncate">{job.userPhone}</p>
          </div>
        </div>

        {/* Status */}
        <div className="flex items-center gap-2">
          <span className={`relative h-2 w-2 rounded-full ${statusInfo.dotColor}`}>
            {isActive && <span className={`absolute inset-0 rounded-full ${statusInfo.dotColor} animate-ping opacity-60`} />}
          </span>
          <span className={`text-xs font-medium ${statusInfo.color}`}>
            {statusInfo.label}
          </span>
        </div>

        {/* Duration */}
        <span className="text-xs font-mono text-zinc-500">
          {timings?.totalDurationLabel || (isActive ? "..." : "—")}
        </span>

        {/* Created */}
        <span className="text-[11px] text-zinc-600" title={new Date(job.createdAt).toLocaleString()}>
          {timeAgo(job.createdAt)}
        </span>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2">
          {job.status === "done" && job.finalVideoUrl && (
            <a href={job.finalVideoUrl} target="_blank" rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-[11px] font-medium text-emerald-400 hover:text-emerald-300 transition-colors">
              ▶ Play
            </a>
          )}
          {isActive && (
            <a href={`/status/${job.id}`} onClick={(e) => e.stopPropagation()}
              className="text-[11px] font-medium text-amber-400 hover:text-amber-300 transition-colors">
              Track →
            </a>
          )}
          <span className={`text-zinc-600 text-[10px] transition-transform ${isExpanded ? "rotate-180" : ""}`}>▾</span>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="px-5 pb-5 pt-2 bg-white/[0.01]">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 rounded-xl border border-white/[0.04] bg-zinc-900/50 p-4">
            {/* Info */}
            <div className="space-y-3">
              <h4 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Job Info</h4>
              <div className="space-y-2 text-xs">
                <InfoRow label="Job ID" value={job.id} mono />
                <InfoRow label="RunPod ID" value={job.runpodJobId || "—"} mono />
                <InfoRow label="Progress" value={`${job.progress}%`} />
                <InfoRow label="Created" value={new Date(job.createdAt).toLocaleString()} />
                <InfoRow label="Updated" value={new Date(job.updatedAt).toLocaleString()} />
              </div>
              {job.errorMessage && (
                <div className="rounded-lg border border-red-500/15 bg-red-500/5 p-2.5 text-[11px] text-red-400 break-all leading-relaxed">
                  {job.errorMessage}
                </div>
              )}
            </div>

            {/* Step Timings */}
            <div className="space-y-3">
              <h4 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Step Timings</h4>
              {timings?.steps && timings.steps.length > 0 ? (
                <div className="space-y-2">
                  {timings.steps.map((step, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="text-zinc-400">{step.label}</span>
                      <div className="flex items-center gap-2">
                        {step.durationMs && (
                          <div className="h-1.5 rounded-full bg-zinc-800 w-16 overflow-hidden">
                            <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500"
                              style={{ width: `${Math.min(100, (step.durationMs / (timings.totalDurationMs || 1)) * 100)}%` }} />
                          </div>
                        )}
                        <span className={`font-mono text-[11px] w-14 text-right ${step.durationLabel ? "text-emerald-400/80" : "text-zinc-700"}`}>
                          {step.durationLabel || "—"}
                        </span>
                      </div>
                    </div>
                  ))}
                  {timings.totalDurationLabel && (
                    <div className="flex items-center justify-between text-xs pt-2 mt-2 border-t border-white/[0.04]">
                      <span className="text-zinc-300 font-medium">Total Pipeline</span>
                      <span className="font-mono text-amber-400 font-semibold">{timings.totalDurationLabel}</span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-zinc-700">No timing data yet</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ─── Info Row ─────────────────────────────────────────────────────── */

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-zinc-500 shrink-0">{label}</span>
      <span className={`text-zinc-300 truncate ${mono ? "font-mono text-[11px]" : ""}`}>{value}</span>
    </div>
  );
}
