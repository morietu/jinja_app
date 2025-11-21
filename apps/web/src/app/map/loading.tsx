// apps/web/src/app/map/loading.tsx
export default function MapLoading() {
  return (
    <main className="p-4 max-w-5xl mx-auto space-y-4">
      <div className="h-4 w-24 rounded bg-gray-200" />
      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-24 rounded-2xl border bg-white shadow-sm p-3 flex flex-col justify-between animate-pulse"
          >
            <div className="h-3 w-20 rounded bg-gray-200" />
            <div className="h-2 w-32 rounded bg-gray-100" />
          </div>
        ))}
      </div>

      <div className="w-full h-[60vh] rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center text-sm text-gray-500">
        地図を読み込み中…
      </div>

      <div className="max-h-64 overflow-y-auto rounded-lg border bg-white p-3 text-xs text-gray-500">
        神社リストを読み込み中…
      </div>
    </main>
  );
}
