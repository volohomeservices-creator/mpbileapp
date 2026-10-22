# 📱 Production Blueprint: React Native + Firebase Phone Auth + Google Play Console

This guide documents the root cause post-mortem of the Google Play submission journey for VOLO, explains why multiple submissions were required, and provides a **reusable configuration checklist** for all future mobile projects.

---

## 🧭 Executive Summary: Why Were Multiple Submissions Required?

Setting up Phone Authentication with `@react-native-firebase` on modern Android involves **5 independent systems** interacting with strict cryptographic and security boundaries:

```
[ Android Device (Play Store) ] 
       │ (1. Signed by Google Play App Signing Key)
       ▼
[ Google Play Integrity API ] ──► (2. Verdict: MEETS_DEVICE_INTEGRITY)
       │
       ▼
[ Google Cloud API Gateway ]  ──► (3. API Key & OAuth 2.0 Client ID Check)
       │
       ▼
[ Firebase Auth Backend ]     ──► (4. SHA-1/SHA-256 Match & SMS Region Policy)
       │
       ▼
[ Telecom / SMS Delivery ]    ──► (5. Real SMS OTP to Indian Mobile Number)
```

If **any single link** in this 5-link chain fails, the entire authentication process throws an error. During our debugging, we resolved each link sequentially:

---

## 🔍 Root Cause Post-Mortem (The 6 Cascading Issues)

### 1. React Native 0.86 New Architecture (TurboModules) vs Firebase SDK
* **The Symptom:** App instantly crashed on startup with `TypeError: Cannot convert undefined value to object` and `undefined is not a function (evaluating 'this.native.addAuthStateListener')`.
* **Why it happened:** React Native 0.86 enables the **New Architecture (TurboModules)** by default (`newArchEnabled=true`). Older libraries like `@react-native-firebase` (v18.x) expect the Old Architecture Bridge where native module methods and constants are enumerable via `Object.keys()`. In TurboModules, methods exist on the C++/JSI prototype and are not enumerable by `Object.keys()`.
* **The Solution:** 
  1. Patched `nativeModule.js` in `@react-native-firebase/app` using a dynamic **JavaScript Proxy fallback** that intercepts and wraps native methods on demand.
  2. Patched `@react-native-firebase/auth` constructor with defensive guards around listeners.
  3. Bypassed JS bridge wrappers on Android by calling `NativeModules.RNFBAuthModule.signInWithPhoneNumber` directly.

---

### 2. Monorepo vs Standalone CI/CD Build Isolation
* **The Symptom:** Metro bundler failed during eager export with `Error: Unable to resolve module @volo/shared-types`.
* **Why it happened:** In the monorepo, `@volo/shared-types` was located at `../../packages/shared-types`. When pushing only `mobile/volo-mobile` to the standalone GitHub repository (`mpbileapp`), `../../packages/shared-types` was outside the Git tree.
* **The Solution:** Bundled `packages/shared-types` directly into the mobile project, updated `package.json` to `"file:./packages/shared-types"`, and added multi-path resolution in `metro.config.js` and `tsconfig.json`.

---

### 3. Dual-Key Signing Architecture (Upload Key vs Google Play App Signing Key)
* **The Symptom:** `App verification failed (Play Integrity/SHA fingerprint not recognized)`.
* **Why it happened:** When you build an AAB with EAS or local keystore, it is signed with the **Upload Key**. But when an app is uploaded to Google Play Console, **Google Play strips the upload signature and re-signs the app with its own Google Play App Signing Key** before delivering it to users.
* **The Solution:**
  * Added the Upload Key fingerprints (both SHA-1 `6A:B3:...` and SHA-256 `C4:57:...`).
  * Added the active Google Play App Signing Key fingerprints (SHA-1 `38:A1:...` and SHA-256 `55:56:...`).

---

### 4. Google Cloud API Key "Android Apps" Restriction Conflict
* **The Symptom:** Native error `403 PERMISSION_DENIED: API_KEY_ANDROID_APP_BLOCKED` and `auth/app-not-authorized`.
* **Why it happened:** The Google Cloud API key (`AIzaSy...`) had "Application restrictions" set to "Android apps". As stated in official Google documentation:
  > *"Do not add Android app restrictions to the API key used by Firebase Authentication. Doing so will block requests from the Firebase Auth SDK and result in auth/app-not-authorized."*
* **The Solution:** Changed **Application restrictions** to **"None"** and **API restrictions** to **"Don't restrict key"** in Google Cloud Console.

