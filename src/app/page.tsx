"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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

const STATUS_MAP: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  pending:          { label: "Pending",    color: "text-zinc-400",   bg: "bg-zinc-500/10",   icon: "⏳" },
  face_swapping:    { label: "Face Swap",  color: "text-amber-400",  bg: "bg-amber-500/10",  icon: "🎭" },
  audio_processing: { label: "Audio",      color: "text-blue-400",   bg: "bg-blue-500/10",   icon: "🎵" },
  merging:          { label: "Merging",    color: "text-purple-400", bg: "bg-purple-500/10", icon: "🔀" },
  done:             { label: "Done",       color: "text-emerald-400",bg: "bg-emerald-500/10",icon: "✅" },
  error:            { label: "Failed",     color: "text-red-400",    bg: "bg-red-500/10",    icon: "❌" },
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

  // Jobs history
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
    // Auto-refresh every 10s if there are in-progress jobs
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

      if (!res.ok) {
        setError(data.error || "Something went wrong");
        return;
      }

      router.push(`/status/${data.jobId}`);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen p-4 pb-20">
      <div className="mx-auto max-w-5xl space-y-10">

        {/* ─── Hero + Form Section ──────────────────────────────────── */}
        <div className="flex items-center justify-center pt-8">
          <div className="w-full max-w-lg space-y-8">
            {/* Hero */}
            <div className="text-center space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-sm text-amber-400">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
                </span>
                World Biryani Day Special
              </div>
              <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
                🍚 <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-red-400 bg-clip-text text-transparent">Daawat</span>
              </h1>
              <p className="text-lg text-zinc-400">
                Star in your own personalized Daawat ad!
                <br />
                <span className="text-zinc-500">Upload your selfie → Get a video with your face &amp; name</span>
              </p>
            </div>

            {/* Form Card */}
            <Card className="border-zinc-800 bg-zinc-900/80 backdrop-blur-sm shadow-2xl shadow-amber-500/5">
              <CardHeader>
                <CardTitle className="text-white">Create Your Video</CardTitle>
                <CardDescription>Fill in your details and upload a clear selfie</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-zinc-300">Your Name</Label>
                    <Input
                      id="name"
                      placeholder="e.g. Suhail Ahmed"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="border-zinc-700 bg-zinc-800/50 text-white placeholder:text-zinc-500 focus-visible:ring-amber-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-zinc-300">Phone Number</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+91 98765 43210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="border-zinc-700 bg-zinc-800/50 text-white placeholder:text-zinc-500 focus-visible:ring-amber-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-zinc-300">Your Selfie</Label>
                    <div
                      onClick={() => fileRef.current?.click()}
                      className="group relative cursor-pointer rounded-xl border-2 border-dashed border-zinc-700 bg-zinc-800/30 p-6 text-center transition-all hover:border-amber-500/50 hover:bg-zinc-800/50"
                    >
                      {preview ? (
                        <div className="space-y-3">
                          <img
                            src={preview}
                            alt="Selfie preview"
                            className="mx-auto h-32 w-32 rounded-full object-cover ring-2 ring-amber-500/50"
                          />
                          <p className="text-sm text-zinc-400">Click to change</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-zinc-700/50 text-2xl">
                            📸
                          </div>
                          <p className="text-sm text-zinc-400">Click to upload your selfie</p>
                          <p className="text-xs text-zinc-500">PNG, JPG, WebP — Max 10MB</p>
                        </div>
                      )}
                      <input
                        ref={fileRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
                      {error}
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold shadow-lg shadow-amber-500/20 hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 transition-all h-12 text-base"
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        Creating your video...
                      </span>
                    ) : (
                      "✨ Create My Personalized Video"
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <p className="text-center text-xs text-zinc-600">
              By submitting, you consent to your image being used in a personalized video.
            </p>
          </div>
        </div>

        {/* ─── Job History Dashboard ───────────────────────────────── */}
        {jobsData && jobsData.total > 0 && (
          <div className="space-y-5">

            {/* Stats Bar */}
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">
                📊 Job History
              </h2>
              <button
                onClick={fetchJobs}
                className="text-xs text-zinc-500 hover:text-amber-400 transition-colors flex items-center gap-1"
              >
                <span className="h-3 w-3">↻</span> Refresh
              </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="Total" value={jobsData.stats.total} color="text-white" bg="bg-zinc-800/80" />
              <StatCard label="Completed" value={jobsData.stats.completed} color="text-emerald-400" bg="bg-emerald-500/5" icon="✅" />
              <StatCard label="Failed" value={jobsData.stats.failed} color="text-red-400" bg="bg-red-500/5" icon="❌" />
              <StatCard
                label="Avg Time"
                value={jobsData.stats.avgDurationMs > 0 ? formatDuration(jobsData.stats.avgDurationMs) : "—"}
                color="text-amber-400"
                bg="bg-amber-500/5"
                icon="⏱️"
                isText
              />
            </div>

            {/* Jobs Table */}
            <Card className="border-zinc-800 bg-zinc-900/80 backdrop-blur-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800">
                      <th className="text-left py-3 px-4 text-zinc-500 font-medium text-xs uppercase tracking-wider">User</th>
                      <th className="text-left py-3 px-4 text-zinc-500 font-medium text-xs uppercase tracking-wider">Status</th>
                      <th className="text-left py-3 px-4 text-zinc-500 font-medium text-xs uppercase tracking-wider hidden sm:table-cell">Duration</th>
                      <th className="text-left py-3 px-4 text-zinc-500 font-medium text-xs uppercase tracking-wider hidden md:table-cell">Created</th>
                      <th className="text-right py-3 px-4 text-zinc-500 font-medium text-xs uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {jobsData.jobs.map((job) => {
                      const s = STATUS_MAP[job.status] || STATUS_MAP.pending;
                      const isExpanded = expandedJob === job.id;

                      return (
                        <JobRow
                          key={job.id}
                          job={job}
                          statusInfo={s}
                          isExpanded={isExpanded}
                          onToggle={() => setExpandedJob(isExpanded ? null : job.id)}
                        />
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

      </div>
    </main>
  );
}

/* ─── Stat Card Component ─────────────────────────────────────────── */

function StatCard({
  label, value, color, bg, icon, isText,
}: {
  label: string;
  value: number | string;
  color: string;
  bg: string;
  icon?: string;
  isText?: boolean;
}) {
  return (
    <div className={`rounded-xl border border-zinc-800 ${bg} p-4 space-y-1`}>
      <p className="text-xs text-zinc-500 uppercase tracking-wider">{label}</p>
      <p className={`${isText ? "text-lg" : "text-2xl"} font-bold ${color} font-mono tabular-nums flex items-center gap-1.5`}>
        {icon && <span className="text-base">{icon}</span>}
        {value}
      </p>
    </div>
  );
}

/* ─── Job Row Component ───────────────────────────────────────────── */

function JobRow({
  job,
  statusInfo,
  isExpanded,
  onToggle,
}: {
  job: JobRecord;
  statusInfo: { label: string; color: string; bg: string; icon: string };
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const timings = job.stepTimings;
  const isActive = ["pending", "face_swapping", "audio_processing", "merging"].includes(job.status);

  return (
    <>
      <tr
        className={`hover:bg-zinc-800/40 transition-colors cursor-pointer ${isExpanded ? "bg-zinc-800/30" : ""}`}
        onClick={onToggle}
      >
        {/* User */}
        <td className="py-3 px-4">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center text-amber-400 text-xs font-bold shrink-0">
              {job.userName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-white font-medium truncate">{job.userName}</p>
              <p className="text-zinc-500 text-xs truncate">{job.userPhone}</p>
            </div>
          </div>
        </td>

        {/* Status */}
        <td className="py-3 px-4">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${statusInfo.color} ${statusInfo.bg}`}>
            {isActive ? (
              <span className="h-3 w-3 animate-spin rounded-full border-[1.5px] border-current/30 border-t-current" />
            ) : (
              <span>{statusInfo.icon}</span>
            )}
            {statusInfo.label}
            {isActive && <span className="text-[10px] opacity-60">{job.progress}%</span>}
          </span>
        </td>

        {/* Duration */}
        <td className="py-3 px-4 hidden sm:table-cell">
          <span className="font-mono text-xs text-zinc-400">
            {timings?.totalDurationLabel || (isActive ? "running..." : "—")}
          </span>
        </td>

        {/* Created */}
        <td className="py-3 px-4 hidden md:table-cell">
          <span className="text-xs text-zinc-500" title={new Date(job.createdAt).toLocaleString()}>
            {timeAgo(job.createdAt)}
          </span>
        </td>

        {/* Actions */}
        <td className="py-3 px-4 text-right">
          <div className="flex items-center justify-end gap-2">
            {job.status === "done" && job.finalVideoUrl && (
              <a
                href={job.finalVideoUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                ▶ Play
              </a>
            )}
            {isActive && (
              <a
                href={`/status/${job.id}`}
                onClick={(e) => e.stopPropagation()}
                className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
              >
                Track →
              </a>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onToggle(); }}
              className={`text-zinc-500 hover:text-zinc-300 transition-all text-xs ${isExpanded ? "rotate-180" : ""}`}
            >
              ▾
            </button>
          </div>
        </td>
      </tr>

      {/* Expanded Detail Row */}
      {isExpanded && (
        <tr className="bg-zinc-800/20">
          <td colSpan={5} className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Job Info */}
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Job Details</h4>
                <div className="space-y-1.5 text-xs">
                  <DetailRow label="Job ID" value={job.id} mono />
                  <DetailRow label="RunPod ID" value={job.runpodJobId || "—"} mono />
                  <DetailRow label="Status" value={`${statusInfo.icon} ${statusInfo.label}`} />
                  <DetailRow label="Progress" value={`${job.progress}%`} />
                  <DetailRow label="Created" value={new Date(job.createdAt).toLocaleString()} />
                  <DetailRow label="Updated" value={new Date(job.updatedAt).toLocaleString()} />
                  {job.errorMessage && (
                    <div className="mt-2 rounded border border-red-500/20 bg-red-500/5 p-2 text-red-400 text-xs break-all">
                      {job.errorMessage}
                    </div>
                  )}
                </div>
              </div>

              {/* Step Timings */}
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Step Timings</h4>
                {timings?.steps && timings.steps.length > 0 ? (
                  <div className="space-y-1.5">
                    {timings.steps.map((step, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="text-zinc-400">{step.label}</span>
                        <span className={`font-mono ${step.durationLabel ? "text-emerald-400" : "text-zinc-600"}`}>
                          {step.durationLabel || "—"}
                        </span>
                      </div>
                    ))}
                    {timings.totalDurationLabel && (
                      <div className="flex items-center justify-between text-xs pt-1.5 mt-1.5 border-t border-zinc-700/50">
                        <span className="text-zinc-300 font-medium">Total</span>
                        <span className="font-mono text-amber-400 font-semibold">{timings.totalDurationLabel}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-600">No timing data yet</p>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/* ─── Detail Row Helper ───────────────────────────────────────────── */

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-zinc-500 shrink-0">{label}</span>
      <span className={`text-zinc-300 truncate ${mono ? "font-mono text-[11px]" : ""}`}>{value}</span>
    </div>
  );
}
