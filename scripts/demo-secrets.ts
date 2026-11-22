// Uploads the demo site's two secrets. The class list stays on your computer and in Cloudflare, never in Git.
//   npm run demo:secrets
import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { parseDemoRoster } from "../src/lib/demo";

const FILE = "demo-roster.local.json";
const MAX_SECRET_BYTES = 5 * 1024;

if (!existsSync(FILE)) {
  console.error(`${FILE} is missing. Add the class list first.`);
  process.exit(1);
}
const roster = JSON.stringify(parseDemoRoster(readFileSync(FILE, "utf8")));
if (Buffer.byteLength(roster) > MAX_SECRET_BYTES) {
  console.error("The class list is too large for a Cloudflare secret (5 KB).");
  process.exit(1);
}

const put = (name: string, value: string) =>
  execSync(`npx wrangler secret put ${name} --config wrangler.demo.jsonc`, { input: value, stdio: ["pipe", "inherit", "inherit"] });

put("SESSION_SECRET", randomBytes(32).toString("hex"));
put("DEMO_ROSTER", roster);
console.log("Demo secrets are set.");
