"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/* ─── Types ───────────────────────────────────────────────────────── */

interface StepTiming { step: string; label: string; durationMs?: number; durationLabel?: string; }
interface PipelineTimings { totalDurationMs?: number; totalDurationLabel?: string; steps: StepTiming[]; }
interface JobRecord {
  id: string; userName: string; userPhone: string; status: string; progress: number;
  runpodJobId: string | null; errorMessage: string | null; stepTimings: PipelineTimings | null;
  createdAt: string; updatedAt: string; finalVideoUrl: string | null;
}
interface JobsResponse {
  jobs: JobRecord[]; total: number;
  stats: { total: number; completed: number; failed: number; inProgress: number; avgDurationMs: number; };
}

/* ─── Helpers ─────────────────────────────────────────────────────── */

const STATUS_MAP: Record<string, { label: string; color: string; dotColor: string }> = {
  pending:          { label: "Queued",    color: "text-zinc-400",    dotColor: "bg-zinc-400"    },
  face_swapping:    { label: "Face Swap", color: "text-[#002e82]",   dotColor: "bg-[#e4b573]"   },
  audio_processing: { label: "Audio",     color: "text-sky-600",     dotColor: "bg-sky-500"     },
  merging:          { label: "Merging",   color: "text-violet-600",  dotColor: "bg-violet-500"  },
  done:             { label: "Complete",  color: "text-emerald-600", dotColor: "bg-emerald-500" },
  error:            { label: "Failed",    color: "text-red-600",     dotColor: "bg-red-500"     },
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
  return `${Math.floor(hrs / 24)}d ago`;
}

/* ─── Main Page ───────────────────────────────────────────────────── */

