/**
 * Comprehensive compatibility patch for @react-native-firebase under React Native New Architecture (TurboModules).
 * 
 * Fixes Hermes engine crash "TypeError: Cannot convert undefined value to object" by:
 * 1. Safely exposing getConstants() in registry/nativeModule.js for TurboModule interop.
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
const nativeModulePath = path.resolve(
  __dirname,
  '../node_modules/@react-native-firebase/app/lib/internal/registry/nativeModule.js'
);

if (!fs.existsSync(nativeModulePath)) {
  console.log('[patch-firebase] registry/nativeModule.js not found, skipping.');
} else {
  const content = fs.readFileSync(nativeModulePath, 'utf8');
  const alreadyPatchedMarker = 'NativeModule.getConstants === \'function\'';

  if (content.includes(alreadyPatchedMarker)) {
    console.log('[patch-firebase] registry/nativeModule.js is already fully patched.');
    skipCount++;
  } else {
    const targetPattern = '  const properties = Object.keys(NativeModule);';
    if (!content.includes(targetPattern)) {
      throw new Error(
        `[patch-firebase] CRITICAL: Target pattern not found in ${nativeModulePath}. Expected: "${targetPattern}"`
      );
    }

    const replacement = `  if (typeof NativeModule.getConstants === 'function') {
    try {
      const constants = NativeModule.getConstants();
      if (constants && typeof constants === 'object') {
        Object.assign(native, constants);
      }
    } catch (err) {
      console.warn(\`[RNFB \${namespace}] Failed to extract getConstants() from NativeModule:\`, err && (err.message || err));
    }
  }

  const properties = Object.keys(NativeModule);`;

    const patchedContent = content.replace(targetPattern, replacement);
    fs.writeFileSync(nativeModulePath, patchedContent, 'utf8');
    console.log('[patch-firebase] Successfully patched registry/nativeModule.js with getConstants support.');
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
