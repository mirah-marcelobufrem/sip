type ConflictData = {
  field: string;
  localValue: unknown;
  remoteValue: unknown;
  localUpdatedAt: string;
  remoteUpdatedAt: string;
};

type Props = {
  entityName: string;
  conflicts: ConflictData[];
  onResolve: (resolutions: Record<string, 'local' | 'remote'>) => void;
  onDismiss: () => void;
};

export function ConflictResolutionDialog({ entityName, conflicts, onResolve, onDismiss }: Props) {
  function formatValue(v: unknown): string {
    if (v === null || v === undefined) return '—';
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
  }

  function handleKeepAll(source: 'local' | 'remote') {
    const resolutions: Record<string, 'local' | 'remote'> = {};
    for (const c of conflicts) resolutions[c.field] = source;
    onResolve(resolutions);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] flex flex-col">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Sync Conflict</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            <strong>{entityName}</strong> was modified on two devices. Choose which version to keep.
          </p>
        </div>

        <div className="overflow-y-auto flex-1 divide-y divide-gray-100 dark:divide-gray-800">
          {conflicts.map((c) => (
            <div key={c.field} className="p-4">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">{c.field}</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                  <p className="text-xs font-medium text-blue-700 dark:text-blue-400 mb-1">This device</p>
                  <p className="text-sm text-gray-900 dark:text-gray-100 break-all">{formatValue(c.localValue)}</p>
                  <p className="text-xs text-gray-400 mt-1">{new Date(c.localUpdatedAt).toLocaleString()}</p>
                </div>
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3">
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-1">Cloud</p>
                  <p className="text-sm text-gray-900 dark:text-gray-100 break-all">{formatValue(c.remoteValue)}</p>
                  <p className="text-xs text-gray-400 mt-1">{new Date(c.remoteUpdatedAt).toLocaleString()}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex flex-col gap-2">
          <div className="flex gap-2">
            <button
              onClick={() => handleKeepAll('local')}
              className="flex-1 bg-blue-600 text-white text-sm py-2 rounded-lg hover:bg-blue-700"
            >
              Keep all local
            </button>
            <button
              onClick={() => handleKeepAll('remote')}
              className="flex-1 bg-amber-500 text-white text-sm py-2 rounded-lg hover:bg-amber-600"
            >
              Keep all cloud
            </button>
          </div>
          <button
            onClick={onDismiss}
            className="text-sm text-gray-500 dark:text-gray-400 hover:underline text-center py-1"
          >
            Decide later
          </button>
        </div>
      </div>
    </div>
  );
}
