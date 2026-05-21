import { ChatStream } from '@/components/chat-stream';

export default async function ChatPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return (
    <main className="min-h-screen p-4 bg-slate-50">
      <ChatStream sessionId={sessionId} />
    </main>
  );
}
