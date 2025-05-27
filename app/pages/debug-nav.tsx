// Debug page to check navigation items
export default function DebugNav() {
  const navItems = [
    { label: '首頁', href: '/' },
    { label: '關於我們', href: '/about' },
  ];

  return (
    <div className="p-8">
      <h1 className="text-2xl mb-4">Navigation Debug</h1>
      <div className="bg-gray-100 p-4 rounded">
        <h2 className="text-lg mb-2">navItems array:</h2>
        <pre className="bg-white p-2 rounded text-sm">
          {JSON.stringify(navItems, null, 2)}
        </pre>
      </div>
      
      <div className="mt-4 bg-blue-100 p-4 rounded">
        <h2 className="text-lg mb-2">Rendered items:</h2>
        {navItems.map((item, index) => (
          <div key={index} className="mb-1">
            <span className="font-mono">Label: "{item.label}", Href: "{item.href}"</span>
          </div>
        ))}
      </div>
      
      <div className="mt-4 bg-yellow-100 p-4 rounded">
        <h2 className="text-lg mb-2">Environment:</h2>
        <div>typeof window: {typeof window}</div>
        <div>NODE_ENV: {process.env.NODE_ENV}</div>
        <div>Is Client: {typeof window !== 'undefined' ? 'Yes' : 'No'}</div>
      </div>
    </div>
  );
}