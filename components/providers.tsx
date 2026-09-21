'use client';

import { MotionConfig } from 'motion/react';
import { ToastProvider } from '@/components/ui/toast';
import { CommandPalette } from '@/components/palette/command-palette';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <ToastProvider>
        {children}
        <CommandPalette />
      </ToastProvider>
    </MotionConfig>
  );
}
