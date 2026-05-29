import { LeadTable } from '@/components/admin/lead-table';

export default function AdminIndex() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-foreground">Leads</h1>
      <LeadTable />
    </div>
  );
}
