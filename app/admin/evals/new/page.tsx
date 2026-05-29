import { EvalCaseEditor, type EvalCaseFormValue } from '@/components/admin/eval-case-editor';

const DEFAULT: EvalCaseFormValue = {
  case_key: '',
  bucket: 'citations',
  input: '',
  expected: { must_cite_one_of: [] },
  judges: ['retrieval-judge'],
  enabled: true,
  notes: null,
};

export default async function NewEvalCasePage() {
  return (
    <main className="max-w-6xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">New eval case</h1>
      <EvalCaseEditor initial={DEFAULT} mode="create" />
    </main>
  );
}
