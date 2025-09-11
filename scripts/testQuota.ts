// Simple script to invoke the /api/quota GET handler directly without starting Next.js server.
// This "hits" the quota API route logic and prints the JSON result.
import { GET as quotaGet } from "../src/app/api/quota/route";

async function main() {
  const res = await quotaGet();
  // NextResponse extends the standard Response
  const json = await (res as Response).json();
  console.log("/api/quota response:\n", JSON.stringify(json, null, 2));
}

main().catch(err => {
  console.error("Error running quota test:", err);
  process.exit(1);
});
