const fs = require('fs');
const path = require('path');
const os = require('os');
const ffmpeg = require('fluent-ffmpeg');
const sharp = require('sharp');

const CACHE_PATH = path.join(__dirname, '../fingerprint/cache.json');
const VIDEOS_DIR = path.join(__dirname, '../fingerprint/videos');

fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
fs.mkdirSync(VIDEOS_DIR, { recursive: true });

function loadCache() {
  try { return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8')); }
  catch { return {}; }
}
function saveCache(cache) {
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
}

// 2D DCT — compute only the 8x8 top-left coefficients from a 32x32 input
function computeDCTCoeffs(pixels) {
  const N = 32;
  const K = 8;
  const coeffs = [];

  for (let u = 0; u < K; u++) {
    for (let v = 0; v < K; v++) {
      let sum = 0;
      for (let x = 0; x < N; x++) {
        const cx = Math.cos(((2 * x + 1) * u * Math.PI) / (2 * N));
        for (let y = 0; y < N; y++) {
          sum += pixels[x * N + y] * cx * Math.cos(((2 * y + 1) * v * Math.PI) / (2 * N));
        }
      }
      const cu = u === 0 ? 1 / Math.sqrt(2) : 1;
      const cv = v === 0 ? 1 / Math.sqrt(2) : 1;
      coeffs.push((2 / N) * cu * cv * sum);
    }
  }
  return coeffs; // 64 values
}

// Perceptual hash — 64-bit as 16-char hex string
async function computePHash(imageBuffer) {
  const { data } = await sharp(imageBuffer)
    .resize(32, 32, { fit: 'fill' })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = Array.from(data);
  const coeffs = computeDCTCoeffs(pixels);

  // Skip DC component (index 0), use remaining 63 values
  const vals = coeffs.slice(1);
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;

  let bits = '';
  for (const v of vals) bits += v > avg ? '1' : '0';

  // Pad to 64 bits
  while (bits.length < 64) bits += '0';

  let hex = '';
  for (let i = 0; i < 64; i += 4) {
    hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  }
  return hex; // 16-char hex = 64 bits
}

// Hamming distance between two 16-char hex hashes
function hammingDistance(h1, h2) {
  const len = Math.min(h1.length, h2.length);
  let dist = 0;
  for (let i = 0; i < len; i++) {
    let xor = parseInt(h1[i], 16) ^ parseInt(h2[i], 16);
    while (xor) { dist += xor & 1; xor >>= 1; }
  }
  return dist;
}

// Extract frames at configurable interval into a temp dir
function extractFrames(videoPath, interval, tmpDir) {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .outputOptions([`-vf fps=1/${interval}`, '-vsync vfr'])
      .output(path.join(tmpDir, 'frame_%04d.png'))
      .on('end', () => {
        const frames = fs.readdirSync(tmpDir)
          .filter(f => f.startsWith('frame_') && f.endsWith('.png'))
          .sort();
        resolve(frames);
      })
      .on('error', reject)
      .run();
  });
}

// Extract raw PCM audio and compute an energy-band fingerprint
function extractAudioFingerprint(videoPath) {
  return new Promise((resolve) => {
    const tmpAudio = path.join(os.tmpdir(), `vbv-audio-${Date.now()}.pcm`);

    ffmpeg(videoPath)
      .noVideo()
      .audioChannels(1)
      .audioFrequency(11025)
      .outputFormat('s16le')
      .output(tmpAudio)
      .on('end', () => {
        try {
          const buf = fs.readFileSync(tmpAudio);
          resolve(buildAudioFingerprint(buf));
        } catch {
          resolve([]);
        } finally {
          try { fs.unlinkSync(tmpAudio); } catch {}
        }
      })
      .on('error', () => {
        try { fs.unlinkSync(tmpAudio); } catch {}
        resolve([]);
      })
      .run();
  });
}

// Split PCM buffer into frames, compute sub-band energies, produce binary fingerprint
function buildAudioFingerprint(buf) {
  const FRAME = 4096;  // ~0.37s at 11025 Hz
  const BANDS = 6;
  const bandSize = Math.floor(FRAME / BANDS);
  const numFrames = Math.floor(buf.length / (FRAME * 2));
  const fingerprint = [];

  for (let f = 0; f < numFrames; f++) {
    const base = f * FRAME * 2;
    const energies = [];

    for (let b = 0; b < BANDS; b++) {
      let energy = 0;
      for (let i = 0; i < bandSize; i++) {
        const off = base + (b * bandSize + i) * 2;
        if (off + 1 >= buf.length) break;
        const s = buf.readInt16LE(off);
        energy += s * s;
      }
      energies.push(energy / bandSize);
    }

    // 5 bits per frame: adjacent band energy comparisons
    for (let b = 0; b < 5; b++) {
      fingerprint.push(energies[b] > energies[b + 1] ? 1 : 0);
    }
  }

  return fingerprint;
}

