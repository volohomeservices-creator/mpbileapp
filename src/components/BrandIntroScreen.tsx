import React, { useEffect, useRef, useState } from 'react';
import {
  StyleSheet, View, Text, Animated, Easing,
  Platform, Dimensions, AccessibilityInfo, Image
} from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import * as SplashScreen from 'expo-splash-screen';

interface BrandIntroScreenProps {
  isInitializing: boolean;
  onExitComplete: () => void;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Responsive dimensions
const RING_SIZE = Math.min(SCREEN_WIDTH * 0.74, 290);
const RADIUS = RING_SIZE / 2 - 12;
const CENTER = RING_SIZE / 2;
const LOGO_SIZE = Math.min(SCREEN_WIDTH * 0.35, 136);
const WORDMARK_WIDTH = Math.min(SCREEN_WIDTH * 0.54, 210);
const WORDMARK_HEIGHT = WORDMARK_WIDTH * 0.28;
const WAVE_HEIGHT = Math.min(SCREEN_HEIGHT * 0.23, 195);

// Arc geometry for the animated orbital stroke (105-degree sweep)
const SWEEP_DEG = 105;
const toRad = (deg: number) => (deg * Math.PI) / 180;
const arcStartX = CENTER + RADIUS * Math.cos(toRad(-SWEEP_DEG));
const arcStartY = CENTER + RADIUS * Math.sin(toRad(-SWEEP_DEG));
const arcEndX = CENTER + RADIUS * Math.cos(0); // CENTER + RADIUS
const arcEndY = CENTER + RADIUS * Math.sin(0); // CENTER
const orbitalArcPath = `M ${arcStartX} ${arcStartY} A ${RADIUS} ${RADIUS} 0 0 1 ${arcEndX} ${arcEndY}`;

export function BrandIntroScreen({ isInitializing, onExitComplete }: BrandIntroScreenProps) {
  const [reduceMotion, setReduceMotion] = useState(false);
  const [entranceDone, setEntranceDone] = useState(false);
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);

