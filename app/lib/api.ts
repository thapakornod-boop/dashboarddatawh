const API_URL = process.env.NEXT_PUBLIC_API_URL;

export type LG014Row = Record<string, unknown>;

export type LG014Response = {
  data: LG014Row[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

// ── ใหม่: Summary types ──────────────────────────────────────────
export type LG014SellerRow = {
  Seller: string;
  GIV: number;
  NIV: number;
  totalDocs: number;
  totalRows: number;
};

export type LG014SummaryResponse = {
  summary: {
    GIV: number;
    totalNIV: number;
    totalDocs: number;
    totalRows: number;
  };
  bySeller: LG014SellerRow[];
  period: { startDate: string; endDate: string };
};

export async function getLG014({
  startDate,
  endDate,
  page = 1,
  pageSize = 100,
}: {
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}): Promise<LG014Response> {
  const params = new URLSearchParams();
  if (startDate) params.set('startDate', startDate);
  if (endDate)   params.set('endDate',   endDate);
  params.set('page',     String(page));
  params.set('pageSize', String(pageSize));

  const res = await fetch(`${API_URL}/api/lg014?${params.toString()}`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// ── ใหม่: Summary per Seller ─────────────────────────────────────
export async function getLG014Summary({
  startDate,
  endDate,
}: {
  startDate?: string;
  endDate?: string;
}): Promise<LG014SummaryResponse> {
  const params = new URLSearchParams();
  if (startDate) params.set('startDate', startDate);
  if (endDate)   params.set('endDate',   endDate);

  const res = await fetch(`${API_URL}/api/lg014/summary?${params.toString()}`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}