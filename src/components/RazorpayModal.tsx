import React, { useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  StyleSheet,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';

export interface RazorpayPaymentData {
  keyId: string;
  orderId: string;
  amount: number | string;
  currency?: string;
  name?: string;
  description?: string;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  themeColor?: string;
}

export interface RazorpaySuccessResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayModalProps {
  visible: boolean;
  checkout: RazorpayPaymentData | null;
  onSuccess: (data: RazorpaySuccessResponse) => void;
  onDismiss: () => void;
  onError: (errorMessage: string) => void;
}

export const RazorpayModal: React.FC<RazorpayModalProps> = ({
  visible,
  checkout,
  onSuccess,
  onDismiss,
  onError,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const webViewRef = useRef<WebView>(null);

  if (!visible || !checkout) {
    return null;
  }

  const handleClose = () => {
    Alert.alert(
      'Cancel Payment?',
      'Are you sure you want to exit? Your payment will not be completed.',
      [
        { text: 'Continue Payment', style: 'cancel' },
        {
          text: 'Cancel Payment',
          style: 'destructive',
          onPress: onDismiss,
        },
      ]
    );
  };

  const formattedAmount = (() => {
    const amt = Number(checkout.amount);
    if (isNaN(amt)) return '0.00';
    // If amount is in paise (e.g. > 100 and typically integers), format to rupees
    // Razorpay standard amount is in paise
    const inRupees = amt > 1000 ? (amt / 100).toFixed(2) : (amt / 100).toFixed(2);
    return inRupees;
  })();

  const razorpayOptions = {
    key: checkout.keyId,
    amount: checkout.amount,
    currency: checkout.currency || 'INR',
    name: checkout.name || 'VOLO Home Services',
    description: checkout.description || 'Payment Checkout',
    order_id: checkout.orderId,
    prefill: checkout.prefill || {},
    theme: {
      color: checkout.themeColor || '#7C3AED',
    },
  };

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>VOLO Checkout</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #0B0A10;
      color: #FFFFFF;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px;
      text-align: center;
      -webkit-font-smoothing: antialiased;
    }
    .spinner {
      width: 48px;
      height: 48px;
      border: 4px solid rgba(255, 255, 255, 0.1);
      border-top-color: #7C3AED;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin-bottom: 20px;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    h2 { font-size: 19px; font-weight: 700; margin-bottom: 8px; color: #FFFFFF; }
    p { font-size: 14px; color: #94A3B8; max-width: 280px; line-height: 1.4; }
    .error-box {
      display: none;
      background: #1E1B2E;
      border: 1px solid #E11D48;
      border-radius: 16px;
      padding: 20px;
      margin-top: 16px;
      max-width: 320px;
    }
    .btn-retry {
      margin-top: 16px;
      background: #7C3AED;
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 12px;
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
    }
  </style>
  <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
</head>
<body>
  <div id="loading-state">
    <div class="spinner"></div>
    <h2>Opening Razorpay...</h2>
    <p>Connecting securely to payment gateway</p>
  </div>

  <div id="error-box" class="error-box">
    <h3 style="color:#F43F5E; margin-bottom:8px;">Payment Gateway Error</h3>
    <p id="error-desc" style="font-size:13px;"></p>
    <button class="btn-retry" onclick="initRazorpay()">Try Again</button>
  </div>

  <script>
    function postToApp(type, payload) {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: type, payload: payload }));
      }
    }

    var rzpConfig = ${JSON.stringify(razorpayOptions)};
    rzpConfig.handler = function(response) {
      document.getElementById('loading-state').style.display = 'block';
      document.querySelector('#loading-state h2').innerText = 'Verifying Payment...';
      document.querySelector('#loading-state p').innerText = 'Please do not close this window.';
      postToApp('PAYMENT_SUCCESS', response);
    };

    rzpConfig.modal = {
      ondismiss: function() {
        postToApp('PAYMENT_DISMISSED', {});
      }
    };

    function initRazorpay() {
      document.getElementById('error-box').style.display = 'none';
      document.getElementById('loading-state').style.display = 'block';

      try {
        if (typeof Razorpay !== 'undefined') {
          var instance = new Razorpay(rzpConfig);
          instance.on('payment.failed', function(resp) {
            postToApp('PAYMENT_FAILED', resp && resp.error ? resp.error.description : 'Payment failed.');
          });
          instance.open();
        } else {
          setTimeout(initRazorpay, 300);
        }
      } catch (err) {
        document.getElementById('loading-state').style.display = 'none';
        document.getElementById('error-box').style.display = 'block';
        document.getElementById('error-desc').innerText = err.message || 'Could not launch payment modal.';
        postToApp('GATEWAY_ERROR', err.message || 'Payment launch failed');
      }
    }

    window.onload = function() {
      initRazorpay();
    };
  </script>
