import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, Text, Animated, Easing, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AnimatedLogo } from './AnimatedLogo';
import { LoadingIndicator } from './LoadingIndicator';

interface BrandIntroScreenProps {
  isInitializing: boolean;
  onExitComplete: () => void;
}

export function BrandIntroScreen({ isInitializing, onExitComplete }: BrandIntroScreenProps) {
  // Anim values
  const bgOpacity = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const textTranslateY = useRef(new Animated.Value(10)).current;
  const loaderOpacity = useRef(new Animated.Value(0)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;

  // Exit anim values
  const exitScale = useRef(new Animated.Value(1)).current;
  const exitOpacity = useRef(new Animated.Value(1)).current;

  const [minTimeElapsed, setMinTimeElapsed] = useState(false);

  useEffect(() => {
    // 1. Fade in background first
    Animated.timing(bgOpacity, {
      toValue: 1,
      duration: 600,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start(() => {
      // 2. Fade in Brand Name and Tagline after a slight delay
      Animated.parallel([
        Animated.timing(contentOpacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(textTranslateY, {
          toValue: 0,
          duration: 800,
          easing: Easing.out(Easing.back(1.5)),
          useNativeDriver: true,
        }),
      ]).start(() => {
        // 3. Fade in bottom loading indicators
        Animated.timing(loaderOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }).start();
      });
    });

    // Slow ambient oscillation for the floating background tool icons
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 1,
          duration: 3500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 3500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // 3 seconds minimum timer for brand exposure
    const timer = setTimeout(() => {
      setMinTimeElapsed(true);
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  // Trigger exit animation once minimum time has passed and initialization is complete
  useEffect(() => {
    if (minTimeElapsed && !isInitializing) {
      Animated.parallel([
        // Logo gently shrinks
        Animated.timing(exitScale, {
          toValue: 0.95,
          duration: 400,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        // Full screen fades out
        Animated.timing(exitOpacity, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start(() => {
        onExitComplete();
      });
    }
  }, [minTimeElapsed, isInitializing]);

  // Floating interpolations
  const floatY1 = floatAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -12] });
  const floatY2 = floatAnim.interpolate({ inputRange: [0, 1], outputRange: [-6, 6] });
  const floatY3 = floatAnim.interpolate({ inputRange: [0, 1], outputRange: [8, -8] });
  const floatY4 = floatAnim.interpolate({ inputRange: [0, 1], outputRange: [-10, 4] });
  const floatY5 = floatAnim.interpolate({ inputRange: [0, 1], outputRange: [4, -10] });
  const floatY6 = floatAnim.interpolate({ inputRange: [0, 1], outputRange: [-8, 2] });

  return (
    <Animated.View 
      style={[
        styles.fullScreen, 
        { 
          opacity: exitOpacity,
          backgroundColor: '#0a0f1d'
        }
      ]}
    >
      {/* Background Fade overlay */}
      <Animated.View style={[styles.backgroundOverlay, { opacity: bgOpacity }]} />

      {/* Floating Background Tool Watermark Icons */}
      <Animated.View 
        pointerEvents={Platform.OS !== 'web' ? 'none' : undefined}
        style={[
          styles.watermarkContainer, 
          Platform.OS === 'web' && { pointerEvents: 'none' } as any,
          { opacity: bgOpacity }
        ]}
      >
        <Animated.View style={[styles.iconFloat, { top: '15%', left: '12%', transform: [{ translateY: floatY1 }] }]}>
          <MaterialCommunityIcons name="hammer" size={32} color="rgba(255, 255, 255, 0.05)" />
        </Animated.View>
        <Animated.View style={[styles.iconFloat, { top: '22%', right: '14%', transform: [{ translateY: floatY2 }] }]}>
          <MaterialCommunityIcons name="wrench" size={28} color="rgba(255, 255, 255, 0.05)" />
        </Animated.View>
        <Animated.View style={[styles.iconFloat, { top: '48%', left: '8%', transform: [{ translateY: floatY3 }] }]}>
          <MaterialCommunityIcons name="broom" size={32} color="rgba(255, 255, 255, 0.05)" />
        </Animated.View>
        <Animated.View style={[styles.iconFloat, { top: '42%', right: '10%', transform: [{ translateY: floatY4 }] }]}>
          <MaterialCommunityIcons name="flash" size={30} color="rgba(255, 255, 255, 0.05)" />
        </Animated.View>
        <Animated.View style={[styles.iconFloat, { bottom: '26%', left: '16%', transform: [{ translateY: floatY5 }] }]}>
          <MaterialCommunityIcons name="air-conditioner" size={28} color="rgba(255, 255, 255, 0.05)" />
        </Animated.View>
        <Animated.View style={[styles.iconFloat, { bottom: '22%', right: '16%', transform: [{ translateY: floatY6 }] }]}>
          <MaterialCommunityIcons name="paint-brush" size={30} color="rgba(255, 255, 255, 0.05)" />
        </Animated.View>
      </Animated.View>

      <Animated.View 
        style={[
          styles.container, 
          { 
            transform: [{ scale: exitScale }] 
          }
        ]}
      >
        {/* Animated logo */}
        <AnimatedLogo />

        {/* Text information */}
        <Animated.View 
          style={{ 
            opacity: contentOpacity,
            transform: [{ translateY: textTranslateY }],
            alignItems: 'center',
            marginTop: 28 
          }}
        >
          <Text style={styles.brandTitle}>VOLO</Text>
          <Text style={styles.tagline}>Home Services, Simplified</Text>
        </Animated.View>
      </Animated.View>

      {/* Bottom area with loader */}
      <Animated.View style={[styles.bottomContainer, { opacity: loaderOpacity }]}>
        <LoadingIndicator />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fullScreen: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  backgroundOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0a0f1d',
  },
  watermarkContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  iconFloat: {
    position: 'absolute',
  },
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitle: {
    fontSize: 34,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 5,
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif-condensed',
  },
  tagline: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ff7a00',
    letterSpacing: 2,
    marginTop: 8,
    textTransform: 'uppercase',
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 60,
    width: '100%',
    alignItems: 'center',
  },
});
