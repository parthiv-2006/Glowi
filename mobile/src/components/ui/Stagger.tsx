import { Children, type PropsWithChildren } from 'react';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { motion } from '@/theme';

interface StaggerProps extends PropsWithChildren {
  /** Base delay before the first child enters. */
  delay?: number;
  interval?: number;
}

/**
 * Staggered entrance for lists of cards/sections — the signature Glowi
 * reveal. Each direct child fades in and rises with an incremental delay.
 */
export function Stagger({ children, delay = 0, interval = motion.stagger }: StaggerProps) {
  return (
    <>
      {Children.map(children, (child, index) =>
        child == null ? null : (
          <Animated.View
            entering={FadeInDown.delay(delay + index * interval)
              .duration(motion.slow)
              .springify()
              .damping(16)}
          >
            {child}
          </Animated.View>
        ),
      )}
    </>
  );
}