---

### 5. Ghost "Pending Delete Apps" Holding Conflicting OAuth 2.0 Credentials
* **The Symptom:** Persistent `auth/app-not-authorized` despite correct SHA keys.
* **Why it happened:** An earlier instance of `com.volohome.app` had been deleted in Firebase Console, placing it in **"Pending delete apps"** (Google holds deleted apps for 30 days). Google OAuth enforces that a `Package Name + SHA-1` pair can only be active in one client. The pending app held the OAuth bindings, blocking the new active app.
* **The Solution:** Permanently deleted the ghost app from Firebase Console, freeing up the OAuth bindings.

---

### 6. Firebase SMS Anti-Fraud Region Policy & Rate Limiting
* **The Symptom:** Single phone numbers blocked with `TOO_MANY_REQUESTS`.
* **Why it happened:** Firebase restricts SMS delivery to regions outside the US unless explicitly allowed in SMS Region Policy, and limits rapid OTP requests per phone number.
* **The Solution:**
  * Explicitly allowed **India (+91)** in Firebase SMS Region Policy.
  * Configured developer/tester phone numbers under **"Phone numbers for testing"** for unlimited instant verification without carrier delay.

---

## 🛠️ The Ultimate Checklist for Future Projects

Follow this checklist whenever launching a new React Native app with Firebase Phone Auth on Google Play Store:

### Phase 1: Firebase Console Setup
1. **Create Android App:** Enter exact package name (e.g. `com.company.app`).
2. **Download `google-services.json`:** Place in `android/app/` or mobile project root.
3. **Authentication Settings:**
   * Enable **Phone** provider.
   * Under **Settings** → **SMS region policy**, set to **Allow** and add **India (+91)** (and other target countries).
   * Add developer phone numbers under **Phone numbers for testing** (e.g. `+91XXXXXXXXXX` -> `123456`).
4. **App Check:** Keep Authentication set to **Monitoring** (do not enforce during initial rollout).

### Phase 2: Google Cloud Console Setup
1. Open **APIs & Services** → **Credentials**.
2. For the auto-created Firebase API keys (`Android key`, `Browser key`):
   * Set **Application restrictions** = **None**.
   * Set **API restrictions** = **Don't restrict key**.
3. Under **Library**, enable:
   * **Play Integrity API**
   * **Android Device Verification API**
   * **Identity Toolkit API**

### Phase 3: Google Play Console Setup
1. Under **Release** → **Setup** → **App integrity**:
   * Verify **Play Integrity API** is linked to your Firebase Google Cloud Project Number.
2. Under **App signing**:
   * Copy the **SHA-1** and **SHA-256** from **App signing key (In use)**.
   * Copy the **SHA-1** and **SHA-256** from **Upload key**.
   * Copy any **Previous app signing keys** if keys were rotated.
3. Paste **ALL** of these SHA-1 and SHA-256 fingerprints into **Firebase Console** → **Project Settings** → **SHA certificate fingerprints**.

### Phase 4: CI/CD Build Setup (GitHub Actions)
1. Add `EXPO_TOKEN` to repository secrets:
   * GitHub Repo → **Settings** → **Secrets and variables** → **Actions** → `EXPO_TOKEN`.
2. Ensure the standalone repo contains all local package dependencies (no symlinks or parent folder dependencies like `../../packages`).
3. Use GitHub Actions for free local `.aab` compilation on `ubuntu-latest`.

---

## 📜 Verification Architecture Table

| Component | Responsibility | Expected Setting |
| :--- | :--- | :--- |
| **Package Name** | Identifies Android App | `com.volohome.app` across `app.json`, `google-services.json`, Firebase, Play Console |
| **Upload Keystore** | Signs local/CI builds | SHA-1 & SHA-256 registered in Firebase Console |
| **Play Signing Key** | Signs Play Store distribution | SHA-1 & SHA-256 registered in Firebase Console |
| **Google Cloud API Key** | Firebase backend communication | Application restrictions: **None** |
| **Play Integrity API** | Attests device and app authenticity | **Enabled** in Google Cloud & **Linked** in Play Console |
| **SMS Region Policy** | Permitted SMS destination countries | **India (+91)** explicitly Allowed |
| **Test Phone Numbers** | Bypasses Play Integrity & SMS limits | Configured for QA/testing |

---
*Created for VOLO Mobile App Deployment — October 2026*
