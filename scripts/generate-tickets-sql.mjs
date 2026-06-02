// Convert exported tickets.csv -> tickets_insert.sql (idempotent).
//
// Usage:
//   node scripts/generate-tickets-sql.mjs <input.csv> <output.sql>
// Example:
//   node scripts/generate-tickets-sql.mjs \
//     /mnt/documents/luckyping-export/tickets.csv \
//     /mnt/documents/luckyping-export/tickets_insert.sql

import { readFileSync, writeFileSync } from "node:fs";

const [, , inPath, outPath] = process.argv;
if (!inPath || !outPath) {
  console.error("Usage: node scripts/generate-tickets-sql.mjs <input.csv> <output.sql>");
  process.exit(1);
}

// Minimal CSV parser supporting quoted fields with embedded commas / quotes / newlines.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else cur += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(cur); cur = ""; }
      else if (c === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
      else if (c === "\r") { /* skip */ }
      else cur += c;
    }
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row); }
  return rows.filter(r => r.length > 1 || (r.length === 1 && r[0] !== ""));
}

const sqlEscape = (s) => "'" + String(s).replace(/'/g, "''") + "'";

const raw = readFileSync(inPath, "utf8");
const rows = parseCsv(raw);
const header = rows.shift();
const idx = Object.fromEntries(header.map((h, i) => [h.trim(), i]));

const required = ["id", "user_id", "nums", "purchases", "wins", "created_at", "updated_at"];
for (const k of required) {
  if (!(k in idx)) { console.error(`Missing column: ${k}`); process.exit(1); }
}

const values = rows.map((r) => {
  const id = sqlEscape(r[idx.id]);
  const user_id = sqlEscape(r[idx.user_id]);
  // nums comes as Postgres array literal e.g. {1,2,3} -> keep as-is, cast to int[]
  const nums = sqlEscape(r[idx.nums]) + "::int[]";
  // purchases / wins are JSON
  const purchases = sqlEscape(r[idx.purchases] || "[]") + "::jsonb";
  const wins = sqlEscape(r[idx.wins] || "[]") + "::jsonb";
  const created_at = sqlEscape(r[idx.created_at]) + "::timestamptz";
  const updated_at = sqlEscape(r[idx.updated_at]) + "::timestamptz";
  return `  (${id}, ${user_id}, ${nums}, ${purchases}, ${wins}, ${created_at}, ${updated_at})`;
});

const sql = `-- Ticket data import (idempotent). Run AFTER migrate-users.mjs has created auth.users rows.
INSERT INTO public.tickets (id, user_id, nums, purchases, wins, created_at, updated_at) VALUES
${values.join(",\n")}
ON CONFLICT (id) DO NOTHING;
`;

writeFileSync(outPath, sql);
console.log(`Wrote ${values.length} ticket inserts -> ${outPath}`);
