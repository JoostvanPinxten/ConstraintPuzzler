// A burst of confetti over the puzzle when the user finishes it. Drawn with Animated views, so it
// works on every platform without a native module; it never takes touches.
import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';

const COLORS = ['#2f6fde', '#00a86b', '#f5b800', '#e8453c', '#9b59d0', '#ff8c1a'];
const PIECES = 80;
const useNativeDriver = Platform.OS !== 'web';

interface Piece {
  readonly x: number;
  readonly drift: number;
  readonly delay: number;
  readonly duration: number;
  readonly spins: number;
  readonly width: number;
  readonly height: number;
  readonly color: string;
  readonly progress: Animated.Value;
}

function makePieces(width: number): Piece[] {
  return Array.from({ length: PIECES }, (_, i) => ({
    x: Math.random() * width,
    drift: (Math.random() - 0.5) * 160,
    delay: Math.random() * 400,
    duration: 1800 + Math.random() * 1400,
    spins: 1 + Math.random() * 3,
    width: 6 + Math.random() * 6,
    height: 8 + Math.random() * 8,
    color: COLORS[i % COLORS.length] ?? '#2f6fde',
    progress: new Animated.Value(0),
  }));
}

/** Plays a burst each time `burst` increases (0: nothing yet). */
export function Confetti({ burst, enabled }: { burst: number; enabled: boolean }) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [pieces, setPieces] = useState<Piece[]>([]);
  const played = useRef(burst);

  useEffect(() => {
    if (burst === played.current) return;
    played.current = burst;
    if (!enabled || size.width === 0) return;
    let cancelled = false;
    let animation: Animated.CompositeAnimation | null = null;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduceMotion) => {
        if (cancelled || reduceMotion) return;
        const next = makePieces(size.width);
        setPieces(next);
        animation = Animated.parallel(
          next.map((p) =>
            Animated.timing(p.progress, {
              toValue: 1,
              duration: p.duration,
              delay: p.delay,
              easing: Easing.in(Easing.quad),
              useNativeDriver,
            }),
          ),
        );
        animation.start(({ finished }) => finished && setPieces([]));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      animation?.stop();
    };
  }, [burst, enabled, size.width]);

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize({ width, height });
  };

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      onLayout={onLayout}
      testID="confetti"
    >
      {pieces.map((p, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            left: p.x,
            top: -20,
            width: p.width,
            height: p.height,
            backgroundColor: p.color,
            borderRadius: 2,
            opacity: p.progress.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 1, 0] }),
            transform: [
              {
                translateY: p.progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, size.height + 40],
                }),
              },
              {
                translateX: p.progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, p.drift],
                }),
              },
              {
                rotate: p.progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0deg', `${p.spins * 360}deg`],
                }),
              },
            ],
          }}
        />
      ))}
    </View>
  );
}
