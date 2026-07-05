// API client with DEMO -> LIVE fallback. Every call falls back to embedded
// mock data when the backend is unreachable, so the UI works offline.
import * as MOCK from './mockData.js';

const BASE = import.meta.env.VITE_API_BASE || '/api';
let LIVE = null; // null=unknown, true/false after probe

export async function probeApi() {
  try {
    const r = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(2500) });
    LIVE = r.ok;
  } catch {
    LIVE = false;
  }
  return LIVE;
}

export function isLive() { return LIVE === true; }

// preserve project_id across calls when present in the URL
function projParam() {
  const p = new URLSearchParams(window.location.search).get('project');
  return p ? `project_id=${encodeURIComponent(p)}` : '';
}

async function get(path, mockFn) {
  // NOTE: we do NOT permanently latch to mock mode on a single failure.
  // A transient timeout/slow query must not turn the whole app "empty" for
  // the rest of the session. Each call attempts the network again; only if
  // it fails do we fall back to mock for THAT call.
  try {
    const sep = path.includes('?') ? '&' : '?';
    const pp = projParam();
    const url = `${BASE}${path}${pp ? sep + pp : ''}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    LIVE = true;
    return await r.json();
  } catch {
    // keep LIVE as-is (a slow call shouldn't flip the badge); fall back once.
    return mockFn();
  }
}

async function post(path, body, mockFn, method = 'POST') {
  try {
    const r = await fetch(`${BASE}${path}`, {
      method, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    LIVE = true;
    return await r.json();
  } catch (e) {
    return mockFn ? mockFn() : { ok: false, error: String(e) };
  }
}

export const api = {
  search: (q, project_id) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (project_id && project_id !== 'all') params.set('project_id', project_id);
    return get(`/search?${params.toString()}`, () => MOCK.search(q, project_id));
  },
  projects: () => get('/projects', () => MOCK.projects()),
  projectCategories: () => get('/projects/categories', () => MOCK.projectCategories()),

  interfaceStats: () => get('/interface360/stats', () => MOCK.interfaceStats()),
  interfaces: (opts = {}) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(opts)) {
      if (v == null || v === '') continue;
      q.set(k, Array.isArray(v) ? v.join(',') : String(v));
    }
    const qs = q.toString();
    return get(`/interface360/interfaces${qs ? '?' + qs : ''}`,
      () => MOCK.interfaces(opts));
  },
  interfaceSystems: () => get('/interface360/systems', () => MOCK.interfaceSystems()),
  interfaceFacets: () => get('/interface360/facets', () => MOCK.interfaceFacets()),

  feeds: (opts = {}) => {
    const q = new URLSearchParams();
    if (opts.feed_class) q.set('feed_class', opts.feed_class);
    if (opts.geography) q.set('geography', opts.geography);
    const qs = q.toString();
    return get(`/data360/feeds${qs ? '?' + qs : ''}`, () => MOCK.feeds(opts));
  },
  lineage: (project_id) => get(
    `/data360/lineage${project_id ? '?project_id=' + project_id : ''}`,
    () => MOCK.lineage(project_id)),
  graph: (project_id, plane = 'Data') => {
    const q = new URLSearchParams({ plane });
    if (project_id) q.set('project_id', project_id);
    return get(`/data360/graph?${q.toString()}`, () => MOCK.graph(project_id, plane));
  },
  columnLineage: (dataset_key) => get(
    `/data360/column-lineage${dataset_key ? '?dataset_key=' + encodeURIComponent(dataset_key) : ''}`,
    () => MOCK.columnLineage(dataset_key)),
  transformation: (dataset_key) => get(
    `/data360/transformation/${encodeURIComponent(dataset_key)}`,
    () => MOCK.transformation(dataset_key)),
  apiSources: (project_id) => get(
    `/api360/sources${project_id && project_id !== 'all' ? '?project_id=' + project_id : ''}`,
    () => MOCK.apiSources(project_id)),
  endpointDetail: (endpoint_key, opts = {}) => {
    const qs = new URLSearchParams();
    if (opts.operation_id) qs.set('operation_id', opts.operation_id);
    if (opts.method) qs.set('method', opts.method);
    if (opts.path) qs.set('path', opts.path);
    const q = qs.toString();
    return get(`/api360/endpoint/${encodeURIComponent(endpoint_key)}${q ? '?' + q : ''}`, () => ({}));
  },
  apiSourceDetail: (source_id) => get(
    `/api360/sources/${encodeURIComponent(source_id)}`,
    () => MOCK.apiSourceDetail(source_id)),
  apiStats: () => get('/api360/stats', () => MOCK.apiStats()),
  apiDependencies: (project_id) => get(
    `/api360/dependencies${project_id ? '?project_id=' + project_id : ''}`,
    () => MOCK.apiDependencies(project_id)),
  apiEndpointPicker: (opts = {}) => {
    const qs = new URLSearchParams(Object.entries(opts).filter(([, v]) => v)).toString();
    return get(`/api360/endpoint-picker${qs ? '?' + qs : ''}`, () => MOCK.endpointPicker(opts));
  },
  apiDomains: (project_id) => get(
    `/api360/domains${project_id && project_id !== 'all' ? '?project_id=' + project_id : ''}`,
    () => MOCK.apiDomainsList()),
  apiSuggestOrder: (endpoint_keys) => post('/api360/suggest-order', { endpoint_keys },
    () => ({ ordered: endpoint_keys, warnings: [] })),
  apiCreateFlow: (payload) => post('/api360/business-flow', payload,
    () => ({ ok: true, flow_id: 'demo', step_count: (payload.steps || []).length })),
  apiBusinessFlows: (project_id) => get(
    `/api360/business-flows${project_id && project_id !== 'all' ? '?project_id=' + project_id : ''}`,
    () => MOCK.businessFlows(project_id)),
  apiBusinessFlow: (flow_id) => get(
    `/api360/business-flow/${encodeURIComponent(flow_id)}`,
    () => MOCK.businessFlowDetail(flow_id)),
  apiFlows: (project_id) => get(
    `/api360/flows${project_id ? '?project_id=' + project_id : ''}`,
    () => MOCK.apiFlows(project_id)),
  search: (q, project_id) => {
    const qs = new URLSearchParams({ q, ...(project_id ? { project_id } : {}) }).toString();
    return get(`/search?${qs}`, () => MOCK.search(q));
  },
  projectLanding: () => get('/projects/landing', () => MOCK.projectLanding()),
  projectSources: (pid) => get(`/projects/${encodeURIComponent(pid)}/sources`, () => MOCK.projectSources(pid)),
  inboundFeeds: (opts = {}) => {
    const qs = new URLSearchParams(Object.entries(opts).filter(([, v]) => v)).toString();
    return get(`/data360/inbound-feeds${qs ? '?' + qs : ''}`, () => MOCK.inboundFeeds(opts));
  },
  inboundFeedWorkstreams: () => get('/data360/inbound-feed-workstreams', () => MOCK.inboundFeedWorkstreams()),
  inboundFeedDetail: (feed) => get(
    `/data360/inbound-feed/${encodeURIComponent(feed)}`, () => MOCK.inboundFeedDetail(feed)),
  pipelines: (project_id) => get(
    `/data360/pipelines${project_id && project_id !== 'all' ? '?project_id=' + project_id : ''}`,
    () => MOCK.pipelines(project_id)),
  pipelineDetail: (id) => get(
    `/data360/pipelines/${encodeURIComponent(id)}`, () => MOCK.pipelineDetail(id)),
  pipelineModel: (id, model) => get(
    `/data360/pipelines/${encodeURIComponent(id)}/model/${encodeURIComponent(model)}`,
    () => MOCK.pipelineModel(id, model)),
  datapointGroups: () => get('/data360/datapoint-groups', () => MOCK.datapointGroups()),
  datapoints: (opts = {}) => {
    const qs = new URLSearchParams(Object.entries(opts).filter(([, v]) => v != null && v !== '')).toString();
    return get(`/data360/datapoints${qs ? '?' + qs : ''}`, () => MOCK.datapointsList(opts));
  },
  datapointDetail: (name) => get(
    `/data360/datapoint/${encodeURIComponent(name)}`, () => MOCK.datapointDetail(name)),
  data360Stats: () => get('/data360/stats', () => MOCK.data360Stats()),

  piiStats: () => get('/pii/stats', () => MOCK.piiStats()),
  piiByAttribute: () => get('/pii/by-attribute', () => MOCK.piiByAttribute()),
  piiByModule: () => get('/pii/by-module', () => MOCK.piiByModule()),
  piiByProject: () => get('/pii/by-project', () => MOCK.piiByProject()),
  piiMatches: (opts = {}) => {
    const q = new URLSearchParams();
    if (opts.project_id) q.set('project_id', opts.project_id);
    if (opts.module) q.set('module', opts.module);
    const qs = q.toString();
    return get(`/pii/matches${qs ? '?' + qs : ''}`, () => MOCK.piiMatches(opts));
  },

  // ---- Business-Flow workbook (bf_*): the agreed catalog spine -----------
  bfPipelines: (opts = {}) => {
    const q = new URLSearchParams();
    if (opts.domain) q.set('domain', opts.domain);
    if (opts.archetype) q.set('archetype', opts.archetype);
    if (opts.direction) q.set('direction', opts.direction);
    q.set('limit', opts.limit || 500);
    return get(`/bf/pipelines?${q.toString()}`, () => ({ pipelines: [] }));
  },
  bfPipeline: (id) => get(`/bf/pipeline/${encodeURIComponent(id)}`,
    () => ({ pipeline: null, stages: [] })),
  bfCompression: () => get('/bf/compression',
    () => ({ plan: [], summary: [] })),
  bfApiFlows: () => get('/bf/api-flows', () => ({ flows: [] })),
  bfApiFlow: (id) => get(`/bf/api-flow/${encodeURIComponent(id)}`,
    () => ({ flow: null, steps: [] })),

  // ---- Reference Data layer (Datapoint 360 enrichment) -------------------
  referenceCategories: () => get('/reference/categories', () => ({ categories: [] })),
  referenceCategory: (cat) => get(`/reference/category/${encodeURIComponent(cat)}`,
    () => ({ category: cat, fields: [] })),
  referenceForDatapoint: (dp) => get(`/reference/datapoint/${encodeURIComponent(dp)}`,
    () => ({ datapoint: dp, references: [] })),
  referenceUnresolved: () => get('/reference/unresolved', () => ({ unresolved: [] })),

  // ---- Loaders (rich ldr_catalog via data360 router) ----------------------
  loaders: (opts = {}) => {
    const q = new URLSearchParams();
    if (opts.domain) q.set('domain', opts.domain);
    if (opts.q) q.set('q', opts.q);
    const qs = q.toString();
    return get(`/data360/loader-catalog${qs ? '?' + qs : ''}`, () => ({ loaders: [] }));
  },
  loaderDetail: (id) => get(`/data360/loader/${encodeURIComponent(id)}`, () => ({})),

  // ---- Interdependency graph (shared-key edges) ---------------------------
  feedGraph: (domain) => get(
    `/data360/feed-graph${domain ? `?domain=${encodeURIComponent(domain)}` : ''}`,
    () => ({ nodes: [], edges: [], hubs: [] })),
  loaderGraph: (domain) => get(
    `/data360/loader-graph${domain ? `?domain=${encodeURIComponent(domain)}` : ''}`,
    () => ({ nodes: [], edges: [], hubs: [] })),

  // ---- Quality Guardrails -------------------------------------------------
  guardrailStats: () => get('/guardrails/stats',
    () => ({ total: 0, attention: 0, failed: 0, warning: 0, critical: 0, by_engine: {} })),
  guardrailAttention: (engine) => get(
    `/guardrails/attention${engine ? `?engine=${encodeURIComponent(engine)}` : ''}`,
    () => ({ events: [] })),
  guardrailEvent: (id) => get(`/guardrails/event/${encodeURIComponent(id)}`, () => ({})),
  guardrailBadData: (id) => get(`/guardrails/event/${encodeURIComponent(id)}/bad-data`,
    () => ({ sample: [], bad_row_count: 0 })),
};
