/**
 * Comprehensive compatibility patch for @react-native-firebase under React Native New Architecture (TurboModules).
 * 
 * Fixes Hermes engine crashes by:
 * 1. Safely exposing getConstants() AND using a Proxy fallback in nativeModule.js
 *    so that TurboModule methods not visible to Object.keys() are still accessible.
 * 2. Defensively guarding APP_LANGUAGE and APP_USER in auth/lib/index.js constructor.
 * 3. Preserving bulletproof NativeFirebaseError.js against unmasked rejection payloads.
 * 
 * Designed to be deterministic, idempotent, and to fail clearly if source files differ from expected versions.
 */

const fs = require('fs');
const path = require('path');

let patchCount = 0;
let skipCount = 0;

// ─── 1. Patch @react-native-firebase/app/lib/internal/registry/nativeModule.js ───
// This is the CRITICAL patch: under RN 0.86 New Arch + TurboModule interop,
// Object.keys(NativeModule) does NOT enumerate native methods (addAuthStateListener,
// signInWithPhoneNumber, etc.). We fix this by:
//   a) Extracting getConstants() and merging them onto the wrapper object.
//   b) Returning a Proxy that falls back to the original NativeModule for any
//      property not found on the wrapper — dynamically wrapping methods on access.
const nativeModulePath = path.resolve(
  __dirname,
  '../node_modules/@react-native-firebase/app/lib/internal/registry/nativeModule.js'
);

if (!fs.existsSync(nativeModulePath)) {
  console.log('[patch-firebase] registry/nativeModule.js not found, skipping.');
} else {
  const content = fs.readFileSync(nativeModulePath, 'utf8');
  const proxyPatchMarker = '// [RNFB-PATCH] Proxy fallback for TurboModule interop';

  if (content.includes(proxyPatchMarker)) {
    console.log('[patch-firebase] registry/nativeModule.js is already fully patched (Proxy).');
    skipCount++;
  } else {
    // We need to replace the entire nativeModuleWrapped function body.
    // Match the function from its declaration to the closing brace + the next function/comment.
    const funcStart = 'function nativeModuleWrapped(namespace, NativeModule, argToPrepend) {';
    const funcEndMarker = '\n}\n';

    const startIndex = content.indexOf(funcStart);
    if (startIndex === -1) {
      throw new Error(
        `[patch-firebase] CRITICAL: Cannot find nativeModuleWrapped function in ${nativeModulePath}.`
      );
    }

    // Find the closing brace of the function.
    // We know the function body structure: after the opening '{', find the matching '}'
    // by looking for the pattern "\n}\n" that ends the function.
    const bodyStart = startIndex + funcStart.length;
    let braceDepth = 1;
    let funcEndIndex = -1;
    for (let i = bodyStart; i < content.length; i++) {
      if (content[i] === '{') braceDepth++;
      if (content[i] === '}') {
        braceDepth--;
        if (braceDepth === 0) {
          funcEndIndex = i + 1; // include the closing '}'
          break;
        }
      }
    }

    if (funcEndIndex === -1) {
      throw new Error(
        `[patch-firebase] CRITICAL: Cannot find end of nativeModuleWrapped function in ${nativeModulePath}.`
      );
    }

    const replacement = `function nativeModuleWrapped(namespace, NativeModule, argToPrepend) {
  // [RNFB-PATCH] Proxy fallback for TurboModule interop
  // Under RN 0.86 New Architecture, Object.keys(NativeModule) may NOT enumerate
  // TurboModule methods. We use a Proxy to dynamically wrap any accessed method.
  const native = {};
  if (!NativeModule) {
    return NativeModule;
  }

  // Step 1: Extract constants via getConstants() for TurboModule interop
  if (typeof NativeModule.getConstants === 'function') {
    try {
      const constants = NativeModule.getConstants();
      if (constants && typeof constants === 'object') {
        Object.assign(native, constants);
      }
    } catch (err) {
      console.warn(\`[RNFB \${namespace}] Failed to extract getConstants() from NativeModule:\`, err && (err.message || err));
    }
  }

  // Step 2: Copy enumerable properties (works for old arch bridge modules)
  const properties = Object.keys(NativeModule);
  for (let i = 0, len = properties.length; i < len; i++) {
    const property = properties[i];
    if (typeof NativeModule[property] === 'function') {
      native[property] = nativeModuleMethodWrapped(namespace, NativeModule[property], argToPrepend);
    } else {
      native[property] = NativeModule[property];
    }
  }

  // Step 3: Proxy fallback for non-enumerable TurboModule methods
  // If a property is accessed that doesn't exist on 'native', check the original
  // NativeModule. If it's a function, wrap it and cache it for future access.
  if (typeof Proxy !== 'undefined') {
    return new Proxy(native, {
      get(target, prop, receiver) {
        if (prop in target) {
          return target[prop];
        }
        // Fallback: check the original NativeModule
        try {
          const nativeVal = NativeModule[prop];
          if (typeof nativeVal === 'function') {
            // Wrap and cache for subsequent calls
            target[prop] = nativeModuleMethodWrapped(namespace, nativeVal, argToPrepend);
            return target[prop];
          }
          return nativeVal;
        } catch (e) {
          return undefined;
        }
      },
      has(target, prop) {
        if (prop in target) return true;
        try {
          return prop in NativeModule || NativeModule[prop] !== undefined;
        } catch (e) {
          return false;
        }
      },
      ownKeys(target) {
        return Reflect.ownKeys(target);
      }
    });
  }

  // Fallback if Proxy isn't available (shouldn't happen on modern Hermes)
  return native;
}`;

    const patchedContent = content.substring(0, startIndex) + replacement + content.substring(funcEndIndex);
    fs.writeFileSync(nativeModulePath, patchedContent, 'utf8');
    console.log('[patch-firebase] Successfully patched registry/nativeModule.js with Proxy fallback for TurboModule interop.');
    patchCount++;
  }
}

