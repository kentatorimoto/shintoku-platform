import fs from 'fs';
import path from 'path';
import Link from 'next/link';

interface TimelineEvent {
  date: string;
  label: string;
}

async function getTimeline(): Promise<TimelineEvent[]> {
  try {
    const filePath = path.join(process.cwd(), 'data', 'process.json');
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return data.timeline;
  } catch (error) {
    console.error('Failed to load timeline:', error);
    return [];
  }
}

export default async function TimelinePage() {
  const timeline = await getTimeline();

  return (
    <main className="min-h-screen bg-black text-green-400 font-mono p-8">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8">
          <Link href="/process" className="text-green-600 hover:text-green-400 mb-4 inline-block">
            ← Process Atlas
          </Link>
          <h1 className="text-4xl mb-2">Decision Timeline</h1>
          <p className="text-green-600">
            Key milestones in the planning process
          </p>
        </header>

        <section>
          <h2 className="text-2xl mb-6 flex items-center">
            <span className="text-green-600 mr-2">$</span>
            TIMELINE
          </h2>

          <div className="space-y-0">
            {timeline.map((event, index) => (
              <div key={index} className="flex">
                <div className="flex flex-col items-center mr-6">
                  <div className="w-3 h-3 border-2 border-green-400 rounded-full bg-black shrink-0" />
                  {index < timeline.length - 1 && (
                    <div className="w-px flex-1 bg-green-400/40" />
                  )}
                </div>
                <div className="border border-green-400 p-4 mb-4 flex-1">
                  <div className="text-green-600 text-sm mb-1">{event.date}</div>
                  <div className="text-lg">{event.label}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
