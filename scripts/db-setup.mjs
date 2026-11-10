// Prepares the local D1 database: applies migrations, then loads demo data if the database is empty.
//   node scripts/db-setup.mjs          → migrate + seed only when there are no users yet
//   node scripts/db-setup.mjs --reset  → migrate + always reload the demo data
import { execSync } from "node:child_process";

const reset = process.argv.includes("--reset");
const sh = (cmd, opts = {}) => execSync(cmd, { stdio: "inherit", ...opts });

console.log("› Applying D1 migrations to the local database…");
sh("npx wrangler d1 migrations apply DB --local");

let userCount = 0;
try {
  const out = execSync('npx wrangler d1 execute DB --local --json --command "SELECT COUNT(*) AS n FROM users"', { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  userCount = JSON.parse(out)[0]?.results?.[0]?.n ?? 0;
} catch {
  userCount = 0;
}

if (reset || userCount === 0) {
  console.log(reset ? "› Reloading demo data…" : "› Database is empty — loading demo data…");
  sh("npx tsx scripts/generate-seed.ts");
  sh("npx wrangler d1 execute DB --local --file=./db/seed.sql", { stdio: ["ignore", "ignore", "inherit"] });
  console.log("✓ Demo data loaded. Log in with any account in README.md (password: FairShare2026!).");
} else {
  console.log(`✓ Local database already has ${userCount} users — keeping it. Run \`npm run db:reset\` to reload the demo data.`);
}