// ─── 2. Patch @react-native-firebase/auth/lib/index.js ────────────────────────
const authIndexPath = path.resolve(
  __dirname,
  '../node_modules/@react-native-firebase/auth/lib/index.js'
);

if (!fs.existsSync(authIndexPath)) {
  console.log('[patch-firebase] auth/lib/index.js not found, skipping.');
} else {
  const content = fs.readFileSync(authIndexPath, 'utf8');
  const alreadyPatchedMarker = 'const appLanguage = (this.native && this.native.APP_LANGUAGE) || {};';

  if (content.includes(alreadyPatchedMarker)) {
    console.log('[patch-firebase] auth/lib/index.js is already fully patched.');
    skipCount++;
  } else {
    const langTarget = '    this._languageCode = this.native.APP_LANGUAGE[this.app._name];';
    const langDefaultTarget = "      this._languageCode = this.native.APP_LANGUAGE['[DEFAULT]'];";
    const userTarget = '    if (this.native.APP_USER[this.app._name]) {';
    const setUserTarget = '      this._setUser(this.native.APP_USER[this.app._name]);';

    if (!content.includes(langTarget)) {
      throw new Error(
        `[patch-firebase] CRITICAL: Language target pattern not found in ${authIndexPath}. Expected: "${langTarget}"`
      );
    }
    if (!content.includes(userTarget)) {
      throw new Error(
        `[patch-firebase] CRITICAL: User target pattern not found in ${authIndexPath}. Expected: "${userTarget}"`
      );
    }

    let patchedContent = content;

    const langReplacement = `    const appLanguage = (this.native && this.native.APP_LANGUAGE) || {};
    this._languageCode = appLanguage[this.app._name] || appLanguage['[DEFAULT]'] || '';`;
    patchedContent = patchedContent.replace(langTarget, langReplacement);

    // Replace the secondary default language lookup if present
    if (patchedContent.includes(langDefaultTarget)) {
      patchedContent = patchedContent.replace(
        langDefaultTarget,
        "      this._languageCode = appLanguage['[DEFAULT]'] || '';"
      );
    }

    const userReplacement = `    const appUser = (this.native && this.native.APP_USER) || {};
    if (appUser[this.app._name]) {`;
    patchedContent = patchedContent.replace(userTarget, userReplacement);

    if (patchedContent.includes(setUserTarget)) {
      patchedContent = patchedContent.replace(
        setUserTarget,
        '      this._setUser(appUser[this.app._name]);'
      );
    }

    fs.writeFileSync(authIndexPath, patchedContent, 'utf8');
    console.log('[patch-firebase] Successfully patched auth/lib/index.js with defensive language/user guards.');
    patchCount++;
  }
}

