import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Platform } from 'react-native';

const STATUS_MESSAGES = [
  '⚡ Matching verified experts nearby...',
  '🛡️ Securing Volo 100% vSafe guarantee...',
  '✨ Preparing your home services hub...',
];

export function LoadingIndicator() {
  const [msgIndex, setMsgIndex] = useState(0);
  const textFade = useRef(new Animated.Value(1)).current;

  // Track sweep for neon laser bar
  const laserX = useRef(new Animated.Value(0)).current;

  // Dot animations
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  // Cycle status messages smoothly
  useEffect(() => {
    const interval = setInterval(() => {
      Animated.timing(textFade, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start(() => {
        setMsgIndex((prev) => (prev + 1) % STATUS_MESSAGES.length);
        Animated.timing(textFade, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }).start();
      });
    }, 1800);

    return () => clearInterval(interval);
  }, []);

  // Neon laser progress shimmer animation
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(laserX, {
          toValue: 1,
          duration: 1200,
          easing: Easing.bezier(0.4, 0, 0.2, 1),
          useNativeDriver: true,
        }),
        Animated.timing(laserX, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Harmonic wave pulse for dots
    const createPulsingDot = (dot: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, {
            toValue: 1,
            duration: 350,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0.3,
            duration: 350,
            useNativeDriver: true,
          }),
        ])
      );
    };

    const a1 = createPulsingDot(dot1, 0);
    const a2 = createPulsingDot(dot2, 140);
    const a3 = createPulsingDot(dot3, 280);

    Animated.parallel([a1, a2, a3]).start();

    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
    };
  }, []);

  const laserTranslate = laserX.interpolate({
    inputRange: [0, 1],
    outputRange: [-120, 200],
  });

  return (
    <View style={styles.container}>
      {/* Neon Laser Progress Track */}
      <View style={styles.laserTrack}>
        <Animated.View
          style={[
            styles.laserBar,
            {
              transform: [{ translateX: laserTranslate }],
            },
          ]}
        />
      </View>

      {/* Rotating status text */}
      <Animated.Text style={[styles.statusText, { opacity: textFade }]}>
        {STATUS_MESSAGES[msgIndex]}
      </Animated.Text>

      {/* Pulsing Neon Wave Dots */}
      <View style={styles.dotsRow}>
        <Animated.View style={[styles.dot, { opacity: dot1, transform: [{ scale: dot1 }] }]} />
        <Animated.View style={[styles.dot, styles.dotMiddle, { opacity: dot2, transform: [{ scale: dot2 }] }]} />
        <Animated.View style={[styles.dot, { opacity: dot3, transform: [{ scale: dot3 }] }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingHorizontal: 24,
  },
  laserTrack: {
    width: 160,
    height: 3.5,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 16,
  },
  laserBar: {
    width: 70,
    height: '100%',
    backgroundColor: '#A855F7',
    borderRadius: 2,
    ...Platform.select({
      ios: {
        shadowColor: '#C084FC',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
      default: {
        boxShadow: '0 0 12px #C084FC',
      },
    }),
  },
  statusText: {
    color: '#D8B4FE',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginBottom: 14,
    textAlign: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#A855F7',
  },
  dotMiddle: {
    backgroundColor: '#F59E0B',
  },
});
