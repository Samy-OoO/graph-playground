import type { ReactNode } from 'react';
import { cx } from '../../utils/cx';
import styles from './Card.module.css';

interface CardProps {
  title: string;
  children: ReactNode;
  className?: string;
}

export function Card({ title, children, className }: CardProps) {
  return (
    <section className={cx(styles.card, className)}>
      <h2 className={styles.title}>{title}</h2>
      {children}
    </section>
  );
}
