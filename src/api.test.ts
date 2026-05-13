import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api } from './api';

type FetchMock = ReturnType<typeof vi.fn>;

function mockResponse(body: string, init: { status?: number; ok?: boolean } = {}) {
  const status = init.status ?? 200;
  return {
    ok: init.ok ?? (status >= 200 && status < 300),
    status,
    text: () => Promise.resolve(body),
  } as unknown as Response;
}

describe('api request layer', () => {
  let fetchMock: FetchMock;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('parses JSON body on 2xx', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(JSON.stringify({ ok: true, value: 7 })));
    const result = await api.staffDevLogin('wash-staff-1');
    expect(result).toEqual({ ok: true, value: 7 });
  });

  it('sends Authorization header when token is provided', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(JSON.stringify({ items: [] })));
    await api.getProcessingQueue('TOKEN-XYZ');
    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    expect(headers.get('Authorization')).toBe('Bearer TOKEN-XYZ');
  });

  it('sends Content-Type application/json when body is present', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(JSON.stringify({})));
    await api.staffDevLogin('x');
    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(fetchMock.mock.calls[0][1].method).toBe('POST');
    expect(fetchMock.mock.calls[0][1].body).toBe(JSON.stringify({ staffId: 'x' }));
  });

  it('omits Content-Type for GET without body', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(JSON.stringify({ items: [] })));
    await api.getProcessingQueue('t');
    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    expect(headers.get('Content-Type')).toBeNull();
    expect(fetchMock.mock.calls[0][1].method).toBe('GET');
  });

  it('uses POST when method is forced even without body (scanStep)', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(JSON.stringify({ item: {}, processingState: {} })));
    await api.scanStep('t', 'TAG-1');
    expect(fetchMock.mock.calls[0][1].method).toBe('POST');
    expect(fetchMock.mock.calls[0][1].body).toBeUndefined();
  });

  describe('error handling', () => {
    it('throws ApiError with server message when payload has "message"', async () => {
      fetchMock.mockResolvedValueOnce(
        mockResponse(JSON.stringify({ message: '이미 처리된 아이템입니다', code: 'ALREADY_DONE' }), {
          status: 409,
        }),
      );

      await expect(api.scanStep('t', 'TAG-1')).rejects.toMatchObject({
        name: 'ApiError',
        status: 409,
        message: '이미 처리된 아이템입니다',
        details: { message: '이미 처리된 아이템입니다', code: 'ALREADY_DONE' },
      });
    });

    it('falls back to default Korean message when payload lacks message', async () => {
      fetchMock.mockResolvedValueOnce(mockResponse(JSON.stringify({ code: 'X' }), { status: 500 }));
      const err = await api.getProcessingQueue('t').catch((e) => e);
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).status).toBe(500);
      expect((err as ApiError).message).toBe('요청에 실패했어요. (500)');
    });

    it('handles non-JSON body without crashing parseJson', async () => {
      fetchMock.mockResolvedValueOnce(mockResponse('not json at all', { status: 502 }));
      const err = await api.getProcessingQueue('t').catch((e) => e);
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).status).toBe(502);
      expect((err as ApiError).message).toBe('요청에 실패했어요. (502)');
      expect((err as ApiError).details).toBe('not json at all');
    });

    it('handles empty body on error response', async () => {
      fetchMock.mockResolvedValueOnce(mockResponse('', { status: 401 }));
      const err = await api.getProcessingQueue('t').catch((e) => e);
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).status).toBe(401);
      expect((err as ApiError).details).toBeNull();
    });
  });
});
