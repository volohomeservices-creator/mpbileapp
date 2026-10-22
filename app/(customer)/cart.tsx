import React, { useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, Platform, BackHandler } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCartStore } from '@/features/cart/cartStore';
import { useLanguage } from '@/hooks/useLanguage';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useQuery } from '@tanstack/react-query';
import { apiPost } from '@/api/client';

export default function CartScreen() {
  const router = useRouter();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const { t } = useLanguage();

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(customer)/home');
    }
  };

  useEffect(() => {
    const onBackPress = () => {
      handleBack();
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, []);
  const { items, removeItem, addItem, deleteItem, clearCart, getTotalCount, getTotalPrice } = useCartStore();

  const totalCount = getTotalCount();
  const itemTotal = getTotalPrice();

  const { data: pricingData } = useQuery({
    queryKey: ['cart-pricing-breakdown', itemTotal],
    queryFn: async () => {
      return apiPost<any>('/api/pricing/calculate', { serviceAmount: itemTotal });
    },
    enabled: itemTotal > 0,
  });

  const isPlatformFeeEnabled = pricingData ? pricingData.platformFeeEnabled : true;
  const platformFee = pricingData ? Number(pricingData.platformFee || 0) : Math.round(itemTotal * 0.10);
  const platformFeeLabel = pricingData?.platformFeeLabel || 'Platform Fee';
  const isTaxEnabled = pricingData ? pricingData.taxEnabled : true;
  const taxes = pricingData ? Number(pricingData.taxAmount || 0) : Math.round(itemTotal * 0.05);
  const taxLabel = pricingData?.taxLabel || `${t('bookings.feeTaxes')} (5%)`;
  const grandTotal = itemTotal + (isPlatformFeeEnabled ? platformFee : 0) + (isTaxEnabled ? taxes : 0);

  const handleClearCart = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to remove all items from your cart?')) {
        clearCart();
      }
    } else {
      Alert.alert(
        t('bookings.clearCart'),
        'Are you sure you want to remove all items from your cart?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Clear', style: 'destructive', onPress: clearCart },
        ]
      );
    }
  };

  const handleProceedToCheckout = () => {
    if (items.length === 0) return;
    const primaryItem = items[0];
    router.push({
      pathname: '/(customer)/bookings/create',
      params: { 
        serviceId: primaryItem.id,
        checkout: 'true',
        from: 'cart',
      },
    } as any);
  };

  const handleAddMoreServices = () => {
    if (from === 'catalog' && router.canGoBack()) {
      router.back();
    } else {
      router.push('/(customer)/bookings/create' as any);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F8F7FC]" edges={['top']}>
      {/* Top Header */}
      <View className="px-5 py-4 flex-row items-center justify-between bg-white border-b border-border-primary shadow-xs">
        <View className="flex-row items-center flex-1">
          <TouchableOpacity
            onPress={handleBack}
            activeOpacity={0.8}
            className="w-9 h-9 rounded-xl bg-background-secondary border border-border-primary justify-center items-center mr-3 active:bg-slate-100"
          >
            <Ionicons name="arrow-back" size={18} color="#1E1535" />
          </TouchableOpacity>
          <View>
            <Text className="text-text-primary text-lg font-black">{t('bookings.myCart')}</Text>
            {totalCount > 0 && (
              <Text className="text-text-secondary text-[11px] font-semibold">
                {totalCount} {totalCount === 1 ? t('bookings.itemInCart') : t('bookings.itemsInCart')}
              </Text>
            )}
          </View>
        </View>

        {totalCount > 0 && (
          <TouchableOpacity
            onPress={handleClearCart}
            activeOpacity={0.8}
            className="px-3 py-1.5 rounded-lg bg-rose-50 border border-rose-200"
          >
            <Text className="text-rose-600 text-xs font-bold">{t('bookings.clearCart')}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Cart Content */}
      {items.length === 0 ? (
        <View className="flex-1 justify-center items-center px-8">
          <View className="w-24 h-24 rounded-full bg-[#F0EBFB] border border-[#D8CEF6] justify-center items-center mb-5">
            <Ionicons name="cart-outline" size={48} color="#3C01A7" />
          </View>
          <Text className="text-text-primary text-xl font-black mb-2 text-center">
            {t('bookings.emptyCartTitle')}
          </Text>
          <Text className="text-text-secondary text-xs text-center leading-5 mb-8 max-w-[280px]">
            {t('bookings.emptyCartSubtitle')}
          </Text>
          <Button
            label={t('bookings.exploreServices')}
            variant="primary"
            size="md"
            onPress={handleAddMoreServices}
            className="w-full max-w-[260px]"
          />
        </View>
      ) : (
        <ScrollView className="flex-1 px-5 pt-4" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>
          {/* Services in Cart */}
          <View className="mb-4">
            <Text className="text-text-secondary text-xs font-black uppercase tracking-wider mb-3">
              Selected Services ({items.length})
            </Text>

            {items.map((item) => (
              <Card key={item.id} variant="default" className="p-4 mb-3 border border-border-primary">
                <View className="flex-row justify-between items-start">
                  <View className="flex-1 mr-3">
                    {item.category_name && (
                      <View className="self-start px-2 py-0.5 rounded bg-primary/10 border border-primary/20 mb-1">
                        <Text className="text-primary text-[9px] font-black uppercase tracking-wider">
                          {item.category_name}
                        </Text>
                      </View>
                    )}
                    <Text className="text-text-primary text-sm font-extrabold mb-1">
                      {item.name}
                    </Text>
                    {item.description ? (
                      <Text className="text-text-secondary text-[11px] leading-4 mb-2" numberOfLines={2}>
                        {item.description}
                      </Text>
                    ) : null}

                    <View className="flex-row items-center gap-2">
                      {item.estimated_mins && (
                        <View className="flex-row items-center bg-background-secondary px-2 py-0.5 rounded border border-border-primary">
                          <Ionicons name="time-outline" size={11} color="#584F75" />
                          <Text className="text-text-secondary text-[10px] font-bold ml-1">
                            {item.estimated_mins} mins
                          </Text>
                        </View>
                      )}
                      <Text className="text-text-primary text-sm font-black">
                        ₹{item.base_price}
                      </Text>
                    </View>
                  </View>

                  {/* Quantity Stepper & Delete */}
                  <View className="items-end justify-between self-stretch">
                    <TouchableOpacity
                      onPress={() => deleteItem(item.id)}
                      activeOpacity={0.7}
                      className="p-1 mb-2"
                    >
                      <Ionicons name="trash-outline" size={16} color="#DC2626" />
                    </TouchableOpacity>

                    <View className="flex-row items-center bg-[#F0EBFB] border border-[#3C01A7]/30 rounded-xl px-2 py-1">
                      <TouchableOpacity
                        onPress={() => removeItem(item.id)}
                        activeOpacity={0.8}
                        className="w-6 h-6 rounded-lg bg-white justify-center items-center shadow-xs"
                      >
                        <Ionicons name="remove" size={14} color="#3C01A7" />
                      </TouchableOpacity>
                      <Text className="text-[#3C01A7] text-sm font-black px-2.5">{item.quantity}</Text>
                      <TouchableOpacity
                        onPress={() => addItem(item)}
                        activeOpacity={0.8}
                        className="w-6 h-6 rounded-lg bg-[#3C01A7] justify-center items-center shadow-xs"
                      >
                        <Ionicons name="add" size={14} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </Card>
            ))}

            {/* Add more services button */}
            <TouchableOpacity
              onPress={handleAddMoreServices}
              activeOpacity={0.8}
              className="py-3 px-4 rounded-2xl border border-dashed border-[#3C01A7]/40 bg-[#F0EBFB]/50 flex-row items-center justify-center mb-4"
            >
              <Ionicons name="add-circle-outline" size={18} color="#3C01A7" style={{ marginRight: 6 }} />
              <Text className="text-[#3C01A7] text-xs font-black">{t('bookings.addMoreServices')}</Text>
            </TouchableOpacity>
          </View>

          {/* Price Breakdown */}
          <View className="mb-6">
            <Card variant="default" className="p-4 border border-border-primary">
              <Text className="text-text-primary text-xs font-black uppercase tracking-wider mb-3">
                {t('bookings.paymentSummary')}
              </Text>

              <View className="flex-row justify-between mb-2">
                <Text className="text-text-secondary text-xs font-semibold">{t('bookings.itemTotal')}</Text>
                <Text className="text-text-primary text-xs font-black">₹{itemTotal}</Text>
              </View>

              {isPlatformFeeEnabled && platformFee > 0 && (
                <View className="flex-row justify-between mb-2">
                  <Text className="text-text-secondary text-xs font-semibold">{platformFeeLabel}</Text>
                  <Text className="text-text-primary text-xs font-black">₹{platformFee}</Text>
                </View>
              )}

              {isTaxEnabled && taxes > 0 && (
                <View className="flex-row justify-between mb-2">
                  <Text className="text-text-secondary text-xs font-semibold">{taxLabel}</Text>
                  <Text className="text-text-primary text-xs font-black">₹{taxes}</Text>
                </View>
              )}

              <View className="h-[1px] bg-border-primary my-2" />

              <View className="flex-row justify-between items-center">
                <Text className="text-text-primary text-sm font-black">{t('bookings.grandTotal')}</Text>
                <Text className="text-[#3C01A7] text-base font-black">₹{grandTotal}</Text>
              </View>
            </Card>
          </View>

          {/* Proceed to Checkout button */}
          <Button
            label={`${t('bookings.proceedToCheckout')} • ₹${grandTotal}`}
            variant="primary"
            size="lg"
            onPress={handleProceedToCheckout}
            className="w-full shadow-premium mb-6"
          />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
