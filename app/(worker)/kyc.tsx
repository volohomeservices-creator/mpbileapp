import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '@/features/auth/authStore';
import {
  getKycDetails,
  uploadKycDocument,
  saveKycBankDetails,
  KycDocument,
  KycState,
} from '@/api/kyc';

type DocType =
  | 'AADHAAR_FRONT'
  | 'AADHAAR_BACK'
  | 'PAN_CARD'
  | 'SELFIE_VERIFICATION'
  | 'PROFILE_PHOTO'
  | 'EXPERIENCE_CERTIFICATE'
  | 'CERTIFICATE';

const DOC_CONFIGS: Array<{
  type: DocType;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  isCameraPreferred?: boolean;
}> = [
  {
    type: 'AADHAAR_FRONT',
    title: 'Aadhaar Card (Front)',
    description: 'Front side showing your name, photo, and Aadhaar number.',
    icon: 'card-outline',
  },
  {
    type: 'AADHAAR_BACK',
    title: 'Aadhaar Card (Back)',
    description: 'Back side showing your address and QR code.',
    icon: 'card-outline',
  },
  {
    type: 'PAN_CARD',
    title: 'PAN Card',
    description: 'Clear photo of PAN card with visible PAN number & name.',
    icon: 'document-text-outline',
  },
  {
    type: 'SELFIE_VERIFICATION',
    title: 'Live Selfie / Portrait',
    description: 'Take a clear, well-lit photo of your face without sunglasses.',
    icon: 'camera-outline',
    isCameraPreferred: true,
  },
  {
    type: 'EXPERIENCE_CERTIFICATE',
    title: 'Experience / Certificate',
    description: 'Mandatory: Trade diploma, ITI license, or work experience certificate (< 100KB).',
    icon: 'ribbon-outline',
  },
];

