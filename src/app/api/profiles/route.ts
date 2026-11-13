import { sanitizeSettings } from "@/lib/anzan";
import { createProfile, listProfiles } from "@/lib/profiles";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(await listProfiles());
  } catch {
    return Response.json({ error: "Database unavailable" }, { status: 503 });
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = sanitizeSettings(body);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
  try {
    return Response.json(await createProfile(parsed.value), { status: 201 });
  } catch {
    return Response.json({ error: "Database unavailable" }, { status: 503 });
  }
}