// ─── 3. Patch @react-native-firebase/app/lib/internal/NativeFirebaseError.js ───
const errorPath = path.resolve(
  __dirname,
  '../node_modules/@react-native-firebase/app/lib/internal/NativeFirebaseError.js'
);

if (!fs.existsSync(errorPath)) {
  console.log('[patch-firebase] NativeFirebaseError.js not found, skipping.');
} else {
  const content = fs.readFileSync(errorPath, 'utf8');
  const alreadyPatchedMarker = 'const safeError = (nativeError && typeof nativeError === \'object\') ? nativeError : {};';

  if (content.includes(alreadyPatchedMarker)) {
    console.log('[patch-firebase] NativeFirebaseError.js is already fully patched.');
    skipCount++;
  } else {
    const safeContent = `/*
 * Copyright (c) 2016-present Invertase Limited & Contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this library except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

export default class NativeFirebaseError extends Error {
  static fromEvent(errorEvent, namespace, stack) {
    return new NativeFirebaseError({ userInfo: errorEvent }, stack || (new Error().stack || ''), namespace);
  }

  constructor(nativeError, jsStack, namespace) {
    super();
    const safeError = (nativeError && typeof nativeError === 'object') ? nativeError : {};
    const userInfo = (safeError.userInfo && typeof safeError.userInfo === 'object') ? safeError.userInfo : safeError;

    Object.defineProperty(this, 'namespace', {
      enumerable: false,
      value: namespace || 'firebase',
    });

    const code = userInfo?.code || safeError?.code || safeError?.nativeErrorCode || 'unknown';
    Object.defineProperty(this, 'code', {
      enumerable: false,
      value: \`\${this.namespace}/\${code}\`,
    });

    const message = userInfo?.message || safeError?.message || safeError?.nativeErrorMessage || 'Unknown native error';
    Object.defineProperty(this, 'message', {
      enumerable: false,
      value: \`[\${this.code}] \${message}\`,
    });

    Object.defineProperty(this, 'jsStack', {
      enumerable: false,
      value: jsStack || '',
    });

    Object.defineProperty(this, 'userInfo', {
      enumerable: false,
      value: userInfo,
    });

    Object.defineProperty(this, 'nativeErrorCode', {
      enumerable: false,
      value: userInfo?.nativeErrorCode || safeError?.code || null,
    });

    Object.defineProperty(this, 'nativeErrorMessage', {
      enumerable: false,
      value: userInfo?.nativeErrorMessage || safeError?.message || null,
    });

    this.stack = NativeFirebaseError.getStackWithMessage(
      \`NativeFirebaseError: \${this.message}\`,
      this.jsStack,
    );
  }

  static getStackWithMessage(message, jsStack) {
    if (!jsStack || typeof jsStack !== 'string') return message;
    return [message, ...jsStack.split('\\n').slice(2, 13)].join('\\n');
  }
}
`;
    fs.writeFileSync(errorPath, safeContent, 'utf8');
    console.log('[patch-firebase] Successfully installed bulletproof NativeFirebaseError.js.');
    patchCount++;
  }
}

console.log(`[patch-firebase] Done. Patched: ${patchCount}, Already up-to-date: ${skipCount}`);
