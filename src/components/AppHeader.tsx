import type { DocumentSession } from '../hooks/useDocumentSession';
import type { UnsavedGuard } from '../hooks/useUnsavedGuard';
import { BrandMark } from './BrandMark';
import styles from './AppHeader.module.css';
import { DocumentControls } from './header/DocumentControls';
import { LibraryMenu } from './header/LibraryMenu';

interface AppHeaderProps {
  session: DocumentSession;
  guard: UnsavedGuard;
}

// The title bar: the app's name, the open graph's controls, and the saved graphs.
export function AppHeader({ session, guard }: AppHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <span className={styles.mark}>
            <BrandMark />
          </span>
          <div className={styles.brandText}>
            <h1 className={styles.title}>Graph Playground</h1>
            <p className={styles.tagline}>Build graphs. Explore algorithms.</p>
          </div>
        </div>

        <DocumentControls session={session} guard={guard} />
        <LibraryMenu session={session} guard={guard} />
      </div>
    </header>
  );
}
