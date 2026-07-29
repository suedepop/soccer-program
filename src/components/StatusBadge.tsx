import { AD_STATUS, type AdStatus } from '@/lib/config';

export default function StatusBadge({ status }: { status: AdStatus }) {
  const s = AD_STATUS[status] ?? AD_STATUS.draft;
  return <span className={`badge badge-${s.tone}`}>{s.label}</span>;
}
