import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Animated, Image, AccessibilityInfo, Platform, View, Easing } from 'react-native';

interface AnimatedLogoProps {
  onComplete?: () => void;
}

export function AnimatedLogo({ onComplete }: AnimatedLogoProps) {
  const [reduceMotion, setReduceMotion] = useState(false);
  
  // Animation values
  const scale = useRef(new Animated.Value(reduceMotion ? 1 : 0.8)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(reduceMotion ? 0 : 20)).current;
  const glow = useRef(new Animated.Value(0.3)).current;
  const shineX = useRef(new Animated.Value(-150)).current;

  useEffect(() => {
    // Check accessibility settings for reduced motion
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
      // Simple fade animation for reduced motion accessibility
      Animated.timing(opacity, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }).start(() => {
        if (onComplete) onComplete();
      });
      return;
    }

    // Sequence: Fade in + Scale up + Translate Y smoothly, followed by a light sweep
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 1000,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Animate the glossy light sweep across the logo
      Animated.timing(shineX, {
        toValue: 180,
        duration: 1000,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();

      // Soft breathing glow animation loop
      Animated.loop(
        Animated.sequence([
          Animated.timing(glow, {
            toValue: 0.8,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(glow, {
            toValue: 0.3,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      ).start();

      if (onComplete) {
        onComplete();
      }
    });
  }, [reduceMotion]);

  // Use stable interpolation instead of Animated.multiply for better web compat
  const glowOpacity = glow.interpolate({
    inputRange: [0.3, 0.8],
    outputRange: [0.036, 0.096],
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
      <View style={styles.logoWrapper}>
        <Image
          source={require('../../assets/logo.jpeg')}
          style={styles.logo}
          resizeMode="cover"
        />
        
        {/* Premium Crescent Reflection Glass Glare */}
        <View 
          pointerEvents={Platform.OS !== 'web' ? 'none' : undefined}
          style={[
            styles.reflectionOverlay,
            Platform.OS === 'web' && { pointerEvents: 'none' } as any
          ]}
        />
        
        {/* Soft light sweep highlight */}
        {!reduceMotion && (
          <Animated.View 
            pointerEvents={Platform.OS !== 'web' ? 'none' : undefined}
            style={[
              styles.shineSweep,
              Platform.OS === 'web' && { pointerEvents: 'none' } as any,
              {
                transform: [{ translateX: shineX }, { rotate: '25deg' }],
              }
            ]}
          />
        )}
      </View>

      {/* Subtle pulsing glow background behind sphere */}
      {!reduceMotion && (
        <Animated.View
          style={[
            styles.glowBackground,
            {
              opacity: glowOpacity,
            },
          ]}
        />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    width: 140,
    height: 140,
  },
  logoWrapper: {
    width: 120,
    height: 120,
    borderRadius: 60, // Perfect sphere clipping mask
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#ffffff',
    zIndex: 2,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.25,
        shadowRadius: 20,
      },
      android: {
        elevation: 12,
      },
      default: {
        boxShadow: '0px 12px 24px rgba(0, 0, 0, 0.25)',
      },
    }),
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  reflectionOverlay: {
    position: 'absolute',
    top: -50,
    left: -40,
    width: 200,
    height: 100,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 100,
    transform: [{ rotate: '-15deg' }],
    zIndex: 3,
  },
  shineSweep: {
    position: 'absolute',
    top: -30,
    bottom: -30,
    width: 45,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
    zIndex: 4,
  },
  glowBackground: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#6366f1',
    zIndex: 1,
    transform: [{ scale: 1.2 }],
  },
});
