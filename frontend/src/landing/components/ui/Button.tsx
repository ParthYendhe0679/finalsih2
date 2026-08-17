import type { ReactNode, MouseEvent } from 'react';

type Props = {
  href?: string;
  onClick?: (e: MouseEvent) => void;
  children: ReactNode;
  variant?: 'primary' | 'ghost';
  size?: 'md' | 'lg';
  arrow?: boolean;
};

export function Button({ href, onClick, children, variant = 'primary', size = 'md', arrow = true }: Props) {
  const handleClick = (e: MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => {
    if (onClick) {
      if (!href || href.startsWith('#dashboard')) {
        e.preventDefault();
      }
      onClick(e);
    }
  };

  if (!href && onClick) {
    return (
      <button type="button" className={`btn btn--${variant} btn--${size}`} onClick={handleClick}>
        <span className="btn__label">{children}</span>
        {arrow && (
          <span className="btn__arrow" aria-hidden="true">
            <svg viewBox="0 0 18 10" width="18" height="10" fill="none">
              <path d="M0 5h16M12 1l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        )}
      </button>
    );
  }

  return (
    <a className={`btn btn--${variant} btn--${size}`} href={href || '#'} onClick={handleClick}>
      <span className="btn__label">{children}</span>
      {arrow && (
        <span className="btn__arrow" aria-hidden="true">
          <svg viewBox="0 0 18 10" width="18" height="10" fill="none">
            <path d="M0 5h16M12 1l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      )}
    </a>
  );
}

