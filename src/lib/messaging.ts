import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

export const MESSAGE_SUBMISSIONS_FILE_PATH = resolve(process.cwd(), 'data', 'message-submissions.ndjson');
export const MESSAGE_TRIAGE_ACTIONS_FILE_PATH = resolve(process.cwd(), 'data', 'message-triage-actions.ndjson');
export const MESSAGE_REPORTS_FILE_PATH = resolve(process.cwd(), 'data', 'message-reports.ndjson');
export const MESSAGE_READ_STATE_FILE_PATH = resolve(process.cwd(), 'data', 'message-read-state.ndjson');
export const MESSAGE_VISIBILITY_FILE_PATH = resolve(process.cwd(), 'data', 'message-visibility-actions.ndjson');

export interface MessageSubmission {
  id: string;
  threadId: string;
  professionalSlug: string;
  senderName: string;
  senderEmail: string;
  senderPhone?: string;
  recipientEmail: string;
  message: string;
  status: 'pending';
  submittedAt: string;
}

export interface MessageReadState {
  threadId: string;
  viewerEmail: string;
  lastReadAt: string;
}

export const clean = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
export const max = (value: string, limit: number) => value.slice(0, limit);

export const readNdjson = async <T>(path: string): Promise<T[]> => {
  try {
    const raw = await readFile(path, 'utf-8');
    return raw
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as T);
  } catch {
    return [];
  }
};

export const writeNdjson = async <T>(path: string, values: T[]) => {
  await mkdir(dirname(path), { recursive: true });
  const body = values.map((value) => JSON.stringify(value)).join('\n');
  await writeFile(path, body ? `${body}\n` : '', 'utf-8');
};

export const appendNdjson = async (path: string, value: unknown) => {
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, `${JSON.stringify(value)}\n`, 'utf-8');
};

export const normalizeThreadId = (professionalSlug: string, customerEmail: string) =>
  `${professionalSlug}|${customerEmail.toLowerCase()}`;

export const getParticipantSet = (messages: MessageSubmission[]) => {
  const participants = new Set<string>();
  for (const message of messages) {
    participants.add(message.senderEmail.toLowerCase());
    participants.add(message.recipientEmail.toLowerCase());
  }
  return participants;
};
