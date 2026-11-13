import { sanitizeSettings } from "@/lib/anzan";
import { deleteProfile, updateProfile } from "@/lib/profiles";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

async function parseId(ctx: Ctx) {
  const id = Number((await ctx.params).id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PUT(req: Request, ctx: Ctx) {
  const id = await parseId(ctx);
  if (id === null) return Response.json({ error: "Invalid id" }, { status: 400 });
  const parsed = sanitizeSettings(await req.json().catch(() => null));
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
  try {
    const updated = await updateProfile(id, parsed.value);
    if (!updated) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json(updated);
  } catch {
    return Response.json({ error: "Database unavailable" }, { status: 503 });
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const id = await parseId(ctx);
  if (id === null) return Response.json({ error: "Invalid id" }, { status: 400 });
  try {
    const ok = await deleteProfile(id);
    if (!ok) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Database unavailable" }, { status: 503 });
  }
}
