// @ts-nocheck
import { GEMINI_API_KEY } from '$env/static/private';
import { json } from '@sveltejs/kit';
import { createSupabaseServerClient } from '$lib/server/supabase';

const GEMINI_MODEL = 'gemini-3-flash-preview';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const GEMINI_RETRY_LIMIT = 1;
const GEMINI_TIMEOUT_MS = 12000;
const NONSENSE_REPLY =
  "I'm only able to respond to medical inquiries, please try to ask something related to your medical problems, pains.";

const MEDICAL_KEYWORDS = [
  'ache',
  'aching',
  'allergy',
  'ankle',
  'arm',
  'asthma',
  'back',
  'blood',
  'bone',
  'breath',
  'breathing',
  'burn',
  'chest',
  'cold',
  'cough',
  'cramp',
  'cut',
  'dizzy',
  'ear',
  'elbow',
  'exercise',
  'fever',
  'foot',
  'fracture',
  'head',
  'headache',
  'health',
  'heart',
  'hip',
  'hurt',
  'injury',
  'itch',
  'knee',
  'leg',
  'medical',
  'medicine',
  'migraine',
  'muscle',
  'nausea',
  'neck',
  'pain',
  'physical',
  'recovery',
  'shoulder',
  'sick',
  'skin',
  'sore',
  'spine',
  'sprain',
  'stomach',
  'swelling',
  'symptom',
  'temperature',
  'therapy',
  'throat',
  'treatment',
  'vomit',
  'wound'
];

function tokenizeText(value) {
  return value.toLowerCase().match(/[a-z]+/g) ?? [];
}

function hasMedicalKeyword(tokens) {
  return tokens.some((token) => MEDICAL_KEYWORDS.some((keyword) => token.includes(keyword)));
}

function isLikelyGibberishToken(token) {
  if (token.length <= 2) {
    return false;
  }

  if (/^([a-z])\1+$/.test(token)) {
    return true;
  }

  const vowels = token.match(/[aeiouy]/g)?.length ?? 0;
  const vowelRatio = vowels / token.length;

  if (token.length >= 4 && vowels === 0) {
    return true;
  }

  if (token.length >= 5 && vowelRatio < 0.2) {
    return true;
  }

  return /[bcdfghjklmnpqrstvwxyz]{5,}/.test(token);
}

function isCompleteNonsense(message) {
  const normalized = message.toLowerCase().trim();
  if (!normalized) {
    return true;
  }

  const tokens = tokenizeText(normalized);
  if (tokens.length === 0) {
    return true;
  }

  if (hasMedicalKeyword(tokens)) {
    return false;
  }

  const longTokens = tokens.filter((token) => token.length >= 3);
  if (longTokens.length === 0) {
    return true;
  }

  return longTokens.every(isLikelyGibberishToken);
}

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

function detectEmergencySignal(message) {
  const text = message.toLowerCase();

  return [
    'chest pain',
    'trouble breathing',
    'shortness of breath',
    'can’t breathe',
    'cant breathe',
    'stroke',
    'face drooping',
    'slurred speech',
    'seizure',
    'fainted',
    'passed out',
    'severe bleeding',
    'heavy bleeding',
    'suicidal'
  ].some((pattern) => text.includes(pattern));
}

function detectBodyArea(message) {
  const text = message.toLowerCase();
  const matches = [
    ['head', ['head', 'headache', 'migraine', 'concussion']],
    ['neck', ['neck']],
    ['chest', ['chest', 'rib']],
    ['shoulder', ['shoulder', 'collarbone']],
    ['back', ['back', 'spine', 'lower back', 'upper back']],
    ['arm', ['arm', 'elbow', 'wrist', 'hand']],
    ['leg', ['leg', 'thigh', 'calf', 'hamstring', 'quad']],
    ['knee', ['knee']],
    ['ankle', ['ankle', 'foot', 'heel', 'toe']],
    ['stomach', ['stomach', 'abdomen', 'belly', 'nausea', 'vomit']],
    ['skin', ['skin', 'rash', 'itch', 'cut', 'burn']]
  ];

  for (const [area, keywords] of matches) {
    if (keywords.some((keyword) => text.includes(keyword))) {
      return area;
    }
  }

  return 'musculoskeletal';
}

function buildFallbackMedicalReply(message, profile) {
  if (detectEmergencySignal(message)) {
    return 'This may need urgent medical assessment. Seek emergency care now, especially if symptoms are severe, worsening, or affecting breathing, speech, consciousness, or heavy bleeding. Stop activity and get in-person help immediately.';
  }

  const area = detectBodyArea(message);
  const sportLine = profile.sports.length
    ? 'Pause intense training until symptoms clearly improve.'
    : 'Avoid movements that make it worse.';

  return `This sounds like a possible ${area} issue. Rest for 24-48 hours, use ice if swollen or sharply painful, keep only gentle pain-free movement, and monitor symptoms closely. ${sportLine} Book a clinician or physiotherapist if it lasts more than a few days or worsens. Seek urgent care for fever, numbness, weakness, severe swelling, chest pain, or trouble breathing.`;
}

