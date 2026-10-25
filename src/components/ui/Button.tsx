import type { ButtonHTMLAttributes } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cx } from '../../utils/cx';
import styles from './Button.module.css';

type ButtonVariant = 'secondary' | 'primary' | 'danger' | 'tile' | 'toggle';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  icon?: LucideIcon;
  iconSize?: number;
  /** For buttons that stay "on" (selected tool, active setting). */
  pressed?: boolean;
}

/** The one button used everywhere. Icon-only buttons must pass an aria-label. */
export function Button({
  variant = 'secondary',
  icon: Icon,
  iconSize = 16,
  pressed,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      aria-pressed={pressed}
      data-variant={variant}
      className={cx(styles.button, className)}
      {...rest}
    >
      {Icon && <Icon size={iconSize} aria-hidden="true" />}
      {children}
    </button>
  );
}