// Compare two frame hash arrays — returns 0–100
function visualSimilarity(hashes1, hashes2) {
  if (!hashes1.length || !hashes2.length) return 0;
  const len = Math.min(hashes1.length, hashes2.length);
  let total = 0;
  for (let i = 0; i < len; i++) {
    const dist = hammingDistance(hashes1[i], hashes2[i]);
    total += (1 - dist / 64) * 100;
  }
  return total / len;
}

// Compare two audio fingerprint arrays — returns 0–100
function audioSimilarity(fp1, fp2) {
  if (!fp1.length || !fp2.length) return 50; // neutral when audio unavailable
  const len = Math.min(fp1.length, fp2.length);
  let matches = 0;
  for (let i = 0; i < len; i++) {
    if (fp1[i] === fp2[i]) matches++;
  }
  return (matches / len) * 100;
}

// Get video duration in seconds
function getVideoDuration(videoPath) {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(videoPath, (err, meta) => {
      resolve(err ? 0 : (meta?.format?.duration || 0));
    });
  });
}

// Process a video: extract frame hashes + audio fingerprint
async function processVideo(videoPath, interval) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vbv-fp-'));
  try {
    const frameFiles = await extractFrames(videoPath, interval, tmpDir);

    const frameHashes = [];
    for (const file of frameFiles) {
      const buf = fs.readFileSync(path.join(tmpDir, file));
      frameHashes.push(await computePHash(buf));
    }

    // Ensure at least 1 hash if no frames were extracted (very short video)
    if (frameHashes.length === 0) {
      const probe = await new Promise(r => ffmpeg.ffprobe(videoPath, (e, m) => r(m)));
      const firstFrame = await new Promise((res, rej) => {
        ffmpeg(videoPath)
          .outputOptions(['-frames:v 1'])
          .output(path.join(tmpDir, 'first.png'))
          .on('end', () => res(path.join(tmpDir, 'first.png')))
          .on('error', rej)
          .run();
      });
      const buf = fs.readFileSync(firstFrame);
      frameHashes.push(await computePHash(buf));
    }

    const audioFingerprint = await extractAudioFingerprint(videoPath);
    return { frameHashes, audioFingerprint };
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

async function registerVideo(videoPath, filename) {
  const interval = parseFloat(process.env.FRAME_INTERVAL_SECONDS) || 1;
  const { frameHashes, audioFingerprint } = await processVideo(videoPath, interval);
  const duration = await getVideoDuration(videoPath);

  const cache = loadCache();
  cache[filename] = {
    filename,
    frameHashes,
    audioFingerprint,
    duration: parseFloat(duration.toFixed(2)),
    frameInterval: interval,
    registeredAt: new Date().toISOString(),
  };
  saveCache(cache);

  return { filename, frameCount: frameHashes.length, duration };
}

async function compareVideo(videoPath) {
  const interval = parseFloat(process.env.FRAME_INTERVAL_SECONDS) || 1;
  const { frameHashes: newHashes, audioFingerprint: newAudio } = await processVideo(videoPath, interval);

  const cache = loadCache();
  const results = [];

  for (const [, entry] of Object.entries(cache)) {
    const visual = visualSimilarity(newHashes, entry.frameHashes);
    const audio = audioSimilarity(newAudio, entry.audioFingerprint);
    const combined = visual * 0.7 + audio * 0.3;

    results.push({
      filename: entry.filename,
      duration: entry.duration,
      registeredAt: entry.registeredAt,
      visualScore: parseFloat(visual.toFixed(1)),
      audioScore: parseFloat(audio.toFixed(1)),
      combinedScore: parseFloat(combined.toFixed(1)),
    });
  }

  return results.sort((a, b) => b.combinedScore - a.combinedScore);
}

function listVideos() {
  const cache = loadCache();
  return Object.values(cache).map(v => ({
    filename: v.filename,
    duration: v.duration,
    frameCount: v.frameHashes?.length || 0,
    registeredAt: v.registeredAt,
  }));
}

function deleteVideo(filename) {
  const cache = loadCache();
  if (!cache[filename]) return false;
  delete cache[filename];
  saveCache(cache);
  const videoPath = path.join(VIDEOS_DIR, filename);
  try { if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath); } catch {}
  return true;
}

module.exports = { registerVideo, compareVideo, listVideos, deleteVideo, VIDEOS_DIR };
