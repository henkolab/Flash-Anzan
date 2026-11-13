import {
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import type { Operation } from "../lib/anzan";

// Teacher-created setting profiles (e.g. one per age group / class).
export const profiles = pgTable("profiles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  ageGroup: text("age_group").notNull().default(""),
  operations: jsonb("operations").$type<Operation[]>().notNull(),
  digits: integer("digits").notNull(),
  variableDigits: boolean("variable_digits").notNull().default(false),
  count: integer("count").notNull(),
  intervalMs: integer("interval_ms").notNull(),
  gapMs: integer("gap_ms").notNull(),
  multiplierDigits: integer("multiplier_digits").notNull().default(1),
  allowNegative: boolean("allow_negative").notNull().default(false),
  rounds: integer("rounds").notNull().default(10),
  countdown: integer("countdown").notNull().default(3),
  sound: boolean("sound").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Tiny key/value table used to remember that default profiles were seeded.
export const appMeta = pgTable("app_meta", {
  key: text("key").primaryKey(),
});
