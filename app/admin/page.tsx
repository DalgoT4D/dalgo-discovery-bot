import { LeadTable } from '@/components/admin/lead-table';

export default function AdminIndex() {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl">Leads</h2>
      <LeadTable />
    </div>
  );
}
