import { WrongAnswersTable } from '@/components/admin/wrong-answers-table';

export default function WrongAnswersPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-foreground">Wrong answers</h1>
      <WrongAnswersTable />
    </div>
  );
}