export default function HomePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [selfie, setSelfie] = useState<File | null>(null);
  const [swapMode, setSwapMode] = useState<"face" | "character">("face");
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [jobsData, setJobsData] = useState<JobsResponse | null>(null);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    try { const res = await fetch("/api/jobs?limit=50"); if (res.ok) setJobsData(await res.json()); } catch {}
  }, []);

  useEffect(() => { fetchJobs(); const i = setInterval(fetchJobs, 10000); return () => clearInterval(i); }, [fetchJobs]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setSelfie(file); setPreview(URL.createObjectURL(file)); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError("");
    if (!name.trim() || !phone.trim() || !selfie) { setError("Please fill all fields and upload your selfie."); return; }
    setLoading(true);
    try {
      const fd = new FormData(); fd.append("name", name.trim()); fd.append("phone", phone.trim()); fd.append("selfie", selfie); fd.append("swapMode", swapMode);
      const res = await fetch("/api/submit", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Something went wrong"); return; }
      router.push(`/status/${data.jobId}`);
    } catch { setError("Network error. Please try again."); } finally { setLoading(false); }
  };

  return (
    <>
      {/* ═══ ABOVE THE FOLD — Hero + Form ═══════════════════════════ */}
      <section className="relative min-h-[100dvh] flex items-center justify-center px-4 py-8 sm:px-6 lg:px-8 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-gradient-to-b from-[#e4b573]/10 via-[#002e82]/4 to-transparent rounded-full blur-3xl animate-pulse-glow pointer-events-none" />

        <div className="relative w-full max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center">

            {/* Left: Hero CTA */}
            <div className="space-y-6 text-center lg:text-left">
              <div className="inline-flex items-center gap-2.5 rounded-full border border-[#e4b573]/30 bg-[#f0ebe0] px-5 py-2 text-sm text-[#002e82]">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#e4b573] opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#e4b573]" />
                </span>
                Daawat World Biryani Day 2026
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.08]">
                <span className="text-zinc-900">Star in Your</span>
                <br />
                <span className="bg-gradient-to-r from-[#002e82] via-[#1a4a99] to-[#e4b573] bg-clip-text text-transparent animate-gradient">
                  Own Daawat Ad
                </span>
              </h1>

              <p className="text-base sm:text-lg text-zinc-500 leading-relaxed max-w-md mx-auto lg:mx-0">
                Upload a selfie — our AI puts <em className="text-zinc-700 not-italic font-medium">your face &amp; name</em> into
                a premium Daawat Biryani commercial in under 3 minutes.
              </p>

              {/* How it works pills */}
              <div className="flex flex-wrap justify-center lg:justify-start gap-2.5 pt-1">
                {[{ n: "1", t: "Upload Selfie" }, { n: "2", t: "AI Face Swap" }, { n: "3", t: "Get Your Video" }].map((s) => (
                  <div key={s.n} className="flex items-center gap-2 rounded-full bg-white border border-[#e4b573]/20 px-3.5 py-1.5 text-xs shadow-sm">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#f0ebe0] text-[#002e82] text-[10px] font-bold">{s.n}</span>
                    <span className="text-zinc-700 font-medium">{s.t}</span>
                  </div>
                ))}
              </div>

              {/* Social proof */}
              {jobsData && jobsData.stats.completed > 0 && (
                <div className="flex items-center gap-4 justify-center lg:justify-start pt-2">
                  <div className="flex -space-x-2">
                    {["S", "N", "A", "R"].map((c, i) => (
                      <div key={i} className="h-8 w-8 rounded-full bg-gradient-to-br from-[#f0ebe0] to-[#e8dfd0] border-2 border-white flex items-center justify-center text-[#002e82] text-[10px] font-bold shadow-sm">
                        {c}
                      </div>
                    ))}
                  </div>
                  <p className="text-sm text-zinc-500">
                    <span className="text-zinc-800 font-semibold">{jobsData.stats.completed}</span> videos created
                  </p>
                </div>
              )}
            </div>

            {/* Right: Form */}
            <div className="w-full max-w-md mx-auto lg:mx-0 lg:ml-auto">
              <div className="glass-strong rounded-2xl p-5 sm:p-6">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="name" className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Name</Label>
                      <Input id="name" placeholder="Suhail Ahmed" value={name} onChange={(e) => setName(e.target.value)}
                        className="h-11 rounded-xl border-zinc-200 bg-zinc-50/80 text-zinc-900 placeholder:text-zinc-400 focus-visible:ring-[#e4b573]/50 focus-visible:border-[#e4b573]/40 transition-all text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="phone" className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Phone</Label>
                      <Input id="phone" type="tel" placeholder="+91 98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)}
                        className="h-11 rounded-xl border-zinc-200 bg-zinc-50/80 text-zinc-900 placeholder:text-zinc-400 focus-visible:ring-[#e4b573]/50 focus-visible:border-[#e4b573]/40 transition-all text-sm" />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Selfie</Label>
                    <div onClick={() => fileRef.current?.click()}
                      className="group cursor-pointer rounded-xl border border-dashed border-zinc-300 bg-zinc-50/50 p-3 transition-all hover:border-[#e4b573]/50 hover:bg-[#f0ebe0]/50">
                      {preview ? (
                        <div className="flex items-center gap-3">
                          <img src={preview} alt="Preview" className="h-12 w-12 rounded-lg object-cover ring-1 ring-[#e4b573]/40" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-zinc-700 truncate">{selfie?.name}</p>
                            <p className="text-[11px] text-zinc-400">Tap to change</p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-lg group-hover:bg-[#f0ebe0] group-hover:text-[#002e82] transition-all">📸</div>
                          <div>
                            <p className="text-sm text-zinc-500 group-hover:text-zinc-700 transition-colors">Upload a clear selfie</p>
                            <p className="text-[11px] text-zinc-400">PNG, JPG, WebP · Max 10MB</p>
                          </div>
                        </div>
                      )}
                      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleFileChange} className="hidden" />
                    </div>
                  </div>

                  {/* Swap Mode Toggle */}
                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Experience</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <button type="button" onClick={() => setSwapMode("face")}
                        className={`relative rounded-xl border p-3 text-left transition-all cursor-pointer ${
                          swapMode === "face"
                            ? "border-[#e4b573] bg-[#f0ebe0]/60 ring-1 ring-[#e4b573]/30"
                            : "border-zinc-200 bg-zinc-50/50 hover:border-zinc-300"
                        }`}>
                        <p className="text-sm font-medium text-zinc-800">🎭 Face Swap</p>
                        <p className="text-[10px] text-zinc-400 mt-0.5">Fast · ~2 min</p>
                      </button>
                      <button type="button" onClick={() => setSwapMode("character")}
                        className={`relative rounded-xl border p-3 text-left transition-all cursor-pointer ${
                          swapMode === "character"
                            ? "border-[#002e82] bg-[#002e82]/5 ring-1 ring-[#002e82]/30"
                            : "border-zinc-200 bg-zinc-50/50 hover:border-zinc-300"
                        }`}>
                        <span className="absolute top-1.5 right-1.5 text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-gradient-to-r from-[#002e82] to-[#1a4a99] text-white">Premium</span>
                        <p className="text-sm font-medium text-zinc-800">✨ Character Swap</p>
                        <p className="text-[10px] text-zinc-400 mt-0.5">HD · ~8 min</p>
                      </button>
                    </div>
                  </div>

                  {error && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 flex items-center gap-2">
                      <span>⚠</span><span>{error}</span>
                    </div>
                  )}

                  <Button type="submit" disabled={loading}
                    className="w-full h-11 rounded-xl bg-gradient-to-r from-[#002e82] via-[#1a4a99] to-[#e4b573] text-white font-semibold text-sm shadow-lg shadow-[#002e82]/20 hover:shadow-[#002e82]/30 hover:brightness-110 disabled:opacity-50 transition-all cursor-pointer">
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />Processing...
                      </span>
                    ) : "Create My Video →"}
                  </Button>

                  <p className="text-center text-[10px] text-zinc-400 leading-relaxed">
                    By submitting you consent to your image being used in a personalized video.
                  </p>
                </form>
              </div>
            </div>
          </div>
        </div>

        {jobsData && jobsData.total > 0 && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-zinc-400 animate-float">
            <span className="text-[10px] uppercase tracking-widest">Pipeline Monitor</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="6 9 12 15 18 9" /></svg>
          </div>
        )}
      </section>

      {/* ═══ BELOW THE FOLD — Pipeline Monitor ══════════════════════ */}
      {jobsData && jobsData.total > 0 && (
        <section className="px-4 sm:px-6 lg:px-8 pb-24 pt-4">
          <div className="mx-auto max-w-5xl space-y-5">
            <div className="flex items-end justify-between">
              <div>
                <h2 className="text-xl font-bold text-zinc-900">Pipeline Monitor</h2>
                <p className="text-xs text-zinc-400 mt-0.5">Real-time job tracking &amp; performance metrics</p>
              </div>
              <button onClick={fetchJobs} className="text-[11px] text-zinc-400 hover:text-[#002e82] transition-colors px-3 py-1.5 rounded-lg hover:bg-[#f0ebe0]">↻ Refresh</button>
            </div>

            <div className="grid grid-cols-4 gap-2.5">
              <MetricCard label="Total" value={jobsData.stats.total} />
              <MetricCard label="Done" value={jobsData.stats.completed} accent="emerald" />
              <MetricCard label="Failed" value={jobsData.stats.failed} accent="red" />
              <MetricCard label="Avg" value={jobsData.stats.avgDurationMs > 0 ? formatDuration(jobsData.stats.avgDurationMs) : "—"} accent="amber" isText />
            </div>

            <div className="glass rounded-2xl overflow-hidden">
              <div className="hidden sm:grid grid-cols-[1fr_110px_90px_90px_70px] gap-2 px-4 py-2.5 border-b border-zinc-200/60 text-[10px] font-medium text-zinc-400 uppercase tracking-wider">
                <span>User</span><span>Status</span><span>Duration</span><span>Created</span><span className="text-right">Info</span>
              </div>
              <div className="divide-y divide-zinc-100">
                {jobsData.jobs.map((job) => (
                  <JobRow key={job.id} job={job} statusInfo={STATUS_MAP[job.status] || STATUS_MAP.pending}
                    isExpanded={expandedJob === job.id} onToggle={() => setExpandedJob(expandedJob === job.id ? null : job.id)} />
                ))}
              </div>
            </div>
          </div>
        </section>
      )}
    </>
  );
}

