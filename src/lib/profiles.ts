import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { appMeta, profiles } from "@/db/schema";
import { SEED_PROFILES, type Profile, type ProfileSettings } from "@/lib/anzan";

let ready: Promise<void> | null = null;

async function init() {
  // Self-bootstrapping schema so the Docker container needs no migration step.
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS profiles (
      id serial PRIMARY KEY,
      name text NOT NULL,
      age_group text NOT NULL DEFAULT '',
      operations jsonb NOT NULL,
      digits integer NOT NULL,
      variable_digits boolean NOT NULL DEFAULT false,
      count integer NOT NULL,
      interval_ms integer NOT NULL,
      gap_ms integer NOT NULL,
      multiplier_digits integer NOT NULL DEFAULT 1,
      allow_negative boolean NOT NULL DEFAULT false,
      rounds integer NOT NULL DEFAULT 10,
      countdown integer NOT NULL DEFAULT 3,
      sound boolean NOT NULL DEFAULT true,
      created_at timestamp NOT NULL DEFAULT now()
    )`);
  await db.execute(sql`CREATE TABLE IF NOT EXISTS app_meta (key text PRIMARY KEY)`);

  // Seed the age-group starter profiles exactly once (even if all are deleted later).
  const inserted = await db
    .insert(appMeta)
    .values({ key: "seeded" })
    .onConflictDoNothing()
    .returning();
  if (inserted.length > 0) {
    await db.insert(profiles).values(SEED_PROFILES);
  }
}

export function ensureSchema() {
  if (!ready) {
    ready = init().catch((e) => {
      ready = null;
      throw e;
    });
  }
  return ready;
}

type Row = typeof profiles.$inferSelect;

function toProfile(r: Row): Profile {
  return {
    id: r.id,
    name: r.name,
    ageGroup: r.ageGroup,
    operations: r.operations,
    digits: r.digits,
    variableDigits: r.variableDigits,
    count: r.count,
    intervalMs: r.intervalMs,
    gapMs: r.gapMs,
    multiplierDigits: r.multiplierDigits,
    allowNegative: r.allowNegative,
    rounds: r.rounds,
    countdown: r.countdown,
    sound: r.sound,
  };
}

export async function listProfiles(): Promise<Profile[]> {
  await ensureSchema();
  const rows = await db.select().from(profiles).orderBy(asc(profiles.id));
  return rows.map(toProfile);
}

export async function createProfile(s: ProfileSettings): Promise<Profile> {
  await ensureSchema();
  const [row] = await db.insert(profiles).values(s).returning();
  return toProfile(row);
}

export async function updateProfile(id: number, s: ProfileSettings): Promise<Profile | null> {
  await ensureSchema();
  const [row] = await db.update(profiles).set(s).where(eq(profiles.id, id)).returning();
  return row ? toProfile(row) : null;
}

export async function deleteProfile(id: number): Promise<boolean> {
  await ensureSchema();
  const rows = await db.delete(profiles).where(eq(profiles.id, id)).returning();
  return rows.length > 0;
}
