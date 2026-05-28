/**
 * Bumblebee — Desktop Supply-Chain Scan parser.
 *
 * Bumblebee is a hypothetical desktop scanner that produces a JSON report
 * listing installed packages, ecosystems, and findings. Users paste / upload
 * the JSON; we parse a forgiving shape and surface a summary.
 *
 * Expected shape (any of these keys is accepted — best effort):
 *   {
 *     scannedAt: string,
 *     ecosystems: { name: string, count: number }[],
 *     findings: { severity, package, version, advisory, summary }[],
 *     packages: { name, version, ecosystem }[],
 *   }
 */

export interface BumblebeeReport {
  scannedAt?: string;
  packageCount: number;
  ecosystems: { name: string; count: number }[];
  findings: {
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
    package: string;
    version: string;
    advisory?: string;
    summary?: string;
  }[];
  raw: unknown;
}

export function parseBumblebee(input: string): BumblebeeReport | { error: string } {
  let obj: any;
  try {
    obj = JSON.parse(input);
  } catch (e: any) {
    return { error: `Could not parse JSON: ${e?.message || 'invalid syntax'}` };
  }
  if (!obj || typeof obj !== 'object') {
    return { error: 'Expected a JSON object.' };
  }

  const packages: any[] = Array.isArray(obj.packages) ? obj.packages : [];
  let ecosystems: { name: string; count: number }[] = [];
  if (Array.isArray(obj.ecosystems)) {
    ecosystems = obj.ecosystems.map((e: any) => ({
      name: String(e.name ?? 'unknown'),
      count: Number(e.count ?? 0),
    }));
  } else if (packages.length > 0) {
    const m = new Map<string, number>();
    for (const p of packages) {
      const eco = String(p.ecosystem ?? p.type ?? 'unknown');
      m.set(eco, (m.get(eco) ?? 0) + 1);
    }
    ecosystems = Array.from(m.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }

  const rawFindings: any[] = Array.isArray(obj.findings) ? obj.findings : [];
  const findings = rawFindings.map((f: any) => ({
    severity: normaliseSeverity(f.severity),
    package: String(f.package ?? f.name ?? '?'),
    version: String(f.version ?? '?'),
    advisory: f.advisory ? String(f.advisory) : undefined,
    summary: f.summary ? String(f.summary) : (f.description ? String(f.description) : undefined),
  }));

  return {
    scannedAt: obj.scannedAt ? String(obj.scannedAt) : undefined,
    packageCount: Number(obj.packageCount ?? packages.length ?? 0),
    ecosystems,
    findings,
    raw: obj,
  };
}

function normaliseSeverity(s: any): BumblebeeReport['findings'][number]['severity'] {
  const v = String(s ?? '').toLowerCase();
  if (v === 'critical' || v === 'high' || v === 'medium' || v === 'low') return v;
  return 'info';
}
