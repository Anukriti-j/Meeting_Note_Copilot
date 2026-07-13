const BASE = '';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, options);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(body.detail || `Request failed: ${res.status}`);
  }
  return res.json();
}

export interface MeetingSummary {
  meeting_id: string;
  summary: string;
  decisions: string[];
  action_items: { owner: string; task: string; due_date: string | null }[];
  transcript?: string;
  run_id?: string;
}

export interface Meeting {
  meeting_id: string;
  num_action_items: number;
  has_action_file: boolean;
}

export interface MeetingDetail {
  meeting_id: string;
  action_items: string[];
  action_file: string | null;
}

export interface QAHit {
  text: string;
  similarity: number;
  meeting_id: string;
  chunk_type: string;
  date: string;
}

export interface QAResponse {
  ok: boolean;
  answer: string;
  citations: string[];
  hits: QAHit[];
}

export interface ActionItemFile {
  meeting_id: string;
  filename: string;
  content: string;
}

export interface IngestResponse {
  ok: boolean;
  summary: MeetingSummary;
}

export interface SeedResponse {
  ok: boolean;
  seeded: number;
  results: { meeting_id: string; ok: boolean; error?: string }[];
}

export interface LogEntry {
  run_id: string;
  stage: string;
  [key: string]: unknown;
}

export const api = {
  health: () => request<{ status: string }>('/api/health'),

  listMeetings: () => request<{ meetings: Meeting[] }>('/api/meetings'),

  getMeeting: (id: string) => request<MeetingDetail>(`/api/meetings/${id}`),

  ingestText: (transcript: string, meetingId: string, meetingDate?: string) => {
    const fd = new FormData();
    fd.append('transcript', transcript);
    fd.append('meeting_id', meetingId);
    if (meetingDate) fd.append('meeting_date', meetingDate);
    return request<IngestResponse>('/api/ingest/text', { method: 'POST', body: fd });
  },

  ingestAudio: (file: File, meetingId: string, meetingDate?: string) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('meeting_id', meetingId);
    if (meetingDate) fd.append('meeting_date', meetingDate);
    return request<IngestResponse>('/api/ingest/audio', { method: 'POST', body: fd });
  },

  seed: () => request<SeedResponse>('/api/seed', { method: 'POST' }),

  ask: (question: string, topK?: number) => {
    const fd = new FormData();
    fd.append('question', question);
    if (topK !== undefined) fd.append('top_k', String(topK));
    return request<QAResponse>('/api/ask', { method: 'POST', body: fd });
  },

  // Streams the answer over a WebSocket -- one connection per question, calling onDelta
  // as each chunk of text arrives, resolving with the final citations/hits once the
  // server sends its "done" message and closes the socket.
  askStream: (
    question: string,
    onDelta: (delta: string) => void,
    topK?: number,
  ): Promise<{ citations: string[]; hits: QAHit[] }> => {
    return new Promise((resolve, reject) => {
      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(`${protocol}://${window.location.host}/ws/ask`);
      let result: { citations: string[]; hits: QAHit[] } = { citations: [], hits: [] };
      let settled = false;

      ws.onopen = () => {
        ws.send(JSON.stringify({ question, top_k: topK }));
      };

      ws.onmessage = (event) => {
        const payload = JSON.parse(event.data);
        if (payload.error) {
          settled = true;
          reject(new Error(payload.error));
          ws.close();
          return;
        }
        if (payload.delta) onDelta(payload.delta);
        if (payload.done) {
          result = { citations: payload.citations, hits: payload.hits };
          ws.close();
        }
      };

      ws.onerror = () => {
        if (!settled) {
          settled = true;
          reject(new Error('WebSocket connection error'));
        }
      };

      ws.onclose = () => {
        if (!settled) {
          settled = true;
          resolve(result);
        }
      };
    });
  },

  runAgent: (meetingId: string, autoApprove = true) => {
    const fd = new FormData();
    fd.append('auto_approve', String(autoApprove));
    return request<{ ok: boolean; result: string }>(`/api/agent/${meetingId}`, {
      method: 'POST',
      body: fd,
    });
  },

  listActionItems: () => request<{ action_items: ActionItemFile[] }>('/api/action-items'),

  listCalendar: () => request<{ events: { filename: string; content: string }[] }>('/api/calendar'),

  // Only meaningful when frontend + backend run on the same machine (true for this
  // local app) -- asks the backend to `open` the .ics file itself, which hands off to
  // Calendar.app directly instead of the browser downloading it to Downloads first.
  openCalendarEvent: (filename: string) =>
    request<{ ok: boolean }>(`/api/calendar/${encodeURIComponent(filename)}/open`, { method: 'POST' }),

  getLogs: () => request<{ logs: LogEntry[] }>('/api/logs'),
};
