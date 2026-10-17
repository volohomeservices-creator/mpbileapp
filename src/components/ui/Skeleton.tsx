import React, { useEffect, useRef } from 'react';
import { View, Animated, ViewProps, StyleSheet, Dimensions } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface SkeletonProps extends ViewProps {
  className?: string;
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
}

export function Skeleton({ className = '', style, width, height, borderRadius, ...props }: SkeletonProps) {
  const opacity = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.75,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.35,
          duration: 750,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          opacity,
          backgroundColor: '#E2D9F3',
          ...(width !== undefined ? { width: width as any } : {}),
          ...(height !== undefined ? { height: height as any } : {}),
          ...(borderRadius !== undefined ? { borderRadius } : { borderRadius: 12 }),
        },
        style,
      ]}
      className={className}
      {...props}
    />
  );
}

/**
 * Loading Skeleton for Customer Mobile Home Screen
 */
export function CustomerHomeSkeleton() {
  return (
    <View className="flex-1 bg-[#F8F7FC]">
      {/* Hero Dark Container Shimmer */}
      <View style={{ backgroundColor: '#0B0224' }} className="w-full px-5 pt-4 pb-12 relative overflow-hidden">
        <View className="pr-2 z-10">
          <Skeleton width={130} height={24} borderRadius={20} style={{ backgroundColor: 'rgba(255,255,255,0.18)' }} className="mb-3" />
          <Skeleton width="75%" height={28} borderRadius={10} style={{ backgroundColor: 'rgba(255,255,255,0.22)' }} className="mb-2" />
          <Skeleton width="55%" height={28} borderRadius={10} style={{ backgroundColor: 'rgba(255,255,255,0.22)' }} className="mb-4" />
          
          <View className="flex-row gap-2 mb-4">
            <Skeleton width={75} height={16} borderRadius={8} style={{ backgroundColor: 'rgba(255,255,255,0.15)' }} />
            <Skeleton width={85} height={16} borderRadius={8} style={{ backgroundColor: 'rgba(255,255,255,0.15)' }} />
            <Skeleton width={75} height={16} borderRadius={8} style={{ backgroundColor: 'rgba(255,255,255,0.15)' }} />
          </View>

          <Skeleton width={140} height={40} borderRadius={24} style={{ backgroundColor: 'rgba(255,255,255,0.25)' }} />
        </View>
      </View>

      {/* Curved Content Sheet Shimmer */}
      <View className="bg-[#F8F7FC] rounded-t-[36px] -mt-6 pt-5 px-5 flex-1">
        {/* Search Bar Shimmer */}
        <Skeleton width="100%" height={48} borderRadius={16} className="mb-6" />

        {/* Categories Section Shimmer */}
        <View className="flex-row justify-between items-center mb-3">
          <Skeleton width={110} height={18} borderRadius={8} />
          <Skeleton width={50} height={14} borderRadius={6} />
        </View>

        <View className="bg-white border border-[#E6E0F5] rounded-3xl p-4 mb-6 flex-row flex-wrap justify-between gap-y-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <View key={i} style={{ width: '23%' }} className="items-center">
              <Skeleton width={50} height={50} borderRadius={16} className="mb-2" />
              <Skeleton width={44} height={10} borderRadius={6} />
            </View>
          ))}
        </View>

        {/* Popular Services Section Shimmer */}
        <View className="flex-row justify-between items-center mb-3">
          <Skeleton width={120} height={18} borderRadius={8} />
          <Skeleton width={50} height={14} borderRadius={6} />
        </View>

        <View className="flex-row gap-3">
          {[1, 2].map((i) => (
            <View key={i} className="bg-white border border-[#E6E0F5] rounded-3xl p-4 w-52">
              <View className="flex-row justify-between mb-3">
                <Skeleton width={44} height={44} borderRadius={16} />
                <Skeleton width={50} height={16} borderRadius={10} />
              </View>
              <Skeleton width="85%" height={16} borderRadius={8} className="mb-2" />
              <Skeleton width="60%" height={12} borderRadius={6} className="mb-4" />
              <View className="flex-row justify-between items-center pt-2 border-t border-slate-100">
                <Skeleton width={60} height={18} borderRadius={8} />
                <Skeleton width={70} height={28} borderRadius={12} />
              </View>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

/**
 * Loading Skeleton for Worker Mobile Home Screen
 */
export function WorkerHomeSkeleton() {
  return (
    <View className="flex-1 bg-[#F8F7FC] px-4 pt-3">
      {/* Greeting & Duty Switch Card Shimmer */}
      <View className="bg-white rounded-3xl p-4 border border-slate-100 shadow-sm flex-row items-center justify-between mb-3">
        <View className="flex-1 mr-3">
          <Skeleton width={90} height={12} borderRadius={6} className="mb-1.5" />
          <Skeleton width={140} height={22} borderRadius={8} />
        </View>
        <Skeleton width={120} height={44} borderRadius={18} />
      </View>

      {/* Hero Announcement Shimmer */}
      <Skeleton width="100%" height={110} borderRadius={20} className="mb-4" />

      {/* Today's Earnings Card Shimmer */}
      <View className="bg-[#18073E] rounded-[24px] p-5 border border-purple-800/40 mb-4">
        <View className="flex-row justify-between items-center mb-3">
          <Skeleton width={100} height={14} borderRadius={6} style={{ backgroundColor: 'rgba(255,255,255,0.2)' }} />
          <Skeleton width={80} height={20} borderRadius={12} style={{ backgroundColor: 'rgba(255,255,255,0.2)' }} />
        </View>

        <View className="flex-row justify-between items-center mt-1">
          <View>
            <Skeleton width={110} height={32} borderRadius={10} style={{ backgroundColor: 'rgba(255,255,255,0.3)' }} className="mb-2" />
            <Skeleton width={85} height={14} borderRadius={6} style={{ backgroundColor: 'rgba(255,255,255,0.2)' }} />
          </View>
          <View className="flex-row gap-4 border-l border-white/15 pl-4">
            <View className="items-center">
              <Skeleton width={30} height={20} borderRadius={6} style={{ backgroundColor: 'rgba(255,255,255,0.25)' }} className="mb-1" />
              <Skeleton width={45} height={10} borderRadius={4} style={{ backgroundColor: 'rgba(255,255,255,0.15)' }} />
            </View>
            <View className="items-center">
              <Skeleton width={30} height={20} borderRadius={6} style={{ backgroundColor: 'rgba(255,255,255,0.25)' }} className="mb-1" />
              <Skeleton width={45} height={10} borderRadius={4} style={{ backgroundColor: 'rgba(255,255,255,0.15)' }} />
            </View>
          </View>
        </View>
      </View>

      {/* Job Cards Header Shimmer */}
      <View className="flex-row justify-between items-center mb-3 mt-1">
        <Skeleton width={130} height={18} borderRadius={8} />
        <Skeleton width={60} height={14} borderRadius={6} />
      </View>

      {/* Job Card Shimmer */}
      <View className="bg-white rounded-3xl p-4 border border-slate-100 shadow-sm mb-3">
        <View className="flex-row justify-between items-center mb-3">
          <Skeleton width={120} height={16} borderRadius={6} />
          <Skeleton width={60} height={18} borderRadius={10} />
        </View>
        <Skeleton width="80%" height={14} borderRadius={6} className="mb-2" />
        <Skeleton width="50%" height={12} borderRadius={6} className="mb-4" />
        <View className="flex-row gap-3 pt-3 border-t border-slate-100">
          <Skeleton width="48%" height={38} borderRadius={16} />
          <Skeleton width="48%" height={38} borderRadius={16} />
        </View>
      </View>
    </View>
  );
}

/**
 * Loading Skeleton for Worker / Captain Wallet Screen
 */
export function WorkerWalletSkeleton() {
  return (
    <View className="flex-1 bg-[#F8F7FC] px-6 pt-6">
      {/* Wallet Balance Hero Card Shimmer */}
      <View className="bg-[#18073E] rounded-[28px] p-6 border border-purple-800/40 mb-4">
        <View className="flex-row justify-between items-center mb-4">
          <Skeleton width={130} height={20} borderRadius={10} style={{ backgroundColor: 'rgba(255,255,255,0.2)' }} />
          <Skeleton width={60} height={20} borderRadius={10} style={{ backgroundColor: 'rgba(255,255,255,0.2)' }} />
        </View>
        <Skeleton width={180} height={40} borderRadius={12} style={{ backgroundColor: 'rgba(255,255,255,0.35)' }} className="mb-4" />
        <Skeleton width={160} height={22} borderRadius={10} style={{ backgroundColor: 'rgba(255,255,255,0.18)' }} className="mb-5" />
        <View className="flex-row gap-3">
          <Skeleton width={110} height={42} borderRadius={14} style={{ backgroundColor: 'rgba(255,255,255,0.3)' }} />
          <Skeleton width={110} height={42} borderRadius={14} style={{ backgroundColor: 'rgba(255,255,255,0.18)' }} />
        </View>
      </View>

      {/* Metrics Row Shimmer */}
      <View className="flex-row gap-2 mb-6">
        <Skeleton width="31%" height={56} borderRadius={16} />
        <Skeleton width="31%" height={56} borderRadius={16} />
        <Skeleton width="31%" height={56} borderRadius={16} />
      </View>

      {/* Transactions Header Shimmer */}
      <Skeleton width={140} height={16} borderRadius={6} className="mb-3" />

      {/* Transaction Cards Shimmer */}
      {[1, 2, 3, 4].map((i) => (
        <View key={i} className="bg-white rounded-2xl p-4 border border-[#E6E0F5] mb-2.5 flex-row justify-between items-center">
          <View className="flex-1 mr-3">
            <Skeleton width="70%" height={14} borderRadius={6} className="mb-2" />
            <Skeleton width="40%" height={10} borderRadius={4} />
          </View>
          <Skeleton width={70} height={18} borderRadius={8} />
        </View>
      ))}
    </View>
  );
}
