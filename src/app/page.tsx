import ProjectGate from '@/components/project/ProjectGate';
import ChatPage from '@/components/chat/ChatPage';

export const dynamic = 'force-dynamic';

export default function Home() {
  return (
    <ProjectGate>
      <ChatPage />
    </ProjectGate>
  );
}