/* ─── Metric Card ─────────────────────────────────────────────────── */

function MetricCard({ label, value, accent, isText }: { label: string; value: number | string; accent?: string; isText?: boolean; }) {
  const c: Record<string, string> = { emerald: "text-emerald-600", red: "text-red-600", amber: "text-[#002e82]" };
  return (
    <div className="glass rounded-xl p-3 space-y-1">
      <p className="text-[10px] text-zinc-400 uppercase tracking-wider font-medium">{label}</p>
      <p className={`${isText ? "text-base" : "text-xl"} font-bold ${accent ? c[accent] : "text-zinc-900"} font-mono tabular-nums leading-none`}>{value}</p>
    </div>
  );
}

/* ─── Job Row ─────────────────────────────────────────────────────── */

function JobRow({ job, statusInfo, isExpanded, onToggle }: {
  job: JobRecord; statusInfo: { label: string; color: string; dotColor: string }; isExpanded: boolean; onToggle: () => void;
}) {
  const timings = job.stepTimings;
  const isActive = ["pending", "face_swapping", "audio_processing", "merging"].includes(job.status);

  return (
    <>
      <div className={`grid grid-cols-1 sm:grid-cols-[1fr_110px_90px_90px_70px] gap-1 sm:gap-2 items-center px-4 py-3 cursor-pointer transition-colors hover:bg-[#f0ebe0]/40 ${isExpanded ? "bg-[#f0ebe0]/30" : ""}`} onClick={onToggle}>
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#f0ebe0] to-[#e8dfd0] flex items-center justify-center text-[#002e82] text-xs font-bold shrink-0 ring-1 ring-[#e4b573]/50">
            {job.userName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-zinc-800 truncate">{job.userName}</p>
            <p className="text-[10px] text-zinc-400 truncate sm:hidden">{statusInfo.label} · {timings?.totalDurationLabel || "—"}</p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-1.5">
          <span className={`relative h-1.5 w-1.5 rounded-full ${statusInfo.dotColor}`}>
            {isActive && <span className={`absolute inset-0 rounded-full ${statusInfo.dotColor} animate-ping opacity-60`} />}
          </span>
          <span className={`text-[11px] font-medium ${statusInfo.color}`}>{statusInfo.label}</span>
        </div>
        <span className="hidden sm:block text-[11px] font-mono text-zinc-400">{timings?.totalDurationLabel || (isActive ? "..." : "—")}</span>
        <span className="hidden sm:block text-[10px] text-zinc-400">{timeAgo(job.createdAt)}</span>
        <div className="hidden sm:flex items-center justify-end gap-2">
          {job.status === "done" && job.finalVideoUrl && (
            <a href={job.finalVideoUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-[10px] font-medium text-emerald-600 hover:text-emerald-500 transition-colors">▶</a>
          )}
          {isActive && <a href={`/status/${job.id}`} onClick={(e) => e.stopPropagation()} className="text-[10px] font-medium text-[#002e82] hover:text-[#1a4a99] transition-colors">→</a>}
          <span className={`text-zinc-300 text-[10px] transition-transform ${isExpanded ? "rotate-180" : ""}`}>▾</span>
        </div>
      </div>

      {isExpanded && (
        <div className="px-4 pb-4 pt-1 bg-[#f0ebe0]/20">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-xl border border-zinc-200/60 bg-white/60 p-3.5">
            <div className="space-y-2.5">
              <h4 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Job Info</h4>
              <div className="space-y-1.5 text-[11px]">
                <InfoRow label="Job ID" value={job.id} mono />
                <InfoRow label="RunPod" value={job.runpodJobId || "—"} mono />
                <InfoRow label="Progress" value={`${job.progress}%`} />
                <InfoRow label="Created" value={new Date(job.createdAt).toLocaleString()} />
              </div>
              {job.errorMessage && <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-[10px] text-red-600 break-all">{job.errorMessage}</div>}
            </div>
            <div className="space-y-2.5">
              <h4 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Step Timings</h4>
              {timings?.steps?.length ? (
                <div className="space-y-1.5">
                  {timings.steps.map((step, i) => (
                    <div key={i} className="flex items-center justify-between text-[11px]">
                      <span className="text-zinc-500">{step.label}</span>
                      <div className="flex items-center gap-2">
                        {step.durationMs && timings.totalDurationMs && (
                          <div className="h-1 rounded-full bg-zinc-200 w-12 overflow-hidden">
                            <div className="h-full rounded-full bg-gradient-to-r from-[#e4b573] to-[#002e82]" style={{ width: `${Math.min(100, (step.durationMs / timings.totalDurationMs) * 100)}%` }} />
                          </div>
                        )}
                        <span className={`font-mono text-[10px] w-12 text-right ${step.durationLabel ? "text-emerald-600" : "text-zinc-300"}`}>{step.durationLabel || "—"}</span>
                      </div>
                    </div>
                  ))}
                  {timings.totalDurationLabel && (
                    <div className="flex items-center justify-between text-[11px] pt-1.5 mt-1.5 border-t border-zinc-200/60">
                      <span className="text-zinc-700 font-medium">Total</span>
                      <span className="font-mono text-[#002e82] font-semibold">{timings.totalDurationLabel}</span>
                    </div>
                  )}
                </div>
              ) : <p className="text-[11px] text-zinc-300">No timing data yet</p>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-zinc-400 shrink-0">{label}</span>
      <span className={`text-zinc-600 truncate ${mono ? "font-mono text-[10px]" : ""}`}>{value}</span>
    </div>
  );
}
