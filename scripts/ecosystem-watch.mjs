import { readFile, writeFile } from "node:fs/promises";

const baseline = JSON.parse(await readFile(new URL("../data/ecosystem-baseline.json", import.meta.url), "utf8"));
const headers = { Accept: "application/vnd.github+json", "User-Agent": "ag-ui-ai-ecosystem-watch" };
if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

const lines = [
  "# Generative UI ecosystem source report",
  "",
  `Generated: ${new Date().toISOString()}`,
  `Baseline verified: ${baseline.verifiedAt}`,
  "",
  "## Repositories, licenses, and releases",
  "",
];
let drift = false;

for (const source of baseline.repositories) {
  const response = await fetch(`https://api.github.com/repos/${source.repo}`, { headers });
  if (!response.ok) {
    drift = true;
    lines.push(`- ❌ ${source.repo}: repository metadata returned HTTP ${response.status}`);
    continue;
  }

  const data = await response.json();
  const actualLicense = data.license?.spdx_id && !["NOASSERTION", "OTHER"].includes(data.license.spdx_id) ? data.license.spdx_id : null;
  const canonicalMatches = data.full_name.toLowerCase() === source.repo.toLowerCase();
  const branchMatches = data.default_branch === source.defaultBranch;
  const licenseMatches = actualLicense === source.license;
  const active = data.archived === false && data.disabled === false;

  const releaseResponse = await fetch(`https://api.github.com/repos/${source.repo}/releases/latest`, { headers });
  const actualRelease = releaseResponse.status === 404 ? null : releaseResponse.ok ? (await releaseResponse.json()).tag_name : "unverified";
  const releaseMatches = actualRelease === source.latestRelease;
  const matches = canonicalMatches && branchMatches && licenseMatches && active && releaseMatches;
  if (!matches) drift = true;

  lines.push(`- ${matches ? "✅" : "⚠️"} ${source.repo}`);
  lines.push(`  - canonical: ${data.full_name}; default branch: ${data.default_branch}; archived: ${data.archived}`);
  lines.push(`  - license: ${actualLicense ?? "unverified"}; latest release: ${actualRelease ?? "none"}; pushed: ${data.pushed_at}`);
}

lines.push("", "## Documentation locations", "");
for (const document of baseline.documents) {
  try {
    const response = await fetch(document.url, { headers: { "User-Agent": headers["User-Agent"] }, redirect: "follow" });
    const finalUrl = response.url.replace(/\/$/, "") || response.url;
    const expectedUrl = document.expectedFinalUrl.replace(/\/$/, "") || document.expectedFinalUrl;
    const matches = response.ok && finalUrl === expectedUrl;
    if (!matches) drift = true;
    lines.push(`- ${matches ? "✅" : "⚠️"} ${document.name}: HTTP ${response.status}; final URL ${response.url}`);
  } catch (error) {
    drift = true;
    lines.push(`- ❌ ${document.name}: ${error instanceof Error ? error.message : "request failed"}`);
  }
}

lines.push("", drift ? "Review required before updating published content." : "No declared-source drift detected.");
await writeFile("ecosystem-report.md", `${lines.join("\n")}\n`);
console.log(lines.join("\n"));
if (drift) process.exitCode = 2;