function countUserTurns(history) {
  return history.filter((msg) => msg?.role === 'user').length + 1;
}

function hasMechanism(text) {
  return [
    'after',
    'during',
    'while',
    'when',
    'lift',
    'lifting',
    'running',
    'fell',
    'fall',
    'twisted',
    'hit',
    'injured',
    'workout',
    'training',
    'exercise'
  ].some((keyword) => text.includes(keyword));
}

function hasDuration(text) {
  return /\b(today|yesterday|day|days|week|weeks|month|months|hour|hours|since)\b/.test(text);
}

function hasSeverity(text) {
  return /(?:\b(mild|moderate|severe|sharp|dull|throbbing|burning|worse|pain scale)\b|\b\d{1,2}\s*\/\s*10\b|\b\d{1,2}\s+out of\s+10\b|\b(?:pain|severity|level)\s*(?:of|is|at)?\s*\d{1,2}\b)/.test(
    text
  );
}

function buildCombinedText(message, history) {
  return [...history, { role: 'user', text: message }]
    .map((msg) => msg.text?.toLowerCase?.() ?? '')
    .join(' ');
}

function hasRedFlagSymptoms(text) {
  return /\b(swelling|numbness|weakness|tingling|fever|bruising)\b/.test(text);
}

function wantsExerciseGuidance(text) {
  return /\b(stretch|stretches|exercise|exercises|physio|physiotherapy|mobility|rehab|rehabilitation|youtube|strengthen|strengthening)\b/.test(
    text
  );
}

function hasLowUrgencyQualifier(text) {
  return /\b(not super painful|not too painful|nothing serious|just sore|just tight|slight|minor|mild)\b/.test(
    text
  );
}

function getTriageState(message, history) {
  const combined = buildCombinedText(message, history);
  const bodyArea = detectBodyArea(combined);
  const hasExerciseIntent = wantsExerciseGuidance(combined);
  const severityKnown = hasSeverity(combined);
  const durationKnown = hasDuration(combined);
  const lowUrgency = hasLowUrgencyQualifier(combined);

  let markers = 0;
  if (hasMechanism(combined)) markers += 1;
  if (durationKnown) markers += 1;
  if (severityKnown) markers += 1;
  if (bodyArea !== 'musculoskeletal') markers += 1;
  if (hasRedFlagSymptoms(combined)) markers += 1;

  const enoughContext =
    markers >= 3 ||
    (bodyArea !== 'musculoskeletal' && hasExerciseIntent && (severityKnown || durationKnown)) ||
    (bodyArea !== 'musculoskeletal' && hasExerciseIntent && lowUrgency);

  return {
    combined,
    bodyArea,
    hasBodyArea: bodyArea !== 'musculoskeletal',
    hasMechanism: hasMechanism(combined),
    hasDuration: durationKnown,
    hasSeverity: severityKnown,
    hasRedFlags: hasRedFlagSymptoms(combined),
    wantsExerciseGuidance: hasExerciseIntent,
    hasLowUrgencyQualifier: lowUrgency,
    enoughContext
  };
}

function hasEnoughContext(message, history) {
  return getTriageState(message, history).enoughContext;
}

function buildClarifyingReply(message, history) {
  const triage = getTriageState(message, history);
  const prompts = [];

  if (!triage.hasBodyArea) {
    prompts.push('where exactly the pain is');
  }
  if (!triage.hasMechanism) {
    prompts.push('how it started or what triggered it');
  }
  if (!triage.hasDuration) {
    prompts.push('when it started');
  }
  if (!triage.hasSeverity) {
    prompts.push('how strong it is from 0-10');
  }
  if (!triage.hasRedFlags) {
    prompts.push('whether you have swelling, numbness, or weakness');
  }

  const primary = prompts.slice(0, 3);
  const secondary = prompts.slice(3, 5);

  let reply = 'I need a bit more detail before I can give a useful answer. Tell me ';
  if (primary.length === 1) {
    reply += `${primary[0]}.`;
  } else if (primary.length === 2) {
    reply += `${primary[0]} and ${primary[1]}.`;
  } else {
    reply += `${primary.slice(0, -1).join(', ')}, and ${primary.at(-1)}.`;
  }

  if (secondary.length > 0) {
    if (secondary.length === 1) {
      reply += `\n\nAlso tell me ${secondary[0]}.`;
    } else {
      reply += `\n\nAlso tell me ${secondary[0]} and ${secondary[1]}.`;
    }
  }

  reply +=
    '\n\nOnce I have that, I can give a clearer explanation of what may be going on, what to avoid, and whether gentle exercises or videos make sense.';

  if (shouldOfferYoutubeLinks(triage)) {
    const links = buildYoutubeLinks(triage.bodyArea);
    if (links.length) {
      reply += `\n\nUseful YouTube searches:\n${links.join('\n')}`;
    }
  }

  return reply;
}