</body>
</html>`;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0B0A10" />

        {/* In-App Header */}
        <View style={styles.header}>
          <View style={styles.headerTitleContainer}>
            <View style={styles.shieldBadge}>
              <Ionicons name="shield-checkmark" size={16} color="#10B981" />
            </View>
            <View>
              <Text style={styles.headerTitle}>VOLO Secure Payment</Text>
              <Text style={styles.headerSubtitle}>₹{formattedAmount} • Razorpay Gateway</Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={handleClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={styles.closeButton}
            accessibilityLabel="Close payment"
          >
            <Ionicons name="close" size={22} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        {/* Loading overlay for WebView */}
        {isLoading && (
          <View style={styles.webviewLoader}>
            <ActivityIndicator size="large" color="#7C3AED" />
            <Text style={styles.webviewLoaderText}>Securing Connection...</Text>
          </View>
        )}

        {/* In-App WebView (Never leaves the mobile app!) */}
        <WebView
          ref={webViewRef}
          originWhitelist={['*']}
          source={{
            html: htmlContent,
            baseUrl: 'https://api.razorpay.com',
          }}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          mixedContentMode="always"
          allowsInlineMediaPlayback={true}
          setSupportMultipleWindows={false}
          userAgent="Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
          onLoadEnd={() => setIsLoading(false)}
          onMessage={(event) => {
            try {
              const data = JSON.parse(event.nativeEvent.data);
              switch (data.type) {
                case 'PAYMENT_SUCCESS':
                  onSuccess(data.payload);
                  break;
                case 'PAYMENT_DISMISSED':
                  onDismiss();
                  break;
                case 'PAYMENT_FAILED':
                  onError(typeof data.payload === 'string' ? data.payload : 'Payment transaction failed.');
                  break;
                case 'GATEWAY_ERROR':
                  onError(data.payload || 'Failed to open Razorpay gateway.');
                  break;
              }
            } catch {
              // Message parsing error
            }
          }}
          onShouldStartLoadWithRequest={(request) => {
            const url = request.url;
            if (!url) return true;

            // Allow standard web URLs inside WebView
            if (
              url.startsWith('http://') ||
              url.startsWith('https://') ||
              url.startsWith('about:blank') ||
              url.startsWith('data:')
            ) {
              return true;
            }

            // Intercept UPI deep links (PhonePe, Google Pay, Paytm, BHIM, CRED)
            if (
              url.startsWith('upi://') ||
              url.startsWith('intent://') ||
              url.startsWith('phonepe://') ||
              url.startsWith('paytmmp://') ||
              url.startsWith('tez://')
            ) {
              Linking.canOpenURL(url)
                .then((canOpen) => {
                  if (canOpen) {
                    Linking.openURL(url);
                  } else if (url.startsWith('intent://')) {
                    Linking.openURL(url).catch(() => {});
                  }
                })
                .catch(() => {
                  Linking.openURL(url).catch(() => {});
                });
              return false;
            }

            return true;
          }}
          style={styles.webview}
        />
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0A10',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#13111C',
    borderBottomWidth: 1,
    borderBottomColor: '#231F33',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  shieldBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 1,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1E1B2E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  webview: {
    flex: 1,
    backgroundColor: '#0B0A10',
  },
  webviewLoader: {
    position: 'absolute',
    top: 70,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0B0A10',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  webviewLoaderText: {
    color: '#94A3B8',
    marginTop: 12,
    fontSize: 14,
    fontWeight: '500',
  },
});
