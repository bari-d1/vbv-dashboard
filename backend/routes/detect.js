const express = require('express');
const axios = require('axios');

const router = express.Router();

const SYSTEM_PROMPT = `You are an expert video editor specialising in short-form Christian content. Your job is to identify the best clippable moments from a sermon transcript.

A strong clip has two parts:
- Hook: an opening moment that creates tension, asks a question, makes a bold claim, or delivers a surprising statement that compels the viewer to keep watching
- Payoff: the resolution, the scripture reference, the landing point, or the illustrative story conclusion that gives the clip a satisfying close

A strong hook in sermon content typically looks like one of these:
- A bold theological claim ("Most Christians have misunderstood this verse their entire lives")
- A rhetorical question ("What does it actually mean to worship in spirit and in truth?")
- A moment of tension or conflict ("I was in the lowest point of my life when God said something that changed everything")
- A surprising reframe ("Praise is not what you do when things are good. Praise is a weapon.")

A strong payoff looks like one of these:
- A scripture drop that lands the point
- A story conclusion with emotional resolution
- A clear takeaway or call to action
- A moment of congregational response that amplifies the landing

Return only clips where the hook and payoff are both clearly present. Do not return moments that are only interesting in isolation. The clip must work as a standalone unit.

Return your response as a JSON array only. No preamble, no explanation, no markdown. Example format:

[
  {
    "start": "00:04:12",
    "end": "00:05:48",
    "hook": "One sentence describing what opens the clip and why it grabs attention",
    "payoff": "One sentence describing how the clip lands and why it satisfies"
  }
]

Timestamps must be in HH:MM:SS format derived from the segment start and end times in the transcript. Return between 8 and 12 candidates ordered by clip strength, strongest first.`;

function toHMS(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
}

function formatTranscript(segments) {
  return segments.map((seg) => `[${toHMS(seg.start)}] ${seg.text}`).join('\n');
}

async function callHaiku(transcript) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured in .env');

  const response = await axios.post(
    'https://api.anthropic.com/v1/messages',
    {
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: transcript }],
    },
    {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
    }
  );

  return response.data.content[0].text.trim();
}

function parseResponse(raw) {
  // Strip markdown fences if present
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  // Extract the JSON array by bracket bounds — tolerates preamble/postamble text
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start === -1 || end === -1 || end < start) {
    throw new Error('No JSON array found in response');
  }

  const candidates = JSON.parse(cleaned.slice(start, end + 1));
  if (!Array.isArray(candidates)) throw new Error('Response was not a JSON array');
  return candidates;
}

async function detectCandidates(segments) {
  const transcript = formatTranscript(segments);

  let raw;
  try {
    raw = await callHaiku(transcript);
  } catch (err) {
    throw new Error(`Haiku API error: ${err.response?.data?.error?.message || err.message}`);
  }

  console.log('[Detect] Haiku raw response:\n', raw);

  let candidates;
  try {
    candidates = parseResponse(raw);
  } catch (parseErr) {
    console.warn('[Detect] Parse failed on attempt 1:', parseErr.message);
    // Retry once
    try {
      raw = await callHaiku(transcript);
      console.log('[Detect] Haiku raw response (attempt 2):\n', raw);
      candidates = parseResponse(raw);
    } catch (err) {
      throw new Error(`Haiku returned malformed JSON on both attempts: ${err.message}`);
    }
  }

  if (candidates.length === 0) {
    console.warn('[Detect] Haiku returned 0 candidates. Full response was:\n', raw);
  } else {
    console.log(`[Detect] ${candidates.length} candidates parsed OK`);
  }

  return candidates;
}

router.post('/', async (req, res) => {
  const { segments } = req.body;

  if (!Array.isArray(segments) || segments.length === 0) {
    return res.status(400).json({ success: false, error: 'segments must be a non-empty array' });
  }

  try {
    const candidates = await detectCandidates(segments);
    res.json({ success: true, candidates });
  } catch (err) {
    console.error('[Detect]', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
module.exports.detectCandidates = detectCandidates;
