"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function HomePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [selfie, setSelfie] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

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
    <main className="flex min-h-screen items-center justify-center p-4">
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
            <span className="text-zinc-500">Upload your selfie → Get a video with your face & name</span>
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
              {/* Name */}
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

              {/* Phone */}
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

              {/* Selfie Upload */}
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
                      <p className="text-sm text-zinc-400">
                        Click to upload your selfie
                      </p>
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

              {/* Error */}
              {error && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
                  {error}
                </div>
              )}

              {/* Submit */}
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

        {/* Footer */}
        <p className="text-center text-xs text-zinc-600">
          By submitting, you consent to your image being used in a personalized video.
        </p>
      </div>
    </main>
  );
}
