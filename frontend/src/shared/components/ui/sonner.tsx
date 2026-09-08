import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from 'lucide-react';
import type { CSSProperties } from 'react';
import { Toaster as Sonner, type ToasterProps } from 'sonner';
import { useTheme } from '@/themes/use-theme';

/** Toasts de shadcn/ui adaptados al motor de theming del proyecto (no usa next-themes). */
const Toaster = ({ ...props }: ToasterProps) => {
  const { tokens } = useTheme();

  return (
    <Sonner
      theme={tokens.mode}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          '--normal-bg': 'var(--t-card)',
          '--normal-text': 'var(--t-text)',
          '--normal-border': 'var(--t-border)',
          '--border-radius': 'var(--t-radius)',
        } as CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
