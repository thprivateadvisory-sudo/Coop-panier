export default function ContributorLoading() {
  return (
    <div className="min-h-screen bg-[#F8F7F4] pb-24 animate-pulse">
      {/* Hero header skeleton */}
      <div
        className="px-6 pt-12 pb-24"
        style={{ background: 'linear-gradient(135deg, #2D5016 0%, #3D6B1F 60%, #4A8025 100%)' }}
      >
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="h-11 w-32 rounded-lg bg-white/20" />
          <div className="w-11 h-11 rounded-full bg-white/20" />
        </div>
      </div>

      <div className="max-w-lg mx-auto px-6 -mt-16 flex flex-col gap-5">
        {/* Points card skeleton */}
        <div className="bg-white rounded-3xl p-6 shadow-md border border-gray-100/50">
          <div className="flex items-center gap-5">
            <div className="w-[104px] h-[104px] rounded-full bg-gray-100 flex-shrink-0" />
            <div className="flex-1 flex flex-col gap-3">
              <div className="h-5 w-24 rounded-full bg-gray-100" />
              <div className="h-2 w-full rounded-full bg-gray-100" />
            </div>
          </div>
        </div>

        {/* Scan button skeleton */}
        <div className="w-full h-24 rounded-2xl bg-orange-100" />

        {/* Impact card skeleton */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100">
          <div className="h-3 w-20 rounded-full bg-gray-100 mb-4" />
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gray-100" />
                <div className="h-5 w-10 rounded-full bg-gray-100" />
                <div className="h-3 w-12 rounded-full bg-gray-100" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* BottomNav placeholder */}
      <div className="fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-gray-100" />
    </div>
  );
}
