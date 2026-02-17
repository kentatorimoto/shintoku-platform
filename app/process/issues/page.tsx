import fs from 'fs';
import path from 'path';
import Link from 'next/link';

interface IssueSource {
  primary: {
    townPage: { title: string; url: string };
    youtube: { title: string; url: string; timestampSec?: number };
  };
  derived: {
    title: string;
    note: string;
    page?: number;
  };
}

interface Issue {
  id: string;
  theme: string;
  title: string;
  issue: string;
  context: string;
  admin_view: string;
  next_step: string;
  source: IssueSource;
}

const THEME_LABELS: Record<string, string> = {
  agriculture: 'Agriculture',
  tourism: 'Tourism',
  finance: 'Finance',
};

function youtubeUrl(source: IssueSource): string {
  const yt = source.primary.youtube;
  if (yt.timestampSec) {
    return `${yt.url}&t=${yt.timestampSec}s`;
  }
  return yt.url;
}

async function getIssues(): Promise<Issue[]> {
  try {
    const filePath = path.join(process.cwd(), 'data', 'process.json');
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return data.issues;
  } catch (error) {
    console.error('Failed to load issues:', error);
    return [];
  }
}

export default async function IssuesPage({
  searchParams,
}: {
  searchParams: Promise<{ theme?: string }>;
}) {
  const issues = await getIssues();
  const { theme: activeTheme } = await searchParams;
  const themes = [...new Set(issues.map(i => i.theme))];

  const filtered = activeTheme
    ? issues.filter(i => i.theme === activeTheme)
    : issues;

  return (
    <main className="min-h-screen bg-black text-green-400 font-mono p-8">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8">
          <Link href="/process" className="text-green-600 hover:text-green-400 mb-4 inline-block">
            ← Process Atlas
          </Link>
          <h1 className="text-4xl mb-2">Key Issues</h1>
          <p className="text-green-600">
            論点カード — 議論・判断・次の一手
          </p>
          <p className="text-green-700 text-sm mt-2">
            Extracted highlights from public planning documents.
          </p>
          <p className="text-green-700 text-sm">
            公開されている計画資料から論点を抽出しています。
          </p>
        </header>

        {/* Stats */}
        <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border border-green-400 p-4">
            <div className="text-green-600 text-sm mb-1">TOTAL</div>
            <div className="text-2xl">{issues.length} issues</div>
          </div>
          <div className="border border-green-400 p-4">
            <div className="text-green-600 text-sm mb-1">THEMES</div>
            <div className="text-2xl">{themes.length}</div>
          </div>
          <div className="border border-green-400 p-4">
            <div className="text-green-600 text-sm mb-1">SHOWING</div>
            <div className="text-2xl">{filtered.length} issues</div>
          </div>
        </div>

        {/* Filter */}
        <div className="mb-8 flex flex-wrap gap-2">
          <Link
            href="/process/issues"
            className={`border px-4 py-2 text-sm transition-colors ${
              !activeTheme
                ? 'border-green-400 bg-green-400 text-black'
                : 'border-green-400 hover:bg-green-950'
            }`}
          >
            All
          </Link>
          {themes.map(theme => (
            <Link
              key={theme}
              href={`/process/issues?theme=${theme}`}
              className={`border px-4 py-2 text-sm transition-colors ${
                activeTheme === theme
                  ? 'border-green-400 bg-green-400 text-black'
                  : 'border-green-400 hover:bg-green-950'
              }`}
            >
              {THEME_LABELS[theme] || theme}
            </Link>
          ))}
        </div>

        {/* Issue cards */}
        <section>
          <h2 className="text-2xl mb-6 flex items-center">
            <span className="text-green-600 mr-2">$</span>
            {activeTheme ? (THEME_LABELS[activeTheme] || activeTheme).toUpperCase() : 'ALL ISSUES'}
          </h2>

          <div className="space-y-4">
            {filtered.map(issue => (
              <div key={issue.id} className="border border-green-400 p-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs border border-green-400 px-2 py-0.5">
                    {THEME_LABELS[issue.theme] || issue.theme}
                  </span>
                  <h3 className="text-lg">{issue.title}</h3>
                </div>

                <div className="space-y-3 text-sm">
                  <div>
                    <span className="text-green-600">Issue / 論点: </span>
                    {issue.issue}
                  </div>
                  <div>
                    <span className="text-green-600">Background / 背景: </span>
                    {issue.context}
                  </div>
                  {issue.admin_view && (
                    <div>
                      <span className="text-green-600">Administration / 行政の見解: </span>
                      {issue.admin_view}
                    </div>
                  )}
                  <div>
                    <span className="text-green-600">What happens next / 次の一手: </span>
                    {issue.next_step}
                  </div>

                  {/* Source / 出典 */}
                  <div className="pt-2 border-t border-green-400/30 space-y-2">
                    <div className="text-green-600 font-bold">Source / 出典</div>
                    <div>
                      <span className="text-green-600">Primary / 一次:</span>
                      <ul className="ml-4 mt-1 space-y-1">
                        <li>
                          Shintoku Town (Council Live){' '}
                          <a href={issue.source.primary.townPage.url} target="_blank" rel="noopener noreferrer" className="text-green-400 hover:text-green-300 underline">[Open]</a>
                        </li>
                        <li>
                          YouTube (Special Committee){' '}
                          <a href={youtubeUrl(issue.source)} target="_blank" rel="noopener noreferrer" className="text-green-400 hover:text-green-300 underline">[Watch]</a>
                        </li>
                      </ul>
                    </div>
                    <div>
                      <span className="text-green-600">Derived / 二次:</span>
                      <ul className="ml-4 mt-1">
                        <li>
                          {issue.source.derived.title}
                          {issue.source.derived.page != null && ` (p.${issue.source.derived.page})`}
                          {' '}
                          <a href="#" className="text-green-400 hover:text-green-300 underline">[View]</a>
                        </li>
                      </ul>
                    </div>
                    <div className="mt-1">
                      <Link href="/sources" className="text-green-400 hover:text-green-300 underline text-xs">
                        All sources →
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-8 border border-green-400 p-4 text-sm text-green-600">
          Sources: See <Link href="/sources" className="text-green-400 hover:text-green-300 underline">/sources</Link> for full provenance information.
        </div>
      </div>
    </main>
  );
}
