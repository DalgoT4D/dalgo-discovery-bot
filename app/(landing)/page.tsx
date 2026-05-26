import { IntakeForm } from '@/components/intake-form';
import { SiteHeader } from '@/components/site-header';

export default function Landing() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex flex-1 items-start justify-center px-4 py-16 sm:py-24">
        <div className="w-full max-w-2xl">
          <h1 className="text-4xl sm:text-5xl font-medium tracking-tight text-foreground">
            Find out if Dalgo fits{' '}
            <span className="text-primary">your NGO</span>{' '}
            — in 5 minutes.
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            A grounded assistant. No sales pitch.
          </p>
          <div className="mt-10">
            <IntakeForm />
          </div>
          <p className="mt-10 text-center text-xs uppercase tracking-wide text-muted-foreground">
            Used by NGOs worldwide · Open source · NGO-priced
          </p>
        </div>
      </main>
    </div>
  );
}