function buildConversationGuidance(message, history) {
  const userTurnCount = countUserTurns(history);
  const triage = getTriageState(message, history);
  const enoughContext = triage.enoughContext;

  if (userTurnCount <= 2 && !enoughContext) {
    return `Conversation stage:
- This is early triage.
- If the user has already given enough information for safe, useful general guidance, answer directly instead of asking questions.
- Only ask 2 or 3 short clarifying questions if important details are still genuinely missing.
- Prioritize: exact body area, how it started, how long it has been present, pain severity, what movements make it worse, and any numbness/weakness/swelling.
- Keep the total response concise and ideally under or around 150 words, unless urgent symptoms require a shorter warning.
- If the user explicitly asks for exercises or videos and the body area is already clear, you may add 1 or 2 YouTube search links after the questions.
- Format the reply as 1 or 2 short paragraphs, not one long block.`;
  }

  return `Conversation stage:
- Enough context is available, or this is at least the third user message.
- Give a concise response with:
1. the most likely general explanation
2. up to 5 practical steps
3. 2 or 3 YouTube search links for relevant physio or mobility exercises
- Aim for a concise response that stays under or around 150 words while still being useful.
- Remind the user to seek in-person care if red-flag symptoms are present.
- Format the reply in short paragraphs with blank lines between sections.`;
}

function buildYoutubeLinks(area) {
  const queriesByArea = {
    head: [],
    neck: [
      'https://www.youtube.com/results?search_query=physio+neck+mobility+exercises',
      'https://www.youtube.com/results?search_query=upper+trap+stretch+physiotherapy'
    ],
    chest: [
      'https://www.youtube.com/results?search_query=thoracic+mobility+physio+exercises',
      'https://www.youtube.com/results?search_query=pec+stretch+physiotherapy'
    ],
    shoulder: [
      'https://www.youtube.com/results?search_query=shoulder+physio+exercises+rotator+cuff',
      'https://www.youtube.com/results?search_query=scapular+stability+physiotherapy'
    ],
    back: [
      'https://www.youtube.com/results?search_query=lower+back+physio+mobility+exercises',
      'https://www.youtube.com/results?search_query=mcgill+big+3+back+exercise'
    ],
    arm: [
      'https://www.youtube.com/results?search_query=wrist+and+elbow+physio+exercises',
      'https://www.youtube.com/results?search_query=forearm+tendon+glide+exercises'
    ],
    leg: [
      'https://www.youtube.com/results?search_query=hamstring+and+quad+physio+exercises',
      'https://www.youtube.com/results?search_query=hip+mobility+physiotherapy'
    ],
    knee: [
      'https://www.youtube.com/results?search_query=knee+physio+exercises+patellofemoral',
      'https://www.youtube.com/results?search_query=vmo+strengthening+physiotherapy'
    ],
    ankle: [
      'https://www.youtube.com/results?search_query=ankle+sprain+physio+exercises',
      'https://www.youtube.com/results?search_query=ankle+mobility+physiotherapy'
    ],
    stomach: [],
    skin: [],
    musculoskeletal: [
      'https://www.youtube.com/results?search_query=gentle+physio+mobility+routine',
      'https://www.youtube.com/results?search_query=injury+recovery+mobility+exercises'
    ]
  };

  return queriesByArea[area] ?? queriesByArea.musculoskeletal;
}

function shouldOfferYoutubeLinks(triage) {
  return triage.wantsExerciseGuidance && triage.hasBodyArea && !triage.hasRedFlags;
}

function buildFallbackTriageReply(message, history) {
  if (detectEmergencySignal(message)) {
    return 'This may need urgent medical assessment.\n\nSeek emergency care now, especially if symptoms are severe, worsening, or affecting breathing, speech, consciousness, or heavy bleeding. Stop activity and get in-person help immediately.';
  }

  return buildClarifyingReply(message, history);
}

const SYSTEM_PROMPT = `You are a helpful and empathetic medical assistant.
You provide clear, accurate general health information, as would a professional.
Always remind users to consult a qualified healthcare professional for personal medical decisions.
Never diagnose or prescribe. Keep responses easy to understand.
If prompted to answer to non-health related questions, respond that you are not permitted to talk about non-medical / non-health related matters.
Use the saved profile context, especially medical problems and sports, whenever it is relevant to the answer.
When enough context is available, tell them the most likely general reasoning for the problem and give a concise program of at most 5 steps. When exercises or rehab ideas are relevant, include 1 to 3 brief YouTube search links.
If the user explicitly asks for videos or exercises before full context is available, you may still include 1 or 2 general YouTube search links after asking clarifying questions, as long as the body area is clear and there are no red-flag symptoms.
Do not rush into an exercise plan before you understand the problem reasonably well.
Keep replies concise and usually under or around 150 words unless a shorter urgent warning is more appropriate.
If you already have enough information for safe general guidance, reply directly and do not ask unnecessary clarifying questions.
Ask follow-up questions only when the missing details materially affect safe guidance.
Format replies as short paragraphs with blank lines between sections.
If the user provides a specific question, answer it concisely without unnecessary information.
`;

