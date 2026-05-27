import { Suspense } from 'react';
import { SiteHeader } from '@/components/site-header';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { SignInForm } from './signin-form';

function SignInFallback() {
  return (
    <Card className="w-full">
      <CardHeader>
        <div className="h-6 w-32 rounded bg-muted animate-pulse" />
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="h-10 w-full rounded bg-muted animate-pulse" />
        <div className="h-10 w-full rounded bg-muted animate-pulse" />
        <div className="h-10 w-full rounded bg-muted animate-pulse" />
      </CardContent>
    </Card>
  );
}

export default function SignInPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1 px-4 py-12">
        <div className="mx-auto max-w-md">
          <Suspense fallback={<SignInFallback />}>
            <SignInForm />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
