import { readdir, readFile, stat } from 'node:fs/promises';
import { basename, extname, resolve } from 'node:path';

const DATA_DIR = resolve(process.cwd(), 'data');
const LEADS_DIR = resolve(DATA_DIR, 'leads');
const CATEGORIES_PATH = resolve(DATA_DIR, 'categories.json');
const SUMMARY_FILE_PATTERN = /(lead.*summary|summary.*lead)/i;

type JsonRecord = Record<string, unknown>;

export interface AdminLead {
  id: string;
  categorySlug: string;
  categoryLabel: string;
  name: string;
  phone: string;
  email: string;
  city: string;
  status: string;
  score: number | null;
  newestTs: number;
  sourceUrl: string;
}

export interface LeadSummaryData {
  totalLeads: number | null;
  byCategory: Record<string, number>;
  lastUpdated: string | null;
  path: string;
}

export interface LeadCategoryOption {
  slug: string;
  label: string;
  count: number;
}

export interface AdminLeadsDirectoryData {
  leads: AdminLead[];
  categories: LeadCategoryOption[];
  cities: string[];
  statuses: string[];
  summary: LeadSummaryData | null;
  totalLeads: number;
}

const clean = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const safeNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const toTimestamp = (value: unknown): number | null => {
  if (typeof value !== 'string') return null;
  const ts = Date.parse(value);
  return Number.isFinite(ts) ? ts : null;
};

const slugToTitle = (slug: string) =>
  slug
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const normalizeStatus = (value: string) => {
  const normalized = value
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
    .replace(/[^\p{L}\p{N}-]/gu, '');
  return normalized || 'new';
};

