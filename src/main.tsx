import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

const isConfigured = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY,
);

async function bootstrap() {
  const root = createRoot(document.getElementById('root')!);

  if (!isConfigured) {
    const { ConfigMissing } = await import('./components/ConfigMissing.tsx');
    root.render(
      <StrictMode>
        <ConfigMissing />
      </StrictMode>,
    );
    return;
  }

  const { reconcileSupabaseProject } = await import('./lib/projectSession.ts');
  await reconcileSupabaseProject();

  const { default: App } = await import('./App.tsx');
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void bootstrap();
