export function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <div className="text-center py-20 px-4">
      <div className="inline-block bg-violet-100 text-violet-700 px-4 py-1.5 rounded-full text-sm font-medium mb-6 border border-violet-200">
        Coming Soon
      </div>
      <h2 className="font-display text-3xl font-bold mb-4 text-gray-800">{title}</h2>
      <p className="text-gray-600 max-w-lg mx-auto">{description}</p>
    </div>
  );
}
