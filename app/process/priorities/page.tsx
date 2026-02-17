import fs from 'fs';
import path from 'path';
import Link from 'next/link';

interface Priority {
  id: string;
  title: string;
  bullets: string[];
}

async function getPriorities(): Promise<Priority[]> {
  try {
    const filePath = path.join(process.cwd(), 'data', 'process.json');
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return data.priorities;
  } catch (error) {
    console.error('Failed to load priorities:', error);
    return [];
  }
}

export default async function PrioritiesPage() {
  const priorities = await getPriorities();

  return (
    <main className="min-h-screen bg-black text-green-400 font-mono p-8">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8">
          <Link href="/process" className="text-green-600 hover:text-green-400 mb-4 inline-block">
            ← Process Atlas
          </Link>
          <h1 className="text-4xl mb-2">Town Priorities</h1>
          <p className="text-green-600">
            Current policy discussions and focus areas
          </p>
        </header>

        <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border border-green-400 p-4">
            <div className="text-green-600 text-sm mb-1">CATEGORIES</div>
            <div className="text-2xl">{priorities.length}</div>
          </div>
          <div className="border border-green-400 p-4">
            <div className="text-green-600 text-sm mb-1">STATUS</div>
            <div className="text-2xl">Under review</div>
          </div>
        </div>

        <section>
          <h2 className="text-2xl mb-6 flex items-center">
            <span className="text-green-600 mr-2">$</span>
            PRIORITIES
          </h2>

          <div className="space-y-4">
            {priorities.map((priority) => (
              <div key={priority.id} className="border border-green-400 p-6">
                <h3 className="text-xl mb-3">{priority.title}</h3>
                <ul className="space-y-1">
                  {priority.bullets.map((bullet, i) => (
                    <li key={i} className="flex items-start">
                      <span className="text-green-600 mr-2 shrink-0">→</span>
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-8 border border-green-400 p-4 text-sm text-green-600">
          Sources: Internal document highlights (unofficial) / Public documents
        </div>
      </div>
    </main>
  );
}