export default function WorkerKycScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingType, setUploadingType] = useState<DocType | null>(null);

  // KYC data
  const [kycState, setKycState] = useState<KycState | null>(null);
  const [documents, setDocuments] = useState<KycDocument[]>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string; skills?: string[] }>>([]);
  const [selectedTrade, setSelectedTrade] = useState<string>('');
  const [selectedSubSkills, setSelectedSubSkills] = useState<string[]>([]);

  // Bank & Personal fields
  const [fullName, setFullName] = useState('');
  const [dob, setDob] = useState('');
  const [bankAccountName, setBankAccountName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [confirmAccountNumber, setConfirmAccountNumber] = useState('');
  const [bankIfsc, setBankIfsc] = useState('');

  const loadKyc = async () => {
    try {
      setLoading(true);
      const data = await getKycDetails();
      setDocuments(data.documents || []);
      setKycState(data.kycState);

      // Deduplicate categories and strictly preserve active catalog with admin skills
      const rawCategories = data.categories || [];
      const seenNames = new Set<string>();
      const cleanCategories: Array<{ id: string; name: string; skills: string[] }> = [];
      rawCategories.forEach((c) => {
        const norm = (c.name || '').trim().toLowerCase();
        if (norm && !seenNames.has(norm)) {
          seenNames.add(norm);
          cleanCategories.push({
            id: c.id,
            name: c.name.trim(),
            skills: Array.isArray(c.skills) ? c.skills : []
          });
        }
      });
      setCategories(cleanCategories);

      // Enforce single primary trade and load specialist sub-skills
      const savedSkills: string[] = Array.isArray(data.skills) ? data.skills : [];
      if (savedSkills.length > 0) {
        const matchedCat = cleanCategories.find((c) =>
          savedSkills.some((s) => s.toLowerCase() === c.name.toLowerCase() || c.name.toLowerCase().includes(s.toLowerCase()))
        );
        if (matchedCat) {
          setSelectedTrade(matchedCat.name);
          const subs = savedSkills.filter((s) => s.toLowerCase() !== matchedCat.name.toLowerCase());
          setSelectedSubSkills(subs.length > 0 ? subs : (matchedCat.skills || []));
        } else {
          setSelectedTrade(savedSkills[0]);
          setSelectedSubSkills(savedSkills.slice(1));
        }
      }

      if (data.bankDetails) {
        setFullName(data.bankDetails.full_name || user?.full_name || '');
        setDob(data.bankDetails.dob || '');
        setBankAccountName(data.bankDetails.bank_account_name || '');
        setBankAccountNumber(data.bankDetails.bank_account_number || '');
        setConfirmAccountNumber(data.bankDetails.bank_account_number || '');
        setBankIfsc(data.bankDetails.bank_ifsc || '');
      } else if (user?.full_name) {
        setFullName(user.full_name);
      }
    } catch (err: any) {
      console.error('[KYC Screen] Failed to fetch KYC details:', err);
      Alert.alert('Error', err?.response?.data?.error || 'Failed to load KYC information.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadKyc();
  }, []);

  const getDocStatus = (type: DocType): KycDocument | undefined => {
    return documents.find((d) => d.document_type === type);
  };

  const handleCaptureImage = async (type: DocType) => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (perm.status !== ImagePicker.PermissionStatus.GRANTED) {
        Alert.alert(
          'Camera Permission Required',
          'VOLO needs camera access to capture identity documents for KYC verification.'
        );
        return;
      }

      const isSelfie = type === 'SELFIE_VERIFICATION';
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: isSelfie ? [1, 1] : [4, 3],
        quality: 0.8,
        cameraType: isSelfie ? ImagePicker.CameraType.front : ImagePicker.CameraType.back,
      });

      if (!result.canceled && result.assets && result.assets[0]?.uri) {
        await executeUpload(type, result.assets[0].uri);
      }
    } catch (err: any) {
      Alert.alert('Camera Error', err?.message || 'Could not launch camera.');
    }
  };

  const handlePickFromGallery = async (type: DocType) => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== ImagePicker.PermissionStatus.GRANTED) {
        Alert.alert(
          'Photos Permission Required',
          'VOLO needs photo gallery access to select your KYC documents.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        quality: 0.8,
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
      });

      if (!result.canceled && result.assets && result.assets[0]?.uri) {
        await executeUpload(type, result.assets[0].uri);
      }
    } catch (err: any) {
      Alert.alert('Gallery Error', err?.message || 'Could not pick photo from gallery.');
    }
  };

  const executeUpload = async (type: DocType, uri: string) => {
    if (!user?.id) {
      Alert.alert('Authentication Error', 'Please log in again to upload documents.');
      return;
    }

    setUploadingType(type);
    try {
      const res = await uploadKycDocument(user.id, type, uri);
      if (res.success) {
        Alert.alert('Upload Successful', `${type.replace(/_/g, ' ')} has been uploaded.`);
        await loadKyc();
      } else {
        Alert.alert('Upload Failed', res.message || 'Could not register document.');
      }
    } catch (err: any) {
      const errorMsg =
        err?.response?.data?.error || err?.message || 'Document upload failed. Please try again.';
      Alert.alert('Upload Error', errorMsg);
    } finally {
      setUploadingType(null);
    }
  };

  const selectTrade = (tradeName: string) => {
    setSelectedTrade(tradeName);
    const cat = categories.find((c) => c.name === tradeName);
    setSelectedSubSkills(cat?.skills || []);
  };

  const toggleSubSkill = (skill: string) => {
    setSelectedSubSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );
  };

  const handleSaveAndSubmit = async () => {
    // Basic validation
    if (!fullName.trim()) {
      Alert.alert('Full Name Required', 'Please enter your full legal name as shown on your ID.');
      return;
    }

    if (!dob.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(dob.trim())) {
      Alert.alert(
        'Date of Birth Required',
        'Please enter your date of birth in YYYY-MM-DD format (e.g. 1995-08-24).'
      );
      return;
    }

    if (!bankAccountName.trim()) {
      Alert.alert('Bank Account Name Required', 'Please enter the name on your bank account.');
      return;
    }

    if (!bankAccountNumber.trim()) {
      Alert.alert('Bank Account Number Required', 'Please enter your bank account number.');
      return;
    }

    if (bankAccountNumber.trim() !== confirmAccountNumber.trim()) {
      Alert.alert('Account Number Mismatch', 'Bank account numbers do not match. Please verify.');
      return;
    }

    if (!bankIfsc.trim() || bankIfsc.trim().length < 8) {
      Alert.alert('Valid IFSC Required', 'Please enter a valid 11-character bank IFSC code.');
      return;
    }

    if (!selectedTrade) {
      Alert.alert('Select Service Trade', 'Please select 1 primary service trade you provide.');
      return;
    }

    // Check document counts - all 5 documents are mandatory
    const uploadedTypes = documents.map((d) => d.document_type);
    const requiredDocs: DocType[] = [
      'AADHAAR_FRONT',
      'AADHAAR_BACK',
      'PAN_CARD',
      'SELFIE_VERIFICATION',
      'EXPERIENCE_CERTIFICATE',
    ];
    const missingDocs = requiredDocs.filter((req) => {
      if (req === 'EXPERIENCE_CERTIFICATE') {
        return (
          !uploadedTypes.includes('EXPERIENCE_CERTIFICATE') &&
          !uploadedTypes.includes('CERTIFICATE')
        );
      }
      return !uploadedTypes.includes(req);
    });

    if (missingDocs.length > 0) {
      const docLabels: Record<string, string> = {
        AADHAAR_FRONT: 'Aadhaar Card (Front)',
        AADHAAR_BACK: 'Aadhaar Card (Back)',
        PAN_CARD: 'PAN Card',
        SELFIE_VERIFICATION: 'Live Selfie / Portrait',
        EXPERIENCE_CERTIFICATE: 'Experience / Certificate Document',
      };
      const names = missingDocs
        .map((m) => docLabels[m] || m.replace(/_/g, ' '))
        .join('\n• ');
      Alert.alert(
        'Mandatory Documents Required',
        `Please upload all required identity and certificate documents before submitting:\n\n• ${names}`
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await saveKycBankDetails({
        full_name: fullName.trim(),
        dob: dob.trim(),
        bank_account_name: bankAccountName.trim(),
        bank_account_number: bankAccountNumber.trim(),
        bank_ifsc: bankIfsc.trim().toUpperCase(),
        skills: [selectedTrade, ...selectedSubSkills],
      });

      if (res.success) {
        Alert.alert(
          'KYC Submitted Successfully! 🎉',
          'Your documents and bank details have been submitted for verification. The VOLO team will review and approve your profile within 24 hours.',
          [
            {
              text: 'Go to Home',
              onPress: () => router.replace('/(worker)/home'),
            },
          ]
        );
        await loadKyc();
      } else {
        Alert.alert('Submission Error', res.message || 'Failed to submit KYC details.');
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to save KYC details.';
      Alert.alert('Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const isApproved = kycState?.overall_status === 'APPROVED';
  const isRejected = kycState?.overall_status === 'REJECTED';
  const isPendingReview =
    kycState?.overall_status === 'PENDING' &&
    documents.filter((d) => d.document_type !== 'PROFILE_PHOTO').length >= 5;

  const uploadedDocCount = documents.filter((d) =>
    [
      'AADHAAR_FRONT',
      'AADHAAR_BACK',
      'PAN_CARD',
      'SELFIE_VERIFICATION',
      'EXPERIENCE_CERTIFICATE',
      'CERTIFICATE'
    ].includes(d.document_type)
  ).length;

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center p-6">
        <ActivityIndicator size="large" color="#3C01A7" />
        <Text className="text-slate-500 text-xs font-bold mt-4 uppercase tracking-wider">
          Loading KYC Verification…
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#F8FAFC]">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        {/* Header */}
        <View className="bg-white border-b border-slate-200 px-5 py-3.5 flex-row items-center justify-between shadow-xs">
          <View className="flex-row items-center gap-3">
            <TouchableOpacity
              onPress={() => {
                if (router.canGoBack()) {
                  router.back();
                } else {
                  router.replace('/(worker)/home');
                }
              }}
              activeOpacity={0.7}
              className="w-9 h-9 rounded-xl bg-slate-100 items-center justify-center border border-slate-200"
            >
              <Ionicons name="arrow-back" size={20} color="#1E1535" />
            </TouchableOpacity>
            <View>
              <Text className="text-[#1E1535] text-lg font-black tracking-tight">
                KYC & Verification
              </Text>
              <Text className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                Volo Captain Onboarding
              </Text>
            </View>
          </View>

          {/* Overall Status Badge */}
          <View
            className={`px-3 py-1.5 rounded-full flex-row items-center gap-1.5 ${
              isApproved
                ? 'bg-emerald-50 border border-emerald-200'
                : isRejected
                ? 'bg-rose-50 border border-rose-200'
                : isPendingReview
                ? 'bg-amber-50 border border-amber-200'
                : 'bg-purple-50 border border-purple-200'
            }`}
          >
            <View
              className={`w-2 h-2 rounded-full ${
                isApproved
                  ? 'bg-emerald-500'
                  : isRejected
                  ? 'bg-rose-500'
                  : isPendingReview
                  ? 'bg-amber-500'
                  : 'bg-purple-600'
              }`}
            />
            <Text
              className={`text-[10px] font-black tracking-wider uppercase ${
                isApproved
                  ? 'text-emerald-700'
                  : isRejected
                  ? 'text-rose-700'
                  : isPendingReview
                  ? 'text-amber-700'
                  : 'text-purple-700'
              }`}
            >
              {kycState?.overall_status || 'INCOMPLETE'}
            </Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: Math.max(insets.bottom, 16) + 90 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Status Message Banner */}
          {isApproved ? (
            <View className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-5 flex-row items-start gap-3">
              <View className="w-10 h-10 rounded-xl bg-emerald-100 items-center justify-center shrink-0">
                <Ionicons name="shield-checkmark" size={24} color="#059669" />
              </View>
              <View className="flex-1">
                <Text className="text-emerald-900 font-extrabold text-sm">
                  Profile Verified & Active!
                </Text>
                <Text className="text-emerald-700 text-xs mt-1 leading-relaxed">
                  Your identity documents and bank account have been approved by the VOLO team. You
                  can toggle your status to <Text className="font-bold">Online</Text> on the
                  dashboard to accept jobs.
                </Text>
                <TouchableOpacity
                  onPress={() => router.replace('/(worker)/home')}
                  activeOpacity={0.8}
                  className="mt-3 bg-emerald-600 self-start px-4 py-2 rounded-xl"
                >
                  <Text className="text-white text-xs font-black uppercase tracking-wider">
                    Go to Dashboard &gt;
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : isRejected ? (
            <View className="bg-rose-50 border border-rose-200 rounded-2xl p-4 mb-5 flex-row items-start gap-3">
              <View className="w-10 h-10 rounded-xl bg-rose-100 items-center justify-center shrink-0">
                <Ionicons name="alert-circle" size={24} color="#E11D48" />
              </View>
              <View className="flex-1">
                <Text className="text-rose-900 font-extrabold text-sm">
                  KYC Verification Rejected
                </Text>
                <Text className="text-rose-700 text-xs mt-1 leading-relaxed">
                  Reason: {kycState?.remarks || 'Documents were blurry or invalid.'}
                </Text>
                <Text className="text-rose-800 text-[11px] font-semibold mt-1">
                  Please re-upload clear photos of the rejected documents below and resubmit.
                </Text>
              </View>
            </View>
          ) : isPendingReview ? (
            <View className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-5 flex-row items-start gap-3">
              <View className="w-10 h-10 rounded-xl bg-amber-100 items-center justify-center shrink-0">
                <Ionicons name="time" size={24} color="#D97706" />
              </View>
              <View className="flex-1">
                <Text className="text-amber-900 font-extrabold text-sm">
                  Verification in Progress
                </Text>
                <Text className="text-amber-800 text-xs mt-1 leading-relaxed">
                  All documents have been submitted and are under review by our operations team.
                  Verification is typically completed within 24 hours.
                </Text>
              </View>
            </View>
          ) : (
            <View className="bg-purple-50 border border-purple-200 rounded-2xl p-4 mb-5 flex-row items-start gap-3">
              <View className="w-10 h-10 rounded-xl bg-purple-100 items-center justify-center shrink-0">
                <Ionicons name="information-circle" size={24} color="#7C3AED" />
              </View>
              <View className="flex-1">
                <Text className="text-purple-900 font-extrabold text-sm">
                  Action Required: Complete KYC
                </Text>
                <Text className="text-purple-800 text-xs mt-1 leading-relaxed">
                  To start receiving customer bookings and payouts, you must upload your Aadhaar,
                  PAN card, live selfie, and bank details.
                </Text>
                <View className="mt-2.5 bg-purple-200/60 rounded-full h-2 w-full overflow-hidden">
                  <View
                    className="bg-purple-600 h-full rounded-full"
                    style={{ width: `${Math.min(100, (uploadedDocCount / DOC_CONFIGS.length) * 100)}%` }}
                  />
                </View>
                <Text className="text-purple-900 text-[10px] font-bold mt-1 text-right">
                  {uploadedDocCount}/{DOC_CONFIGS.length} Documents Uploaded
                </Text>
              </View>
            </View>
          )}

          {/* ================= SECTION 1: DOCUMENTS ================= */}
          <View className="mb-6">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-slate-800 text-sm font-black uppercase tracking-wider">
                1. Required Documents
              </Text>
              <Text className="text-slate-500 text-xs font-bold">
                {uploadedDocCount} of {DOC_CONFIGS.length} ready
              </Text>
            </View>

            <View className="gap-3">
              {DOC_CONFIGS.map((docConfig) => {
                const doc = getDocStatus(docConfig.type);
                const isUploading = uploadingType === docConfig.type;
                const isDocApproved = doc?.status === 'APPROVED';

                return (
                  <View
                    key={docConfig.type}
                    className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs"
                  >
                    <View className="flex-row items-start justify-between">
                      <View className="flex-row items-start gap-3 flex-1 pr-2">
                        <View className="w-10 h-10 rounded-xl bg-slate-100 items-center justify-center border border-slate-200 shrink-0">
                          <Ionicons name={docConfig.icon} size={20} color="#3C01A7" />
                        </View>
                        <View className="flex-1">
                          <View className="flex-row items-center gap-1.5 flex-wrap">
                            <Text className="text-slate-900 font-extrabold text-sm">
                              {docConfig.title}
                            </Text>
                            <View className="bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded">
                              <Text className="text-rose-600 text-[9px] font-black uppercase">
                                Mandatory *
                              </Text>
                            </View>
                          </View>
                          <Text className="text-slate-500 text-xs mt-0.5 leading-snug">
                            {docConfig.description}
                          </Text>
                        </View>
                      </View>

                      {/* Status indicator */}
                      <View
                        className={`px-2.5 py-1 rounded-full flex-row items-center gap-1 ${
                          doc?.status === 'APPROVED'
                            ? 'bg-emerald-50 border border-emerald-200'
                            : doc?.status === 'REJECTED'
                            ? 'bg-rose-50 border border-rose-200'
                            : doc
                            ? 'bg-amber-50 border border-amber-200'
                            : 'bg-slate-100 border border-slate-200'
                        }`}
                      >
                        <Ionicons
                          name={
                            doc?.status === 'APPROVED'
                              ? 'checkmark-circle'
                              : doc?.status === 'REJECTED'
                              ? 'close-circle'
                              : doc
                              ? 'time'
                              : 'cloud-upload-outline'
                          }
                          size={12}
                          color={
                            doc?.status === 'APPROVED'
                              ? '#059669'
                              : doc?.status === 'REJECTED'
                              ? '#E11D48'
                              : doc
                              ? '#D97706'
                              : '#64748B'
                          }
                        />
                        <Text
                          className={`text-[9px] font-black uppercase tracking-wider ${
                            doc?.status === 'APPROVED'
                              ? 'text-emerald-700'
                              : doc?.status === 'REJECTED'
                              ? 'text-rose-700'
                              : doc
                              ? 'text-amber-700'
                              : 'text-slate-600'
                          }`}
                        >
                          {doc?.status || 'NOT UPLOADED'}
                        </Text>
                      </View>
                    </View>

                    {/* Thumbnail preview if available */}
                    {doc?.signedUrl && (
                      <View className="mt-3 pt-3 border-t border-slate-100 flex-row items-center gap-3">
                        <Image
                          source={{ uri: doc.signedUrl }}
                          className="w-16 h-12 rounded-lg bg-slate-100 border border-slate-200"
                          resizeMode="cover"
                        />
                        <View className="flex-1">
                          <Text className="text-slate-800 text-xs font-bold">
                            File Uploaded
                          </Text>
                          <Text className="text-slate-400 text-[10px]">
                            {doc.uploaded_at
                              ? new Date(doc.uploaded_at).toLocaleDateString()
                              : 'Uploaded'}
                          </Text>
                        </View>
                      </View>
                    )}

                    {/* Upload Buttons */}
                    {!isDocApproved && (
                      <View className="mt-3.5 pt-3 border-t border-slate-100">
                        {docConfig.type === 'SELFIE_VERIFICATION' ? (
                          <TouchableOpacity
                            onPress={() => handleCaptureImage(docConfig.type)}
                            disabled={isUploading}
                            activeOpacity={0.8}
                            className="w-full bg-[#3C01A7] py-3 rounded-xl flex-row items-center justify-center gap-2 shadow-2xs"
                          >
                            {isUploading ? (
                              <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                              <>
                                <Ionicons name="camera" size={17} color="#FFFFFF" />
                                <Text className="text-white text-xs font-black uppercase tracking-wider">
                                  {doc ? 'Retake Live Selfie (Front Camera)' : 'Open Camera & Take Live Selfie'}
                                </Text>
                              </>
                            )}
                          </TouchableOpacity>
                        ) : (
                          <View className="flex-row items-center gap-2">
                            <TouchableOpacity
                              onPress={() => handleCaptureImage(docConfig.type)}
                              disabled={isUploading}
                              activeOpacity={0.8}
                              className="flex-1 bg-[#3C01A7] py-2.5 rounded-xl flex-row items-center justify-center gap-1.5 shadow-2xs"
                            >
                              {isUploading ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                              ) : (
                                <>
                                  <Ionicons name="camera" size={15} color="#FFFFFF" />
                                  <Text className="text-white text-xs font-black uppercase tracking-wider">
                                    Camera
                                  </Text>
                                </>
                              )}
                            </TouchableOpacity>

                            <TouchableOpacity
                              onPress={() => handlePickFromGallery(docConfig.type)}
                              disabled={isUploading}
                              activeOpacity={0.8}
                              className="flex-1 bg-slate-100 border border-slate-200 py-2.5 rounded-xl flex-row items-center justify-center gap-1.5"
                            >
                              <Ionicons name="images" size={15} color="#334155" />
                              <Text className="text-slate-700 text-xs font-bold uppercase tracking-wider">
                                Gallery
                              </Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </View>

          {/* ================= SECTION 2: PERSONAL DETAILS ================= */}
          <View className="bg-white rounded-2xl border border-slate-200 p-4 mb-6 shadow-2xs">
            <Text className="text-slate-800 text-sm font-black uppercase tracking-wider mb-4">
              2. Personal Details
            </Text>

            <View className="gap-3.5">
              <View>
                <Text className="text-slate-600 text-xs font-bold mb-1.5 uppercase tracking-wider">
                  Full Name (As on ID) *
                </Text>
                <TextInput
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="e.g. Ramesh Kumar"
                  placeholderTextColor="#94A3B8"
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 text-sm font-semibold focus:border-[#3C01A7] focus:bg-white"
                />
              </View>

              <View>
                <Text className="text-slate-600 text-xs font-bold mb-1.5 uppercase tracking-wider">
                  Date of Birth (YYYY-MM-DD) *
                </Text>
                <TextInput
                  value={dob}
                  onChangeText={setDob}
                  placeholder="e.g. 1995-08-24"
                  placeholderTextColor="#94A3B8"
                  maxLength={10}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 text-sm font-semibold focus:border-[#3C01A7] focus:bg-white"
                />
              </View>
            </View>
          </View>

          {/* ================= SECTION 3: BANK DETAILS ================= */}
          <View className="bg-white rounded-2xl border border-slate-200 p-4 mb-6 shadow-2xs">
            <Text className="text-slate-800 text-sm font-black uppercase tracking-wider mb-1">
              3. Bank Account for Settlements
            </Text>
            <Text className="text-slate-400 text-xs mb-4">
              Direct bank transfers are credited every Monday for completed jobs.
            </Text>

            <View className="gap-3.5">
              <View>
                <Text className="text-slate-600 text-xs font-bold mb-1.5 uppercase tracking-wider">
                  Account Holder Name *
                </Text>
                <TextInput
                  value={bankAccountName}
                  onChangeText={setBankAccountName}
                  placeholder="e.g. Ramesh Kumar"
                  placeholderTextColor="#94A3B8"
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 text-sm font-semibold focus:border-[#3C01A7] focus:bg-white"
                />
              </View>

              <View>
                <Text className="text-slate-600 text-xs font-bold mb-1.5 uppercase tracking-wider">
                  Bank Account Number *
                </Text>
                <TextInput
                  value={bankAccountNumber}
                  onChangeText={setBankAccountNumber}
                  placeholder="Enter account number"
                  placeholderTextColor="#94A3B8"
                  keyboardType="number-pad"
                  secureTextEntry={false}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 text-sm font-semibold focus:border-[#3C01A7] focus:bg-white"
                />
              </View>

              <View>
                <Text className="text-slate-600 text-xs font-bold mb-1.5 uppercase tracking-wider">
                  Confirm Account Number *
                </Text>
                <TextInput
                  value={confirmAccountNumber}
                  onChangeText={setConfirmAccountNumber}
                  placeholder="Re-enter account number"
                  placeholderTextColor="#94A3B8"
                  keyboardType="number-pad"
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 text-sm font-semibold focus:border-[#3C01A7] focus:bg-white"
                />
              </View>

              <View>
                <Text className="text-slate-600 text-xs font-bold mb-1.5 uppercase tracking-wider">
                  Bank IFSC Code *
                </Text>
                <TextInput
                  value={bankIfsc}
                  onChangeText={(val) => setBankIfsc(val.toUpperCase())}
                  placeholder="e.g. SBIN0001234"
                  placeholderTextColor="#94A3B8"
                  maxLength={11}
                  autoCapitalize="characters"
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 text-sm font-semibold font-mono focus:border-[#3C01A7] focus:bg-white"
                />
              </View>
            </View>
          </View>

          {/* ================= SECTION 4: SERVICE TRADES ================= */}
          <View className="bg-white rounded-2xl border border-slate-200 p-4 mb-6 shadow-2xs">
            <View className="flex-row items-center justify-between mb-1">
              <Text className="text-slate-800 text-sm font-black uppercase tracking-wider">
                4. Service Trade & Skills
              </Text>
              <View className="bg-[#3C01A7]/10 px-2.5 py-0.5 rounded-full border border-[#3C01A7]/20">
                <Text className="text-[10px] font-black text-[#3C01A7] uppercase tracking-wider">
                  Choose 1 Only
                </Text>
              </View>
            </View>
            <Text className="text-slate-400 text-xs mb-3.5">
              Select your primary service trade. Captains can only be registered for 1 category.
            </Text>

            <View className="flex-row flex-wrap gap-2">
              {categories.length > 0 ? (
                categories.map((cat) => {
                  const isSelected = selectedTrade === cat.name;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      onPress={() => selectTrade(cat.name)}
                      activeOpacity={0.8}
                      className={`px-3.5 py-2.5 rounded-xl border flex-row items-center gap-2 ${
                        isSelected
                          ? 'bg-[#3C01A7] border-[#3C01A7] shadow-xs'
                          : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <Ionicons
                        name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                        size={16}
                        color={isSelected ? '#FFFFFF' : '#64748B'}
                      />
                      <Text
                        className={`text-xs font-bold ${
                          isSelected ? 'text-white' : 'text-slate-700'
                        }`}
                      >
                        {cat.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })
              ) : (
                <Text className="text-slate-400 text-xs">No service categories loaded.</Text>
              )}
            </View>

            {/* Quick list of 4–5 specific skill checkboxes under the selected main category */}
            {(() => {
              const activeCategory = categories.find((c) => c.name === selectedTrade);
              if (!activeCategory) return null;

              return (
                <View className="mt-4 bg-purple-50/70 border border-purple-200 rounded-2xl p-4">
                  <View className="flex-row items-center justify-between mb-2">
                    <View className="flex-row items-center gap-2">
                      <Ionicons name="build" size={16} color="#3C01A7" />
                      <Text className="text-xs font-black text-slate-900">
                        Specific Skills in {activeCategory.name}
                      </Text>
                    </View>
                    <View className="bg-white px-2 py-0.5 rounded-full border border-purple-200">
                      <Text className="text-[10px] font-black text-[#3C01A7]">
                        {selectedSubSkills.length} of {activeCategory.skills?.length || 0}
                      </Text>
                    </View>
                  </View>
                  <Text className="text-slate-500 text-[11px] mb-3">
                    Check the specific tasks you handle (managed via Admin Dashboard):
                  </Text>

                  {activeCategory.skills && activeCategory.skills.length > 0 ? (
                    <View className="gap-2">
                      {activeCategory.skills.map((skill) => {
                        const isSkillChecked = selectedSubSkills.includes(skill);
                        return (
                          <TouchableOpacity
                            key={skill}
                            onPress={() => toggleSubSkill(skill)}
                            activeOpacity={0.7}
                            className={`p-3 rounded-xl border flex-row items-center justify-between ${
                              isSkillChecked
                                ? 'bg-[#3C01A7] border-[#3C01A7]'
                                : 'bg-white border-slate-200'
                            }`}
                          >
                            <View className="flex-row items-center gap-2.5 flex-1 pr-2">
                              <Ionicons
                                name={isSkillChecked ? 'checkbox' : 'square-outline'}
                                size={18}
                                color={isSkillChecked ? '#FFFFFF' : '#94A3B8'}
                              />
                              <Text
                                className={`text-xs font-bold ${
                                  isSkillChecked ? 'text-white' : 'text-slate-800'
                                }`}
                              >
                                {skill}
                              </Text>
                            </View>
                            {isSkillChecked && (
                              <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ) : (
                    <View className="bg-white p-3 rounded-xl border border-dashed border-slate-200">
                      <Text className="text-xs text-slate-500 text-center">
                        All standard services in this trade are assigned automatically.
                      </Text>
                    </View>
                  )}
                </View>
              );
            })()}
          </View>
        </ScrollView>

        {/* Sticky Submit Footer */}
        <View
          style={{ paddingBottom: Math.max(insets.bottom, 16) }}
          className="bg-white border-t border-slate-200 px-4 pt-3.5 shadow-2xl absolute bottom-0 left-0 right-0 z-50"
        >
          <TouchableOpacity
            onPress={handleSaveAndSubmit}
            disabled={submitting}
            activeOpacity={0.85}
            className="w-full bg-[#3C01A7] py-3.5 rounded-2xl flex-row items-center justify-center gap-2 shadow-md"
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Ionicons name="shield-checkmark" size={18} color="#FFFFFF" />
                <Text className="text-white text-sm font-black uppercase tracking-wider">
                  {isApproved ? 'Update Profile & Bank Info' : 'Submit KYC for Verification'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
