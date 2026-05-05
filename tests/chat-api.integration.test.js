// @ts-nocheck
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const maybeSingle = vi.fn();
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  const createSupabaseServerClient = vi.fn(() => ({ from }));

  return {
    maybeSingle,
    eq,
    select,
    from,
    createSupabaseServerClient
  };
});

vi.mock('$env/dynamic/private', () => ({
  env: {
    GEMINI_API_KEY: 'test-gemini-key'
  }
}));

vi.mock('$lib/server/supabase', () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient
}));

import { POST } from '../src/routes/api/chat/+server.js';

const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

async function postToChat(body, overrides = {}) {
  const request = new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  return POST({
    request,
    locals: {
      user: { id: 'user-123' },
      ...overrides.locals
    }
  });
}

describe('POST /api/chat', () => {
  let fetchMock;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
  });

  it('returns 400 when the request contains no text message', async () => {
    const response = await postToChat({
      message: '',
      history: []
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      message: 'Missing or invalid "message" field.'
    });
    expect(mocks.createSupabaseServerClient).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('asks for clarifying details when a basic message is sent without selected body parts', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));

    const response = await postToChat({
      message: 'I am in pain',
      history: []
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.fallback).toBe(true);
    expect(data.reply).toContain('where exactly the pain is');
    expect(data.reply).toContain('how it started or what triggered it');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('asks for follow-up context when only selected body parts are provided without extra user text', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));

    const response = await postToChat({
      message: 'Area of pain: left knee; right ankle',
      history: []
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.fallback).toBe(true);
    expect(data.reply).not.toContain('where exactly the pain is');
    expect(data.reply).toContain('how it started or what triggered it');
    expect(data.reply).toContain('when it started');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