const isObject = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readJson = async (filePath: string): Promise<unknown | null> => {
  try {
    const raw = await readFile(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const isSummaryShape = (value: unknown): value is JsonRecord => {
  if (!isObject(value)) return false;
  if (typeof value.totalLeads === 'number') return true;
  if (isObject(value.byCategory)) return true;
  if (typeof value.lastUpdated === 'string') return true;
  return false;
};

const parseSummary = (value: JsonRecord, filePath: string): LeadSummaryData => {
  const totalLeads = typeof value.totalLeads === 'number' && Number.isFinite(value.totalLeads) ? value.totalLeads : null;
  const byCategoryInput = isObject(value.byCategory) ? value.byCategory : {};
  const byCategoryEntries = Object.entries(byCategoryInput).filter((entry): entry is [string, number] => {
    const [, count] = entry;
    return typeof count === 'number' && Number.isFinite(count);
  });

  return {
    totalLeads,
    byCategory: Object.fromEntries(byCategoryEntries),
    lastUpdated: typeof value.lastUpdated === 'string' ? value.lastUpdated : null,
    path: filePath
  };
};

const getSummaryCandidates = async () => {
  const candidates = new Set<string>([
    resolve(DATA_DIR, 'leads-summary.json'),
    resolve(LEADS_DIR, 'leads-summary.json')
  ]);

  for (const directory of [DATA_DIR, LEADS_DIR]) {
    try {
      const entries = await readdir(directory, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile() || extname(entry.name) !== '.json') continue;
        if (!SUMMARY_FILE_PATTERN.test(entry.name)) continue;
        candidates.add(resolve(directory, entry.name));
      }
    } catch {
      // Directory might be missing in some environments.
    }
  }

  return Array.from(candidates);
};

export const detectLeadSummary = async (): Promise<LeadSummaryData | null> => {
  const candidates = await getSummaryCandidates();
  for (const candidatePath of candidates) {
    const parsed = await readJson(candidatePath);
    if (!parsed || !isSummaryShape(parsed)) continue;
    return parseSummary(parsed, candidatePath);
  }
  return null;
};

const getCategoryNameMap = async () => {
  const parsed = await readJson(CATEGORIES_PATH);
  if (!Array.isArray(parsed)) return new Map<string, string>();

  const map = new Map<string, string>();
  for (const entry of parsed) {
    if (!isObject(entry)) continue;
    const slug = clean(entry.slug);
    const nameGr = clean(entry.nameGr);
    if (!slug) continue;
    map.set(slug, nameGr || slugToTitle(slug));
  }
  return map;
};

const listLeadFiles = async () => {
  try {
    const entries = await readdir(LEADS_DIR, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && extname(entry.name) === '.json')
      .map((entry) => resolve(LEADS_DIR, entry.name));
  } catch {
    return [];
  }
};

export const getAdminLeadsOverview = async () => {
  const summary = await detectLeadSummary();
  if (summary?.totalLeads !== null) {
    return { totalLeads: summary.totalLeads, summary };
  }

  const leadFiles = await listLeadFiles();
  let totalLeads = 0;

  for (const filePath of leadFiles) {
    const parsed = await readJson(filePath);
    if (!Array.isArray(parsed)) continue;
    totalLeads += parsed.length;
  }

  return { totalLeads, summary };
};

export const loadAdminLeadsDirectoryData = async (): Promise<AdminLeadsDirectoryData> => {
  const [summary, categoryNameMap, leadFiles] = await Promise.all([
    detectLeadSummary(),
    getCategoryNameMap(),
    listLeadFiles()
  ]);

  const leadFilesWithMeta = await Promise.all(
    leadFiles.map(async (filePath) => {
      const fileStat = await stat(filePath).catch(() => ({ mtimeMs: 0 }));
      return { filePath, mtimeMs: fileStat.mtimeMs };
    })
  );

  leadFilesWithMeta.sort((a, b) => b.mtimeMs - a.mtimeMs);

  const leads: AdminLead[] = [];
  const categoryCounts = new Map<string, number>();
  const cities = new Set<string>();
  const statuses = new Set<string>();

  for (const fileInfo of leadFilesWithMeta) {
    const parsed = await readJson(fileInfo.filePath);
    if (!Array.isArray(parsed)) continue;

    const categorySlug = basename(fileInfo.filePath, '.json');
    const categoryLabel = categoryNameMap.get(categorySlug) || slugToTitle(categorySlug);

    parsed.forEach((entry, index) => {
      if (!isObject(entry)) return;

      const name =
        clean(entry.name) ||
        clean(entry.businessName) ||
        clean(entry.companyName) ||
        clean(entry.title) ||
        'Χωρίς όνομα';
      const phone = clean(entry.phone);
      const email = clean(entry.email);
      const city = clean(entry.city) || 'Άγνωστη πόλη';
      const status = normalizeStatus(clean(entry.status) || 'new');
      const score = safeNumber(entry.score);
      const sourceUrl = clean(entry.url) || clean(entry.sourceUrl) || (clean(entry.source).startsWith('http') ? clean(entry.source) : '');
      const newestTs =
        toTimestamp(entry.submittedAt) ??
        toTimestamp(entry.createdAt) ??
        toTimestamp(entry.updatedAt) ??
        toTimestamp(entry.lastUpdated) ??
        fileInfo.mtimeMs - index;

      const leadId = `${categorySlug}:${index}:${phone || email || name}`;

      leads.push({
        id: leadId,
        categorySlug,
        categoryLabel,
        name,
        phone,
        email,
        city,
        status,
        score,
        newestTs,
        sourceUrl
      });

      categoryCounts.set(categorySlug, (categoryCounts.get(categorySlug) || 0) + 1);
      cities.add(city);
      statuses.add(status);
    });
  }

  leads.sort((a, b) => b.newestTs - a.newestTs);

  const categoryMap = new Map<string, string>();
  for (const lead of leads) {
    if (!categoryMap.has(lead.categorySlug)) categoryMap.set(lead.categorySlug, lead.categoryLabel);
  }

  const categories = Array.from(categoryMap.entries())
    .map(([slug, label]) => ({
      slug,
      label,
      count: categoryCounts.get(slug) || 0
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'el'));

  return {
    leads,
    categories,
    cities: Array.from(cities).sort((a, b) => a.localeCompare(b, 'el')),
    statuses: Array.from(statuses).sort((a, b) => a.localeCompare(b, 'el')),
    summary,
    totalLeads: summary?.totalLeads ?? leads.length
  };
};
