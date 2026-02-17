export default function Footer() {
  return (
    <footer className="bg-black text-green-600 font-mono text-sm px-8 pb-8">
      <div className="max-w-6xl mx-auto border-t border-green-400 pt-6">
        <p>Open source project | Independent | Unofficial</p>
        <div className="mt-4">
          <h3 className="text-green-400 mb-1">Disclaimer</h3>
          <p>This is an independent, unofficial project.</p>
          <p>All information is collected from publicly available official sources.</p>
          <p>For official announcements, please refer to the{' '}
            <a href="https://www.shintoku-town.jp/" target="_blank" rel="noopener noreferrer" className="text-green-400 hover:text-green-300 underline">Shintoku Town website</a>.
          </p>
        </div>
      </div>
    </footer>
  );
}
