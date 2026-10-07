import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePrepSetups } from './usePrepSetups';
import type { InterviewSetup } from '../types/interviewSetup';

describe('usePrepSetups', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads the server list, saves a new setup, then deletes it', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

      if (url === '/api/prep-setups' && (!init || init.method === 'GET')) {
        return {
          ok: true,
          status: 200,
          json: async () => [],
        } as Response;
      }

      if (url === '/api/prep-setups' && init?.method === 'POST') {
        return {
          ok: true,
          status: 201,
          json: async () => ({
            id: 'server-id-1',
            company: 'Contoso',
            role: 'Platform Engineer',
            interviewType: 'technical',
            interviewTypeOther: '',
            jobDescription: 'Build the platform.',
            jobDescriptionUrl: 'https://example.com',
            instructions: 'Use examples.',
            resumeFileName: 'resume.pdf',
            resumeText: 'Led a migration.',
          }),
        } as Response;
      }

      if (url === '/api/prep-setups/server-id-1' && init?.method === 'DELETE') {
        return { ok: true, status: 204 } as Response;
      }

      throw new Error(`Unexpected fetch call: ${url} ${init?.method ?? 'GET'}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => usePrepSetups());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const newSetup: InterviewSetup = {
      id: 'local-id-1',
      company: 'Contoso',
      role: 'Platform Engineer',
      interviewType: 'technical',
      interviewTypeOther: undefined,
      jobDescription: 'Build the platform.',
      jobDescriptionUrl: 'https://example.com',
      instructions: 'Use examples.',
      resumeFileName: 'resume.pdf',
      resumeText: 'Led a migration.',
    };

    await act(async () => {
      const saveResult = await result.current.saveSetup(newSetup);
      expect(saveResult.status).toBe('saved');
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/prep-setups',
      expect.objectContaining({ method: 'POST' }),
    );

    await act(async () => {
      const deleteResult = await result.current.deleteSetup({
        ...newSetup,
        id: 'server-id-1',
      });
      expect(deleteResult.status).toBe('deleted');
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/prep-setups/server-id-1',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('skips duplicate local imports after a successful import', async () => {
    const localSetup: InterviewSetup = {
      id: 'legacy-id-1',
      company: 'Legacy Co',
      role: 'Designer',
      interviewType: 'behavioral',
      interviewTypeOther: undefined,
      jobDescription: '',
      jobDescriptionUrl: '',
      instructions: 'Show initiative.',
      resumeFileName: '',
      resumeText: 'Solved customer issues.',
    };

    localStorage.setItem('interview-prep-setups-v2', JSON.stringify([localSetup]));

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

      if (url === '/api/prep-setups' && (!init || init.method === 'GET')) {
        return {
          ok: true,
          status: 200,
          json: async () => [],
        } as Response;
      }

      if (url === '/api/prep-setups' && init?.method === 'POST') {
        return {
          ok: true,
          status: 201,
          json: async () => ({
            ...localSetup,
            id: 'server-imported-1',
            interviewType: 'behavioral',
          }),
        } as Response;
      }

      throw new Error(`Unexpected fetch call: ${url} ${init?.method ?? 'GET'}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => usePrepSetups());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      const importResult = await result.current.importLocalSetups();
      expect(importResult.status).toBe('imported');
    });

    await act(async () => {
      const secondImport = await result.current.importLocalSetups();
      expect(secondImport.status).toBe('skipped');
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
