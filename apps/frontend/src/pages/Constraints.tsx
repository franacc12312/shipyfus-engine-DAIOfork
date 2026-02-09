import { ConstraintForm } from '../components/ConstraintForm';
import { useAuth } from '../hooks/useAuth';
import { STAGES } from '@daio/shared';
import type { Department } from '@daio/shared';

export function Constraints() {
  const { isAdmin } = useAuth();

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-zinc-100 tracking-wider">CONSTRAINTS</h2>
          <p className="text-xs text-zinc-500 mt-1">Configure pipeline parameters per department</p>
        </div>
        {!isAdmin && (
          <span className="text-[10px] text-zinc-500 border border-zinc-700 rounded px-2 py-1">
            READ ONLY
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {STAGES.map((stage) => (
          <ConstraintForm key={stage} department={stage as Department} />
        ))}
      </div>
    </div>
  );
}
