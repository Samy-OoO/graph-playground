import styles from './AppHeader.module.css';

export function AppHeader() {
  return (
    <header className={styles.header}>
      <h1 className={styles.title}>Graph Playground</h1>
      <p className={styles.tagline}>Build graphs. Explore algorithms.</p>
    </header>
  );
}
