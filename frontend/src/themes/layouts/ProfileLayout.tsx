import { createElement } from 'react';
import { resolveLayout, type LayoutProps } from './index';

interface ProfileLayoutProps extends LayoutProps {
  name: string | null | undefined;
}

/** Renderiza el layout `name` (desconocido → `classic`) con los mismos datos. */
export function ProfileLayout({ name, ...props }: ProfileLayoutProps) {
  return createElement(resolveLayout(name), props);
}