  // Entrance animations
  const logoScale = useRef(new Animated.Value(0.88)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const ringOpacity = useRef(new Animated.Value(0)).current;
  const wordmarkOpacity = useRef(new Animated.Value(0)).current;
  const wordmarkTranslateY = useRef(new Animated.Value(16)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const taglineTranslateY = useRef(new Animated.Value(12)).current;
  const dotsOpacity = useRef(new Animated.Value(0)).current;

  // Continuous looping animations
  const orbitSpin = useRef(new Animated.Value(0)).current;
  const waveFloat = useRef(new Animated.Value(0)).current;
  const dot1Anim = useRef(new Animated.Value(0)).current;
  const dot2Anim = useRef(new Animated.Value(0)).current;
  const dot3Anim = useRef(new Animated.Value(0)).current;

  // Bottom-to-top logo color fill animation
  const fillProgress = useRef(new Animated.Value(0)).current;

  // Exit animation
  const exitOpacity = useRef(new Animated.Value(1)).current;
  const isExiting = useRef(false);

  // Dismiss native splash screen immediately so the animated brand intro is visible
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  // Check accessibility reduced motion
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (enabled) {
        setReduceMotion(true);
        logoScale.setValue(1);
        logoOpacity.setValue(1);
        ringOpacity.setValue(1);
        wordmarkOpacity.setValue(1);
        wordmarkTranslateY.setValue(0);
        taglineOpacity.setValue(1);
        taglineTranslateY.setValue(0);
        dotsOpacity.setValue(1);
        fillProgress.setValue(1);
        setEntranceDone(true);
      }
    }).catch(() => { });
  }, []);

  // Main animation timeline
  useEffect(() => {
    if (reduceMotion) return;

    // 1. Continuous Orbital Ring Spin Animation
    const spinLoop = Animated.loop(
      Animated.timing(orbitSpin, {
        toValue: 1,
        duration: 3400,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    spinLoop.start();

    // 2. Subtle Wave Gentle Float
    const waveLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(waveFloat, {
          toValue: 1,
          duration: 3200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(waveFloat, {
          toValue: 0,
          duration: 3200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    waveLoop.start();

    // 3. Three Loading Dots Sequential Pulse
    const createDotPulse = (anim: Animated.Value) => {
      return Animated.sequence([
        Animated.timing(anim, {
          toValue: 1,
          duration: 380,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: 380,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(400),
      ]);
    };

    const dotsLoop = Animated.loop(
      Animated.parallel([
        createDotPulse(dot1Anim),
        Animated.sequence([Animated.delay(180), createDotPulse(dot2Anim)]),
        Animated.sequence([Animated.delay(360), createDotPulse(dot3Anim)]),
      ])
    );
    dotsLoop.start();

    // 4. Logo Bottom-to-Top Color Fill Animation (synchronized with orbit loading)
    Animated.sequence([
      Animated.delay(100),
      Animated.timing(fillProgress, {
        toValue: 1,
        duration: 1100,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        useNativeDriver: false,
      }),
    ]).start();

    // 5. Staggered Entrance Choreography (Snappy for 1.5s total duration)
    // 0-300ms: Logo fades in and scales gently
    Animated.parallel([
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(logoScale, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.back(1.2)),
        useNativeDriver: true,
      }),
    ]).start();

    // 150-600ms: Orbital ring stroke fades in and travels
    setTimeout(() => {
      Animated.timing(ringOpacity, {
        toValue: 1,
        duration: 400,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    }, 150);

    // 350-700ms: VOLO wordmark fades in with subtle upward movement
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(wordmarkOpacity, {
          toValue: 1,
          duration: 350,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(wordmarkTranslateY, {
          toValue: 0,
          duration: 350,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }, 350);

    // 550-900ms: Tagline fades in and settles into place
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(taglineOpacity, {
          toValue: 1,
          duration: 350,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(taglineTranslateY, {
          toValue: 0,
          duration: 350,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(dotsOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setEntranceDone(true);
      });
    }, 550);

    return () => {
      spinLoop.stop();
      waveLoop.stop();
      dotsLoop.stop();
    };
  }, [reduceMotion]);

  // Ensure the intro screen stays visible for at least 1.5 seconds, but force exit by 2.8s max
  useEffect(() => {
    const timer = setTimeout(() => {
      setMinTimeElapsed(true);
    }, 1500);

    // Hard fallback: never trap the user on loading screen if storage or initialization is delayed
    const hardTimeout = setTimeout(() => {
      if (!isExiting.current) {
        isExiting.current = true;
        Animated.timing(exitOpacity, {
          toValue: 0,
          duration: 300,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }).start(() => {
          onExitComplete();
        });
      }
    }, 2800);

    return () => {
      clearTimeout(timer);
      clearTimeout(hardTimeout);
    };
  }, []);

  // Smooth exit transition once 1.5 seconds have elapsed and initialization is finished
  useEffect(() => {
    if (minTimeElapsed && !isInitializing && !isExiting.current) {
      isExiting.current = true;
      Animated.timing(exitOpacity, {
        toValue: 0,
        duration: 300,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }).start(() => {
        onExitComplete();
      });
    }
  }, [minTimeElapsed, isInitializing]);

  // Interpolations
  const spinInterpolation = orbitSpin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const waveTranslateY = waveFloat.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -3.5],
  });

  const getDotStyle = (anim: Animated.Value) => {
    const scale = anim.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 1.35],
    });
    const opacity = anim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.45, 1],
    });
    return {
      transform: [{ scale }],
      opacity,
    };
  };

  return (
    <Animated.View style={[styles.container, { opacity: exitOpacity }]}>

      {/* 1. Subtle Lavender Radial Ambient Glow */}
      <View style={[styles.radialGlow, { pointerEvents: 'none' } as any]} />

      {/* 2. Main Center Content Lockup */}
      <View style={styles.centerContent}>

        {/* Orbital Ring & Logo Wrapper */}
        <View style={styles.orbitalRingContainer}>

          {/* Base Pale Lavender Circular Ring */}
          <Svg width={RING_SIZE} height={RING_SIZE} style={StyleSheet.absoluteFill}>
            <Circle
              cx={CENTER}
              cy={CENTER}
              r={RADIUS}
              stroke="#D9C5FF"
              strokeWidth={1.8}
              fill="none"
            />
          </Svg>

          {/* Animated Rotating Purple Stroke with Leading Glowing Dot */}
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              {
                opacity: ringOpacity,
                transform: [{ rotate: spinInterpolation }],
              },
            ]}
          >
            <Svg width={RING_SIZE} height={RING_SIZE}>
              <Path
                d={orbitalArcPath}
                stroke="#8B35F5"
                strokeWidth={2.4}
                strokeLinecap="round"
                fill="none"
              />
            </Svg>

            {/* Glowing Purple Highlight at the Leading Edge */}
            <View
              style={[
                styles.orbitalHighlightOuter,
                {
                  left: arcEndX - 7,
                  top: arcEndY - 7,
                },
              ]}
            >
              <View style={styles.orbitalHighlightInner} />
            </View>
          </Animated.View>

          {/* Centered Official VOLO Logo with Bottom-to-Top Loading Color Fill */}
          <Animated.View
            style={[
              styles.logoBadge,
              {
                opacity: logoOpacity,
                transform: [{ scale: logoScale }],
              },
            ]}
          >
            {/* Base Layer: Ghost / Outline Logo */}
            <Image
              source={require('../../assets/volo logo c.png')}
              style={[styles.logoImage, { opacity: 0.18 }]}
              resizeMode="contain"
            />

            {/* Fill Layer: Colored Logo filling from bottom to top */}
            <Animated.View
              style={[
                styles.fillContainer,
                {
                  height: fillProgress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, LOGO_SIZE],
                  }),
                },
              ]}
            >
              <Image
                source={require('../../assets/volo logo c.png')}
                style={styles.fillImage}
                resizeMode="contain"
              />
            </Animated.View>
          </Animated.View>
        </View>

        {/* 3. Official VOLO Wordmark */}
        <Animated.View
          style={[
            styles.wordmarkContainer,
            {
              opacity: wordmarkOpacity,
              transform: [{ translateY: wordmarkTranslateY }],
            },
          ]}
        >
          <Image
            source={require('../../assets/volo logo 2.png')}
            style={styles.wordmarkImage}
            resizeMode="contain"
          />
        </Animated.View>

        {/* 4. Brand Tagline */}
        <Animated.View
          style={[
            styles.taglineContainer,
            {
              opacity: taglineOpacity,
              transform: [{ translateY: taglineTranslateY }],
            },
          ]}
        >
          <Text style={styles.taglineText}>Your Home. Our Care.</Text>
        </Animated.View>

        {/* 5. Three Sequential Pulsing Loading Dots */}
        {(isInitializing || !minTimeElapsed) && (
          <Animated.View style={[styles.dotsContainer, { opacity: dotsOpacity }]}>
            <Animated.View style={[styles.dot, getDotStyle(dot1Anim)]} />
            <Animated.View style={[styles.dot, getDotStyle(dot2Anim)]} />
            <Animated.View style={[styles.dot, getDotStyle(dot3Anim)]} />
          </Animated.View>
        )}

      </View>

      {/* 6. Soft Lavender Bottom Waves */}
      <Animated.View
        style={[
          styles.wavesContainer,
          { transform: [{ translateY: waveTranslateY }], pointerEvents: 'none' } as any
        ]}
      >
        <Svg width={SCREEN_WIDTH} height={WAVE_HEIGHT} viewBox={`0 0 ${SCREEN_WIDTH} ${WAVE_HEIGHT}`}>
          {/* Back Wave (Lightest Lavender) */}
          <Path
            d={`M 0 ${WAVE_HEIGHT * 0.38} C ${SCREEN_WIDTH * 0.28} ${WAVE_HEIGHT * 0.18}, ${SCREEN_WIDTH * 0.58} ${WAVE_HEIGHT * 0.55}, ${SCREEN_WIDTH} ${WAVE_HEIGHT * 0.28} L ${SCREEN_WIDTH} ${WAVE_HEIGHT} L 0 ${WAVE_HEIGHT} Z`}
            fill="#EDE4FF"
            opacity={0.55}
          />
          {/* Middle Wave */}
          <Path
            d={`M 0 ${WAVE_HEIGHT * 0.54} C ${SCREEN_WIDTH * 0.35} ${WAVE_HEIGHT * 0.32}, ${SCREEN_WIDTH * 0.68} ${WAVE_HEIGHT * 0.68}, ${SCREEN_WIDTH} ${WAVE_HEIGHT * 0.44} L ${SCREEN_WIDTH} ${WAVE_HEIGHT} L 0 ${WAVE_HEIGHT} Z`}
            fill="#E4D5FF"
            opacity={0.65}
          />
          {/* Front Wave (Soft Base) */}
          <Path
            d={`M 0 ${WAVE_HEIGHT * 0.68} C ${SCREEN_WIDTH * 0.42} ${WAVE_HEIGHT * 0.52}, ${SCREEN_WIDTH * 0.72} ${WAVE_HEIGHT * 0.75}, ${SCREEN_WIDTH} ${WAVE_HEIGHT * 0.58} L ${SCREEN_WIDTH} ${WAVE_HEIGHT} L 0 ${WAVE_HEIGHT} Z`}
            fill="#F2EBFD"
            opacity={0.88}
          />
          {/* Translucent Highlight Curve along Crest */}
          <Path
            d={`M 0 ${WAVE_HEIGHT * 0.54} C ${SCREEN_WIDTH * 0.35} ${WAVE_HEIGHT * 0.32}, ${SCREEN_WIDTH * 0.68} ${WAVE_HEIGHT * 0.68}, ${SCREEN_WIDTH} ${WAVE_HEIGHT * 0.44}`}
            fill="none"
            stroke="rgba(255, 255, 255, 0.75)"
            strokeWidth={1.5}
          />
        </Svg>
      </Animated.View>

    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...(StyleSheet.absoluteFill as object),
    backgroundColor: '#FAF8FF',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 99999,
  },
  radialGlow: {
    position: 'absolute',
    width: 330,
    height: 330,
    borderRadius: 165,
    backgroundColor: 'rgba(217, 197, 255, 0.28)',
    top: '28%',
    ...Platform.select({
      ios: {
        shadowColor: '#8B35F5',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.18,
        shadowRadius: 60,
      },
      android: {
        elevation: 6,
      },
      default: {
        boxShadow: '0 0 80px rgba(139, 53, 245, 0.15)',
      },
    }),
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    marginTop: -SCREEN_HEIGHT * 0.05,
  },
  orbitalRingContainer: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  orbitalHighlightOuter: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(139, 53, 245, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbitalHighlightInner: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#8B35F5',
    ...Platform.select({
      ios: {
        shadowColor: '#8B35F5',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 6,
      },
      android: {
        elevation: 4,
      },
      default: {
        boxShadow: '0 0 6px #8B35F5',
      },
    }),
  },
  logoBadge: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  logoImage: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
  },
  fillContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: LOGO_SIZE,
    overflow: 'hidden',
  },
  fillImage: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: LOGO_SIZE,
    height: LOGO_SIZE,
  },
  wordmarkContainer: {
    marginTop: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmarkImage: {
    width: WORDMARK_WIDTH,
    height: WORDMARK_HEIGHT,
  },
  taglineContainer: {
    marginTop: 8,
    alignItems: 'center',
  },
  taglineText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#5F537C',
    letterSpacing: 2,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    height: 16,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#8B35F5',
    marginHorizontal: 4.5,
  },
  wavesContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: WAVE_HEIGHT,
    zIndex: 1,
  },
});
