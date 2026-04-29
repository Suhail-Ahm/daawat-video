/**
 * Audio Personalization Pipeline
 * Ported from: /projects/swap/lib/pipeline.js
 *
 * Flow: Transliterate name → ElevenLabs TTS → FFmpeg splice into audio
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

// ─── Timing — where the name is spoken in the template video ─────────────────
const NAME_START = parseFloat(process.env.NAME_START_SEC || "3.8");
const NAME_END = parseFloat(process.env.NAME_END_SEC || "4.8");

// ─── Pre-baked Demucs stems (committed as assets) ────────────────────────────
const ASSETS_DIR = path.join(process.cwd(), "assets");
const BG_TRACK = path.join(ASSETS_DIR, "no_vocals.wav"); // Background music (Demucs separated)
const FULL_AUDIO = path.join(ASSETS_DIR, "full_audio.wav"); // Original complete audio

// ─── Helpers ─────────────────────────────────────────────────────────────────
function ffmpeg(args: string, cwd?: string) {
  try {
    execSync(`ffmpeg -hide_banner -loglevel error ${args}`, {
      stdio: "pipe",
      cwd: cwd || os.tmpdir(),
    });
  } catch (e: unknown) {
    const err = e as { stderr?: Buffer; message: string };
    throw new Error(`FFmpeg: ${err.stderr?.toString() || err.message}`);
  }
}

function dur(f: string): number {
  return parseFloat(
    execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${f}"`, {
      encoding: "utf8",
    }).trim()
  );
}

// ─── OpenAI Transliteration ──────────────────────────────────────────────────
async function transliterate(name: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0,
      max_tokens: 50,
      messages: [
        {
          role: "system",
          content:
            "You are a Hindi transliteration tool. Convert the given name from English/Roman script to Hindi Devanagari script. Return ONLY the Hindi text. Keep the name phonetically accurate. Do not add any suffix or honorific.",
        },
        { role: "user", content: name },
      ],
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`OpenAI error: ${JSON.stringify(data.error)}`);

  const hindi = data.choices[0].message.content.trim();
  console.log(`  ✦ Transliterated: "${name}" → "${hindi}"`);
  return hindi;
}

// ─── ElevenLabs TTS ──────────────────────────────────────────────────────────
const VOICE_ID = "BtZUfAkOeepE9XEnWR3b";
const MODEL_ID = "eleven_v3";

async function generateTTS(text: string, outputPath: string): Promise<string> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY not set");

  console.log(`  ✦ ElevenLabs TTS: "${text}"`);

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        model_id: MODEL_ID,
        language_code: "hi",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.85,
          style: 0.35,
          speed: 1.2,
          use_speaker_boost: true,
        },
      }),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`ElevenLabs TTS error: ${errText}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(outputPath, buffer);

  const size = fs.statSync(outputPath).size;
  if (size < 500) {
    fs.unlinkSync(outputPath);
    throw new Error("ElevenLabs returned empty audio");
  }

  console.log(`  ✦ TTS saved: ${(size / 1024).toFixed(0)} KB`);
  return outputPath;
}

// ─── Main Audio Pipeline ─────────────────────────────────────────────────────

/**
 * Generate personalized audio for a given name
 * Returns path to the final audio WAV file
 */
