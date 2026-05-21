import { IntakeForm } from '@/components/intake-form';
import Link from 'next/link';

export default function Landing() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50">
      <IntakeForm />
      <footer className="mt-12 text-xs text-slate-500">
        <Link href="/privacy" className="hover:underline">Privacy</Link>
      </footer>
    </main>
  );
}
