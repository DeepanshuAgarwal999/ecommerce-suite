import { memo, useEffect } from 'react';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, Ellipse, Line, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';

/**
 * An original SVG diya (oil lamp) on a string - the mobile take on the web's
 * HangingDiya. It sways from its hook and the flame flickers; both stop under
 * the OS "reduce motion" setting.
 */
export const HangingDiya = memo(function HangingDiya({ size = 44, delay = 0, rope = 26 }: { size?: number; delay?: number; rope?: number }) {
  const reduce = useReducedMotion();
  const sway = useSharedValue(0);
  const flicker = useSharedValue(1);

  useEffect(() => {
    if (reduce) return;
    sway.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
          withTiming(-1, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      ),
    );
    flicker.value = withRepeat(withSequence(withTiming(0.82, { duration: 180 }), withTiming(1, { duration: 240 })), -1, true);
  }, [reduce, delay, sway, flicker]);

  const height = (rope + 44) * (size / 44);
  // Rotate about the hook at the top: shift the pivot up, rotate, shift back.
  const swing = useAnimatedStyle(() => ({
    transform: [{ translateY: -height / 2 }, { rotate: `${sway.value * 7}deg` }, { translateY: height / 2 }],
  }));
  const flame = useAnimatedStyle(() => ({ opacity: flicker.value, transform: [{ scaleY: flicker.value }] }));

  return (
    <Animated.View style={[{ width: size, height }, swing]}>
      <Svg width={size} height={height} viewBox={`0 0 44 ${rope + 44}`}>
        <Defs>
          <LinearGradient id="diyaBody" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#f5b54a" />
            <Stop offset="1" stopColor="#b5541c" />
          </LinearGradient>
          <RadialGradient id="diyaGlow" cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0" stopColor="#ffd56b" stopOpacity="0.7" />
            <Stop offset="1" stopColor="#ffd56b" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Line x1="22" y1="0" x2="22" y2={rope + 14} stroke="#e9b452" strokeWidth="1.2" />
        <Ellipse cx="22" cy={rope + 16} rx="16" ry="12" fill="url(#diyaGlow)" />
        <Path
          d={`M4 ${rope + 26} Q22 ${rope + 46} 40 ${rope + 26} Q36 ${rope + 24} 22 ${rope + 24} Q8 ${rope + 24} 4 ${rope + 26} Z`}
          fill="url(#diyaBody)"
        />
        <Path d={`M8 ${rope + 28} Q22 ${rope + 38} 36 ${rope + 28}`} stroke="#ffe3a3" strokeWidth="1.2" fill="none" />
      </Svg>
      <Animated.View style={[{ position: 'absolute', left: size / 2 - 5, top: (rope + 12) * (size / 44) }, flame]}>
        <Svg width={10} height={14} viewBox="0 0 10 14">
          <Path d="M5 0 C8 5 10 8 5 14 C0 8 2 5 5 0 Z" fill="#ffb300" />
          <Path d="M5 5 C6.5 8 7 9.5 5 13 C3 9.5 3.5 8 5 5 Z" fill="#fff3c4" />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
});
