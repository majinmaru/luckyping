// Recreate legacy auth users in the new Supabase project with the SAME UUIDs.
//
// Usage:
//   1. Create scripts/.env.migrate (gitignored) with:
//        SUPABASE_URL=https://ugdsgueyidscjfluymhg.supabase.co  # 본인 Supabase 프로젝트
//        SUPABASE_SERVICE_ROLE_KEY=<service role key from new project>
//   2. Optionally edit USERS array below to set known emails.
//   3. Run:  node scripts/migrate-users.mjs
//
// Notes:
//   - Existing users with the same id are skipped.
//   - Each user is created with a random password + email_confirm: true.
//   - Real users should reset their password via the app's "forgot password" flow.

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env.migrate (simple parser, no dotenv dep needed)
try {
  const envPath = resolve(__dirname, ".env.migrate");
  const raw = readFileSync(envPath, "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {
  // fall back to existing env vars
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  console.error("Create scripts/.env.migrate with those values.");
  process.exit(1);
}

// Map of legacy UUID -> email. Edit before running if you know the real emails.
const USERS = [
  { id: "76a0601a-346a-4c41-b504-6c36471325c0", email: "legacy-user-1@luckyping.local" },
  { id: "38fcea6c-875c-4567-abda-2e32047b9d0f", email: "legacy-user-2@luckyping.local" },
];

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const randomPassword = () => randomBytes(18).toString("base64") + "Aa1!";

for (const u of USERS) {
  // Check if user already exists
  const { data: existing } = await admin.auth.admin.getUserById(u.id);
  if (existing?.user) {
    console.log(`[skip] ${u.id} already exists (${existing.user.email})`);
    continue;
  }

  const { data, error } = await admin.auth.admin.createUser({
    id: u.id,
    email: u.email,
    password: randomPassword(),
    email_confirm: true,
  });

  if (error) {
    console.error(`[fail] ${u.id} (${u.email}):`, error.message);
  } else {
    console.log(`[ok]   ${u.id} -> ${data.user.email}`);
  }
}

console.log("\nDone. Users can now reset their password via the app.");
