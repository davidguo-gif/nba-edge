// GitHub device flow to get an auth token
const CLI_CLIENT_ID = "Iv1.b1323160d0c42978";

async function main() {
  // Step 1: Request device code
  const r1 = await fetch("https://github.com/login/device/code", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify({ client_id: CLI_CLIENT_ID, scope: "repo,read:org,workflow" }),
  });
  if (!r1.ok) { const t = await r1.text(); throw new Error("Step 1: " + r1.status + " " + t); }
  const d1 = await r1.json();
  console.log("User code:", d1.user_code);
  console.log("Go to:", d1.verification_uri);
  console.log("Enter this code:", d1.user_code);
  
  // Step 2: Poll for token
  for (let i = 0; i < 120; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const r2 = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({
        client_id: CLI_CLIENT_ID,
        device_code: d1.device_code,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      }),
    });
    const d2 = await r2.json();
    if (d2.access_token) {
      console.log("TOKEN:" + d2.access_token);
      return d2.access_token;
    }
    if (d2.error === "authorization_pending") continue;
    if (d2.error === "slow_down") { i--; continue; }
    if (d2.error === "expired_token") throw new Error("Code expired");
    if (d2.error === "access_denied") throw new Error("User denied access");
    throw new Error("Unexpected: " + JSON.stringify(d2));
  }
  throw new Error("Timed out waiting for auth");
}

main().catch(e => {
  console.error("Error:", e.message);
  process.exit(1);
});