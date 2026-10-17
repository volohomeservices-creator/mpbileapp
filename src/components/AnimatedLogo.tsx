import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Animated, Image, AccessibilityInfo, Platform, View, Easing } from 'react-native';

interface AnimatedLogoProps {
  onComplete?: () => void;
}

export function AnimatedLogo({ onComplete }: AnimatedLogoProps) {
  const [reduceMotion, setReduceMotion] = useState(false);
  
  // Animation values
  const scale = useRef(new Animated.Value(reduceMotion ? 1 : 0.75)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(reduceMotion ? 0 : 25)).current;
  const glow = useRef(new Animated.Value(0.4)).current;
  const shineX = useRef(new Animated.Value(-160)).current;

  // Flash Shockwave pulse rings
  const ringScale1 = useRef(new Animated.Value(0.8)).current;
  const ringOpacity1 = useRef(new Animated.Value(0)).current;
  const ringScale2 = useRef(new Animated.Value(0.8)).current;
  const ringOpacity2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (enabled) {
        setReduceMotion(true);
        scale.setValue(1);
        translateY.setValue(0);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      Animated.timing(opacity, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }).start(() => {
        if (onComplete) onComplete();
      });
      return;
    }

    // Entrance animation: Powerful scale-up and spring entrance
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 900,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        tension: 40,
        friction: 6,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        tension: 40,
        friction: 6,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // 1. Looping high-speed light sweep (flash streaks) across the logo
      Animated.loop(
        Animated.sequence([
          Animated.timing(shineX, {
            toValue: 190,
            duration: 850,
            easing: Easing.bezier(0.2, 0.8, 0.2, 1),
            useNativeDriver: true,
          }),
          Animated.delay(1200),
          Animated.timing(shineX, {
            toValue: -160,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      ).start();

      // 2. Continuous shockwave ripple flash ring 1
      Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(ringScale1, {
              toValue: 1.85,
              duration: 2000,
              easing: Easing.out(Easing.sin),
              useNativeDriver: true,
            }),
            Animated.sequence([
              Animated.timing(ringOpacity1, {
                toValue: 0.65,
                duration: 400,
                useNativeDriver: true,
              }),
              Animated.timing(ringOpacity1, {
                toValue: 0,
                duration: 1600,
                useNativeDriver: true,
              }),
            ]),
          ]),
          Animated.timing(ringScale1, {
            toValue: 0.8,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      ).start();

      // 3. Offset shockwave ripple flash ring 2
      setTimeout(() => {
        Animated.loop(
          Animated.sequence([
            Animated.parallel([
              Animated.timing(ringScale2, {
                toValue: 2.1,
                duration: 2200,
                easing: Easing.out(Easing.sin),
                useNativeDriver: true,
              }),
              Animated.sequence([
                Animated.timing(ringOpacity2, {
                  toValue: 0.5,
                  duration: 500,
                  useNativeDriver: true,
                }),
                Animated.timing(ringOpacity2, {
                  toValue: 0,
                  duration: 1700,
                  useNativeDriver: true,
                }),
              ]),
            ]),
            Animated.timing(ringScale2, {
              toValue: 0.8,
              duration: 0,
              useNativeDriver: true,
            }),
          ])
        ).start();
      }, 700);

      // 4. Ambient breathing glow pulse
      Animated.loop(
        Animated.sequence([
          Animated.timing(glow, {
            toValue: 1,
            duration: 1400,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(glow, {
            toValue: 0.4,
            duration: 1400,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      ).start();

      if (onComplete) onComplete();
    });
  }, [reduceMotion]);

  const glowScale = glow.interpolate({
    inputRange: [0.4, 1],
    outputRange: [1.1, 1.45],
  });

  const glowOpacity = glow.interpolate({
    inputRange: [0.4, 1],
    outputRange: [0.35, 0.75],
  });

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity,
          transform: [{ scale }, { translateY }],
        },
      ]}
    >
      {/* Shockwave Pulse Ring 1 */}
      {!reduceMotion && (
        <Animated.View
          style={[
            styles.shockwaveRing,
            {
              transform: [{ scale: ringScale1 }],
              opacity: ringOpacity1,
            },
          ]}
        />
      )}

      {/* Shockwave Pulse Ring 2 */}
      {!reduceMotion && (
        <Animated.View
          style={[
            styles.shockwaveRingCyan,
            {
              transform: [{ scale: ringScale2 }],
              opacity: ringOpacity2,
            },
          ]}
        />
      )}

      {/* Luminous Core Glow Aura */}
      {!reduceMotion && (
        <Animated.View
          style={[
            styles.glowBackground,
            {
              transform: [{ scale: glowScale }],
              opacity: glowOpacity,
            },
          ]}
        />
      )}

      {/* Main Glass Sphere with Logo */}
      <View style={styles.logoWrapper}>
        <Image
          source={require('../../assets/logo.webp')}
          style={styles.logo}
          resizeMode="cover"
        />
        
        {/* Curved Glass Reflection Glare */}
        <View 
          style={[
            styles.reflectionOverlay,
            { pointerEvents: 'none' } as any
          ]}
        />

        {/* High-speed Light Streak Flash */}
        {!reduceMotion && (
          <Animated.View 
            style={[
              styles.shineSweep,
              { pointerEvents: 'none' } as any,
              {
                transform: [{ translateX: shineX }, { rotate: '30deg' }],
              }
            ]}
          />
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    width: 170,
    height: 170,
  },
  shockwaveRing: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 2,
    borderColor: '#A855F7',
    zIndex: 1,
  },
  shockwaveRingCyan: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 1.5,
    borderColor: '#38BDF8',
    zIndex: 1,
  },
  glowBackground: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: '#7C3AED',
    zIndex: 2,
    ...Platform.select({
      ios: {
        shadowColor: '#A855F7',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.9,
        shadowRadius: 35,
      },
      android: {
        elevation: 20,
      },
      default: {
        boxShadow: '0 0 50px rgba(168, 85, 247, 0.75)',
      },
    }),
  },
  logoWrapper: {
    width: 130,
    height: 130,
    borderRadius: 65,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#3C01A7',
    zIndex: 3,
    borderWidth: 2.5,
    borderColor: 'rgba(255, 255, 255, 0.45)',
    ...Platform.select({
      ios: {
        shadowColor: '#A855F7',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 25,
      },
      android: {
        elevation: 16,
      },
      default: {
        boxShadow: '0px 10px 30px rgba(168, 85, 247, 0.5)',
      },
    }),
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  reflectionOverlay: {
    position: 'absolute',
    top: -55,
    left: -40,
    width: 210,
    height: 110,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    borderRadius: 105,
    transform: [{ rotate: '-18deg' }],
    zIndex: 4,
  },
  shineSweep: {
    position: 'absolute',
    top: -40,
    bottom: -40,
    width: 48,
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
    zIndex: 5,
  },
});
