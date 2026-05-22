// ---------------------------------------------------------------------------
// API client – all calls go through the Next.js rewrite proxy (/api/*)
// so we never hit CORS issues in production.
// ---------------------------------------------------------------------------

const BASE = "/api";

async function request<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${body || res.statusText}`);
  }

  return res.json() as Promise<T>;
}

// ---- Types ----------------------------------------------------------------

export interface Message {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  token_count?: number | null;
  created_at: string;
}

export interface Conversation {
  id: string;
  title: string | null;
  provider: string;
  model: string;
  status: "active" | "paused" | "cancelled" | "completed";
  total_tokens: number;
  total_cost_usd: number;
  message_count: number;
  messages?: Message[];
  created_at: string;
  updated_at: string;
}

export interface ConversationList {
  items: Conversation[];
  total: number;
}

export interface InferenceLog {
  id: string;
  tokens_used: number;
  latency_ms: number;
  cost_usd: number;
}

export interface ChatResponse {
  message: Message;
  inference_log: InferenceLog;
}

export interface Providers {
  providers: Record<string, string[]>;
  configured: string[];
}

// Dashboard types
export interface KPIs {
  total_requests: number;
  avg_latency_ms: number;
  error_rate: number;
  total_tokens: number;
  total_cost_usd: number;
}

export interface TimeseriesPoint {
  timestamp: string;
  value: number;
  [key: string]: string | number;
}

export interface ProviderBreakdown {
  provider: string;
  count: number;
  tokens: number;
  cost: number;
}

export interface DashboardOverview {
  kpis: KPIs;
  volume_timeseries: TimeseriesPoint[];
  provider_breakdown: ProviderBreakdown[];
}

export interface LatencyStats {
  p50: number | null;
  p95: number | null;
  p99: number | null;
  avg: number | null;
  provider?: string;
  model?: string;
}

export interface DashboardLatency {
  overall: LatencyStats;
  by_provider: LatencyStats[];
  timeseries: TimeseriesPoint[];
}

export interface DashboardThroughput {
  rpm_timeseries: TimeseriesPoint[];
  token_timeseries: TimeseriesPoint[];
  cost_timeseries: TimeseriesPoint[];
}

export interface ErrorBreakdown {
  type: string;
  count: number;
}

export interface RecentError {
  id: string;
  error_type: string;
  error_message: string;
  model: string;
  provider: string;
  status: string;
  created_at: string;
}

export interface DashboardErrors {
  error_rate: number;
  error_timeseries: TimeseriesPoint[];
  breakdown: ErrorBreakdown[];
  recent_errors: RecentError[];
}

// ---- Endpoints ------------------------------------------------------------

// Conversations
export const getConversations = (
  status?: string,
  skip = 0,
  limit = 20
): Promise<ConversationList> => {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  params.set("offset", String(skip));
  params.set("limit", String(limit));
  return request(`/conversations?${params}`);
};

export const createConversation = (body: {
  provider: string;
  model: string;
  title?: string;
}): Promise<Conversation> => request("/conversations", { method: "POST", body: JSON.stringify(body) });

export const getConversation = (id: string): Promise<Conversation> =>
  request(`/conversations/${id}`);

export const updateConversation = (
  id: string,
  body: { status: string }
): Promise<Conversation> =>
  request(`/conversations/${id}`, { method: "PATCH", body: JSON.stringify(body) });

export const deleteConversation = (id: string): Promise<void> =>
  request(`/conversations/${id}`, { method: "DELETE" });

// Chat (non-streaming)
export const sendChat = (
  conversationId: string,
  body: { content: string; provider: string; model: string }
): Promise<ChatResponse> =>
  request(`/conversations/${conversationId}/chat`, {
    method: "POST",
    body: JSON.stringify(body),
  });

// Providers
export const getProviders = (): Promise<Providers> => request("/providers");

// Dashboard
export const getDashboardOverview = (hours = 24): Promise<DashboardOverview> =>
  request(`/dashboard/overview?hours=${hours}`);

export const getDashboardLatency = (hours = 24): Promise<DashboardLatency> =>
  request(`/dashboard/latency?hours=${hours}`);

export const getDashboardThroughput = (hours = 24): Promise<DashboardThroughput> =>
  request(`/dashboard/throughput?hours=${hours}`);

export const getDashboardErrors = (hours = 24): Promise<DashboardErrors> =>
  request(`/dashboard/errors?hours=${hours}`);

// Health
export const getHealth = (): Promise<{ status: string }> => request("/health");
