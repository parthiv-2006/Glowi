import { View } from 'react-native';

interface ScanTheaterProps {
  width: number;
  height: number;
  active?: boolean;
}

export function ScanTheater({ width, height }: ScanTheaterProps) {
  return <View style={{ width, height }} pointerEvents="none" />;
}
