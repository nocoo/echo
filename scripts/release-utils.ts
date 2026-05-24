export const SEMVER_RE = /^\d+\.\d+\.\d+$/;
export const CONVENTIONAL_RE = /^(\w+)(?:\(.+?\))?!?:\s*(.+)$/;
const REMOVED_KEYWORDS = /\b(remove|delete|drop)\b/i;

const BUMP_TYPES = ['patch', 'minor', 'major'] as const;
type BumpType = (typeof BUMP_TYPES)[number];

export interface Commit {
  hash: string;
  subject: string;
}

export interface ChangelogSections {
  added: string[];
  changed: string[];
  fixed: string[];
  removed: string[];
}

const COMMIT_TYPE_MAP: Record<string, keyof ChangelogSections> = {
  feat: 'added',
  fix: 'fixed',
  refactor: 'changed',
  chore: 'changed',
  docs: 'changed',
  test: 'changed',
  perf: 'changed',
  style: 'changed',
  ci: 'changed',
  build: 'changed',
};

export function parseSemver(version: string): [number, number, number] {
  if (!SEMVER_RE.test(version)) {
    throw new Error(`Invalid semver: "${version}"`);
  }
  return version.split('.').map(Number) as [number, number, number];
}

export function compareSemver(a: string, b: string): number {
  const [a0, a1, a2] = parseSemver(a);
  const [b0, b1, b2] = parseSemver(b);
  if (a0 !== b0) return a0 - b0;
  if (a1 !== b1) return a1 - b1;
  return a2 - b2;
}

export function bumpVersion(current: string, bumpArg: string): string {
  if (SEMVER_RE.test(bumpArg)) {
    if (compareSemver(bumpArg, current) <= 0) {
      throw new Error(
        `Explicit version ${bumpArg} must be greater than current ${current}`,
      );
    }
    return bumpArg;
  }

  if (!BUMP_TYPES.includes(bumpArg as BumpType)) {
    throw new Error(`Invalid bump type: "${bumpArg}"`);
  }

  const [major, minor, patch] = parseSemver(current);
  switch (bumpArg as BumpType) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
      return `${major}.${minor}.${patch + 1}`;
  }
}

function capitalizeFirst(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function classifyCommits(commits: Commit[]): ChangelogSections {
  const sections: ChangelogSections = {
    added: [],
    changed: [],
    fixed: [],
    removed: [],
  };

  for (const commit of commits) {
    const { subject } = commit;

    if (subject.startsWith('Merge ')) continue;

    let description: string;
    let section: keyof ChangelogSections;

    const match = CONVENTIONAL_RE.exec(subject);
    if (match) {
      const type = (match[1] ?? '').toLowerCase();
      description = capitalizeFirst((match[2] ?? '').trim());
      section = COMMIT_TYPE_MAP[type] ?? 'changed';
    } else {
      description = capitalizeFirst(subject.trim());
      section = 'changed';
    }

    if (REMOVED_KEYWORDS.test(subject) && section === 'changed') {
      section = 'removed';
    }

    if (!sections[section].includes(description)) {
      sections[section].push(description);
    }
  }

  return sections;
}

export function formatChangelogSection(
  version: string,
  date: string,
  sections: ChangelogSections,
  vPrefix: boolean,
): string {
  const tag = vPrefix ? `v${version}` : version;
  const lines: string[] = [`## [${tag}] - ${date}`];

  const sectionOrder: [keyof ChangelogSections, string][] = [
    ['added', 'Added'],
    ['changed', 'Changed'],
    ['fixed', 'Fixed'],
    ['removed', 'Removed'],
  ];

  for (const [key, heading] of sectionOrder) {
    const items = sections[key];
    if (items.length > 0) {
      lines.push('');
      lines.push(`### ${heading}`);
      for (const item of items) {
        lines.push(`- ${item}`);
      }
    }
  }

  return lines.join('\n');
}