function getGeminiFailureMessage(status) {
  if (status === 400) {
    return 'The medical assistant request was rejected. Please try rephrasing your question.';
  }

  if (status === 401 || status === 403) {
    return 'The medical assistant is not configured correctly on this deployment.';
  }

  if (status === 429) {
    return 'The medical assistant is busy right now. Please try again in a moment.';
  }

  if (status >= 500) {
    return 'The medical assistant is temporarily unavailable. Please try again.';
  }

  return 'The medical assistant could not answer right now. Please try again.';
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRetryDelayMs(response, attempt) {
  const retryAfter = response.headers.get('retry-after');
  const retryAfterSeconds = Number.parseInt(retryAfter ?? '', 10);

  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    return Math.min(retryAfterSeconds * 1000, 5000);
  }

  return 250 * 2 ** attempt;
}

function isRetryableStatus(status) {
  return status === 500 || status === 502 || status === 503 || status === 504;
}

export async function POST({ request, locals }) {
  if (!locals.user) {
    return json({ message: 'You must be logged in to use the chat.' }, { status: 401 });
  }

  if (!GEMINI_API_KEY) {
    return json({ message: 'The medical assistant is temporarily unavailable.' }, { status: 500 });
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

  if (isCompleteNonsense(message)) {
    return json({ reply: NONSENSE_REPLY });
  }

  if (detectEmergencySignal(message)) {
    return json({ reply: buildFallbackTriageReply(message, history), triage: true });
  }

  const supabase = createSupabaseServerClient();
  const { data: attributes, error: profileError } = await supabase
    .from('user_attributes')
    .select('sports, problems')
    .eq('id', locals.user.id)
    .maybeSingle();

  if (profileError) {
    console.error('Profile context lookup failed');
  }

  const profile = {
    sports: normalizeSports(attributes?.sports),
    problems: normalizeProblems(attributes?.problems)
  };

  const profileContext = formatProfileContext(profile);
  const conversationGuidance = buildConversationGuidance(message, history);

  const contents = [
    {
      role: 'user',
      parts: [{ text: profileContext }]
    },
    {
      role: 'user',
      parts: [{ text: conversationGuidance }]
    },
    ...history.map((msg) => ({
      role: msg.role === 'ai' ? 'model' : 'user',
      parts: [{ text: msg.text }]
    })),
    { role: 'user', parts: [{ text: message }] }
  ];

  const geminiRequestBody = JSON.stringify({
    systemInstruction: {
      parts: [{ text: SYSTEM_PROMPT }]
    },
    contents,
    generationConfig: {
      temperature: 1.0
    }
  });

  let geminiRes;
  for (let attempt = 0; attempt <= GEMINI_RETRY_LIMIT; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

    try {
      geminiRes = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': GEMINI_API_KEY
        },
        body: geminiRequestBody,
        signal: controller.signal
      });
    } catch (fetchErr) {
      clearTimeout(timeoutId);
      console.error('Gemini network error:', fetchErr);

      if (attempt === GEMINI_RETRY_LIMIT) {
        return json({ reply: buildFallbackTriageReply(message, history), fallback: true });
      }

      await sleep(200 * 2 ** attempt);
      continue;
    }

    clearTimeout(timeoutId);

    if (geminiRes.ok || !isRetryableStatus(geminiRes.status) || attempt === GEMINI_RETRY_LIMIT) {
      break;
    }

    const retryBody = await geminiRes.text();
    console.error(
      `Gemini request failed with status ${geminiRes.status} on attempt ${attempt + 1}: ${retryBody}`
    );
    await sleep(getRetryDelayMs(geminiRes, attempt));
  }

  if (!geminiRes.ok) {
    const errorBody = await geminiRes.text();
    console.error(`Gemini request failed with status ${geminiRes.status}: ${errorBody}`);

    if (geminiRes.status === 429 || isRetryableStatus(geminiRes.status)) {
      return json({ reply: buildFallbackTriageReply(message, history), fallback: true });
    }

    return json(
      { message: getGeminiFailureMessage(geminiRes.status) },
      { status: geminiRes.status }
    );
  }

  const data = await geminiRes.json();
  const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? 'No response from Gemini.';

  return json({ reply });
}
