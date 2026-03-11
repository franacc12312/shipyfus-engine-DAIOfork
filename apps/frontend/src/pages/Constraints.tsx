import { ConstraintForm } from '../components/ConstraintForm';
import { useAuth } from '../hooks/useAuth';
import type { Department } from '@daio/shared';

// All departments including Shipyfus additions
const ALL_DEPARTMENTS: Department[] = [
  'research',
  'ideation',
  'branding',
  'planning',
  'testing' as Department,
  'development',
  'deployment',
  'distribution',
  'analytics' as Department,
];

export function Constraints() {
  const { isAdmin } = useAuth();

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-zinc-100 tracking-wider">CONSTRAINTS</h2>
          <p className="text-xs text-zinc-500 mt-1">
            Configure pipeline parameters per stage. Hover the <span className="inline-flex items-center justify-center w-3 h-3 rounded-full bg-zinc-800 text-zinc-500 text-[8px] font-bold">?</span> icons for details on each setting.
          </p>
        </div>
        {!isAdmin && (
          <span className="text-[10px] text-zinc-500 border border-zinc-700 rounded px-2 py-1">
            READ ONLY — login to edit
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {ALL_DEPARTMENTS.map((dept) => (
          <ConstraintForm key={dept} department={dept} />
        ))}
      </div>
    </div>
  );
}
