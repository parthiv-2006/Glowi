import { View } from 'react-native';

import type { ScanZone } from './ScanTheater';

interface ScanTheaterProps {
  width: number;
  height: number;
  active?: boolean;
  zones?: ScanZone[];
}

export function ScanTheater({ width, height }: ScanTheaterProps) {
  return <View style={{ width, height, pointerEvents: 'none' }} />;
}
