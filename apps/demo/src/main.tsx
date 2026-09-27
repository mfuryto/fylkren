import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ProductShell } from '@fylkren/ui';
import { exampleTasks } from './fixtures';
import './demo.css';

function Demo() {
  const summaries = [
    ['Aktive', '8'],
    ['Nær frist', '3'],
    ['Blokkerte', '1'],
    ['Krever oppmerksomhet', '2']
  ] as const;

  return (
    <ProductShell mode="demo" logoUrl="/fylkren-logo.png">
      <div className="page">
        <header className="page-header">
          <div>
            <h1>Arbeidsoversikt</h1>
            <p className="muted">Syntetiske eksempeldata. Innholdet kan ikke endres.</p>
          </div>
        </header>
        <div className="summary-grid" aria-label="Oppgavesammendrag">
          {summaries.map(([label, value]) => (
            <div className="summary-card" key={label}><span>{label}</span><strong>{value}</strong></div>
          ))}
        </div>
        <div className="panel task-list">
          <div className="section-heading"><h2>Prioriterte oppgaver</h2><span className="muted">3 av 12</span></div>
          {exampleTasks.map(task => (
            <article className="task-row" key={task.id}>
              <span>{task.id}</span><strong>{task.title}</strong><span>{task.owner}</span><span>{task.status}</span>
            </article>
          ))}
        </div>
      </div>
    </ProductShell>
  );
}

createRoot(document.getElementById('root')!).render(<StrictMode><Demo /></StrictMode>);
