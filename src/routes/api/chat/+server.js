// @ts-nocheck
import { GEMINI_API_KEY } from '$env/static/private';
import { json } from '@sveltejs/kit';
import { createSupabaseServerClient } from '$lib/server/supabase';

const GEMINI_MODEL = 'gemini-2.5-flash-lite';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

function normalizeSports(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((sport) => sport && typeof sport === 'object')
    .map((sport) => ({
      name: sport.name?.toString().trim() || '',
      regularity: sport.regularity?.toString().trim() || '',
      intensity: sport.intensity?.toString().trim() || ''
    }))
    .filter((sport) => sport.name);
}

function normalizeProblems(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => item?.toString().trim()).filter(Boolean);
}

function formatProfileContext(profile) {
  const sportsText = profile.sports.length
    ? profile.sports
        .map((sport) =>
          [sport.name, sport.regularity, sport.intensity].filter(Boolean).join(' | ')
        )
        .join('; ')
    : 'None listed';

  const problemsText = profile.problems.length ? profile.problems.join('; ') : 'None listed';

  return `User profile context:
Sports: ${sportsText}
Medical problems: ${problemsText}`;
}

const SYSTEM_PROMPT = `You are a helpful and empathetic medical assistant.
You provide clear, accurate general health information, as would a professional.
Always remind users to consult a qualified healthcare professional for personal medical decisions.
Never diagnose or prescribe. Keep responses concise and easy to understand.
If prompted to answer to non-health related questions, respond that you are not permitted to talk about non-medical / non-health related matters.
Use the saved profile context, especially medical problems and sports, whenever it is relevant to the answer.
Tell them the most likely general reasoning for the problem, and give a concise program of at most 5 steps. When exercises help, include brief YouTube search links.
Your max word limit is 100 words total.
`;

export async function POST({ request, locals }) {
  if (!locals.user) {
    return json({ message: 'You must be logged in to use the chat.' }, { status: 401 });
  }

  if (!GEMINI_API_KEY) {
    return json({ message: 'GEMINI_API_KEY is not configured.' }, { status: 500 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ message: 'Invalid JSON body.' }, { status: 400 });
  }

  const { history = [], message } = body;

  if (!message || typeof message !== 'string') {
    return json({ message: 'Missing or invalid "message" field.' }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  const { data: attributes, error: profileError } = await supabase
    .from('user_attributes')
    .select('sports, problems')
    .eq('id', locals.user.id)
    .maybeSingle();

  if (profileError) {
    console.error('Profile context lookup failed:', profileError);
  }

  const profileContext = formatProfileContext({
    sports: normalizeSports(attributes?.sports),
    problems: normalizeProblems(attributes?.problems)
  });

  const contents = [
    {
      role: 'user',
      parts: [{ text: profileContext }]
    },
    ...history.map((msg) => ({
      role: msg.role === 'ai' ? 'model' : 'user',
      parts: [{ text: msg.text }]
    })),
    { role: 'user', parts: [{ text: message }] }
  ];

  let geminiRes;
  try {
    geminiRes = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': GEMINI_API_KEY
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: SYSTEM_PROMPT }]
        },
        contents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024
        }
      })
    });
  } catch (fetchErr) {
    return json({ message: 'Failed to reach Gemini API.' }, { status: 502 });
  }

  if (!geminiRes.ok) {
    const errText = await geminiRes.text();
    console.error('Gemini error:', errText);

    let message = `Gemini API error: ${geminiRes.statusText}`;

    try {
      const parsed = JSON.parse(errText);
      message = parsed?.error?.message?.trim() || message;
    } catch {
      if (errText.trim()) {
        message = errText.trim();
      }
    }

    return json({ message }, { status: geminiRes.status });
  }

  const data = await geminiRes.json();
  const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? 'No response from Gemini.';

  return json({ reply });
}