export async function generatePersonalizedAudio(
  name: string,
  workDir: string
): Promise<string> {
  // Verify pre-baked assets exist
  if (!fs.existsSync(BG_TRACK)) {
    throw new Error(`Background track not found: ${BG_TRACK}. Run 'npm run setup' first.`);
  }
  if (!fs.existsSync(FULL_AUDIO)) {
    throw new Error(`Full audio not found: ${FULL_AUDIO}. Run 'npm run setup' first.`);
  }

  const sanitized = name.replace(/[^a-zA-Z0-9\u0900-\u097F]/g, "_").replace(/_+/g, "_");

  console.log(`\n  🎵 Audio pipeline for: "${name}"`);

  // Step 1: Transliterate to Hindi
  const hindiName = await transliterate(name);

  // Step 2: Generate TTS
  const ttsMp3 = path.join(workDir, `tts_${sanitized}.mp3`);
  await generateTTS(hindiName, ttsMp3);

  // Convert to WAV 44100Hz stereo
  const ttsWav = path.join(workDir, `tts_${sanitized}.wav`);
  ffmpeg(`-i "${ttsMp3}" -acodec pcm_s16le -ar 44100 -ac 2 "${ttsWav}" -y`);
  const ttsDur = dur(ttsWav);
  const target = NAME_END - NAME_START;
  console.log(`  ▸ TTS: ${ttsDur.toFixed(3)}s (window: ${target.toFixed(1)}s)`);

  // Step 3: Time-adjust (speed up if longer than window, never slow down)
  let adjustedTts = ttsWav;
  const ratio = ttsDur / target;

  if (ratio > 1.05) {
    console.log(`  ▸ Speeding up: ${ratio.toFixed(2)}x`);
    adjustedTts = path.join(workDir, `tts_adj_${sanitized}.wav`);
    const filter = ratio <= 2.0 ? `atempo=${ratio}` : `atempo=2.0,atempo=${(ratio / 2).toFixed(4)}`;
    ffmpeg(`-i "${ttsWav}" -filter:a "${filter}" "${adjustedTts}" -y`);
  }

  // Step 4: Extract background music segment and mix with TTS
  const bgSeg = path.join(workDir, `bg_seg.wav`);
  ffmpeg(`-i "${BG_TRACK}" -ss ${NAME_START} -to ${NAME_END} -acodec pcm_s16le -ar 44100 -ac 2 "${bgSeg}" -y`);

  const nameBg = path.join(workDir, `name_bg.wav`);
  const adjDur = dur(adjustedTts);

  if (adjDur < target) {
    ffmpeg(
      `-i "${adjustedTts}" -i "${bgSeg}" -filter_complex "[0]apad=whole_dur=${target}[p];[p][1]amix=inputs=2:duration=shortest:weights=1 0.7:normalize=0" "${nameBg}" -y`
    );
  } else {
    ffmpeg(
      `-i "${adjustedTts}" -i "${bgSeg}" -filter_complex "[0]atrim=0:${target},asetpts=PTS-STARTPTS[t];[t][1]amix=inputs=2:duration=shortest:weights=1 0.7:normalize=0" "${nameBg}" -y`
    );
  }

  // Step 5: Overlay — mute original at name window, insert new name+bg
  const finalAudio = path.join(workDir, `final_audio.wav`);
  const delayMs = Math.round(NAME_START * 1000);
  ffmpeg(
    `-i "${FULL_AUDIO}" -i "${nameBg}" ` +
      `-filter_complex "` +
      `[0]volume=0:enable='between(t,${NAME_START},${NAME_END})'[muted];` +
      `[1]adelay=${delayMs}|${delayMs},apad[delayed];` +
      `[muted][delayed]amix=inputs=2:duration=first:normalize=0" ` +
      `"${finalAudio}" -y`
  );

  const origDur = dur(FULL_AUDIO);
  const finalDur = dur(finalAudio);
  console.log(`  ▸ Audio: ${finalDur.toFixed(3)}s (drift: ${((finalDur - origDur) * 1000).toFixed(0)}ms)`);

  // Cleanup temp files
  [ttsMp3, ttsWav, adjustedTts, bgSeg, nameBg].forEach((f) => {
    if (f && f !== finalAudio && fs.existsSync(f)) {
      try { fs.unlinkSync(f); } catch { /* ignore */ }
    }
  });

  return finalAudio;
}

/**
 * Merge personalized audio back into a video (face-swapped video)
 * Returns path to the final output video
 */
export async function mergeAudioIntoVideo(
  videoPath: string,
  audioPath: string,
  outputPath: string
): Promise<string> {
  console.log(`  🎬 Merging audio into video...`);
  ffmpeg(`-i "${videoPath}" -i "${audioPath}" -c:v copy -map 0:v:0 -map 1:a:0 -shortest "${outputPath}" -y`);
  const mb = (fs.statSync(outputPath).size / 1048576).toFixed(1);
  console.log(`  ✅ Final video: ${outputPath} (${mb} MB)`);
  return outputPath;
}
