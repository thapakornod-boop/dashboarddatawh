// คำแนะนำตอนพิมพ์ในช่องค้นหาร้าน: GET /dashboard/stores/suggest?q=...
import type { NextRequest } from 'next/server';
import { suggestStores } from '@/app/lib/api';
import { currentEmployee } from '@/app/lib/session';

export async function GET(request: NextRequest) {
  if (!(await currentEmployee())) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const q = (request.nextUrl.searchParams.get('q') ?? '').trim().slice(0, 60);
  if (q.length < 2) return Response.json([]);
  try {
    return Response.json(await suggestStores(q));
  } catch {
    return Response.json([], { status: 502 });
  }
}
