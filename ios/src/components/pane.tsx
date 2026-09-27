/* Container width for pages. On iPad the content pane sits next to the
 * sidebar, so useWindowDimensions() over-reports by the sidebar width —
 * pages sizing themselves off the window overflow under the sidebar and
 * their centering collapses. The shell's content pane measures itself and
 * provides the real width here; pages read it via usePaneWidth(). */

import React, { createContext, useContext, useState } from 'react';
import { useWindowDimensions, View } from 'react-native';

const PaneWidthContext = createContext<number | null>(null);

export function PaneWidthProvider({
  width,
  children,
}: {
  width: number | null;
  children: React.ReactNode;
}) {
  return <PaneWidthContext.Provider value={width}>{children}</PaneWidthContext.Provider>;
}

/** the width pages should lay out against — the measured content pane, or
 * the window width outside/before measurement (phone layout, first frame) */
export function usePaneWidth(): number {
  const pane = useContext(PaneWidthContext);
  const window = useWindowDimensions();
  return pane ?? window.width;
}

/** self-measuring pane: reports its laid-out width to the context */
export function MeasuringPane({ children }: { children: React.ReactNode }) {
  const [paneWidth, setPaneWidth] = useState<number | null>(null);
  const window = useWindowDimensions();
  return (
    <View
      style={{ flex: 1 }}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (Math.abs(w - (paneWidth ?? 0)) > 0.5) setPaneWidth(w);
      }}
    >
      <PaneWidthProvider width={paneWidth ?? window.width}>{children}</PaneWidthProvider>
    </View>
  );
}
