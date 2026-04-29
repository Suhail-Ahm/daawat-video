"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface JobResult {
  jobId: string;
  status: string;
  name: string;
  videoUrl: string | null;
}

export default function ResultPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const [job, setJob] = useState<JobResult | null>(null);

  useEffect(() => {
    fetch(`/api/status/${jobId}`)
      .then((r) => r.json())
      .then(setJob)
      .catch(console.error);
  }, [jobId]);

  if (!job || job.status !== "done" || !job.videoUrl) {
    return (
      <main className="flex min-h-screen items-center justify-center p-4">
        <div className="text-center space-y-4">
          <span className="text-5xl">⏳</span>
          <p className="text-zinc-400">Loading your video...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          <h1 className="text-3xl font-bold text-white sm:text-4xl">
            🎉{" "}
            <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-red-400 bg-clip-text text-transparent">
              Your Video is Ready!
            </span>
          </h1>
          <p className="text-zinc-400">
            Here&apos;s your personalized Daawat ad, <span className="text-amber-400 font-medium">{job.name}</span>!
          </p>
        </div>

        {/* Video Player */}
        <Card className="overflow-hidden border-zinc-800 bg-zinc-900/80 backdrop-blur-sm shadow-2xl shadow-amber-500/10">
          <CardContent className="p-0">
            <video
              src={job.videoUrl}
              controls
              autoPlay
              playsInline
              className="w-full rounded-t-lg"
              poster="/video-poster.jpg"
            />
            <div className="flex gap-3 p-4">
              <a
                href={job.videoUrl}
                download={`daawat_${job.name}.mp4`}
                className="flex-1 inline-flex items-center justify-center rounded-md bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold shadow-lg shadow-amber-500/20 hover:from-amber-600 hover:to-orange-600 h-11 px-4 text-sm transition-colors"
              >
                📥 Download Video
              </a>
              <Button
                variant="outline"
                className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 h-11"
                onClick={() => {
                  if (navigator.share) {
                    navigator.share({
                      title: `${job.name}'s Daawat Video`,
                      text: "Check out my personalized Daawat ad!",
                      url: window.location.href,
                    });
                  } else {
                    navigator.clipboard.writeText(window.location.href);
                  }
                }}
              >
                🔗 Share
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* CTA */}
        <div className="text-center">
          <Button
            variant="ghost"
            className="text-zinc-500 hover:text-amber-400"
            onClick={() => (window.location.href = "/")}
          >
            ← Create another video
          </Button>
        </div>
      </div>
    </main>
  );
}
