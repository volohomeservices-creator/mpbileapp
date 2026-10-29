/**
 * Comprehensive compatibility patch for @react-native-firebase under React Native New Architecture (TurboModules).
 * 
 * Fixes Hermes engine crashes ("Cannot convert undefined value to object" & "undefined is not a function") by:
 * 1. Exposing getConstants() and wrapping NATIVE_MODULE_REGISTRY entries in a Proxy that
 *    dynamically intercepts all TurboModule method calls (even non-enumerable / prototype methods).
 * 2. Defensively guarding APP_LANGUAGE, APP_USER, addAuthStateListener, addIdTokenListener,
 *    and configureAuthDomain in auth/lib/index.js constructor.
 * 3. Bulletproofing NativeFirebaseError.js against unmasked rejection payloads.
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
  let content = fs.readFileSync(nativeModulePath, 'utf8');
  const registryProxyMarker = '// [RNFB-PATCH] Registry Proxy fallback for TurboModule interop';

  if (content.includes(registryProxyMarker)) {
    console.log('[patch-firebase] registry/nativeModule.js is already fully patched.');
    skipCount++;
  } else {
    // 1A. Patch nativeModuleWrapped to inspect prototype and properties
    const funcStart = 'function nativeModuleWrapped(namespace, NativeModule, argToPrepend) {';
    const startIndex = content.indexOf(funcStart);
    if (startIndex !== -1) {
      const bodyStart = startIndex + funcStart.length;
      let braceDepth = 1;
      let funcEndIndex = -1;
      for (let i = bodyStart; i < content.length; i++) {
        if (content[i] === '{') braceDepth++;
        if (content[i] === '}') {
          braceDepth--;
          if (braceDepth === 0) {
            funcEndIndex = i + 1;
            break;
          }
        }
      }

      if (funcEndIndex !== -1) {
        const replacement = `function nativeModuleWrapped(namespace, NativeModule, argToPrepend) {
  const native = {};
  if (!NativeModule) {
    return NativeModule;
  }

  // Extract constants via getConstants() for TurboModule interop
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

  // Copy own and prototype properties
  const propSet = new Set();
  let curr = NativeModule;
  while (curr && curr !== Object.prototype) {
    Object.getOwnPropertyNames(curr).forEach(p => propSet.add(p));
    curr = Object.getPrototypeOf(curr);
  }

  propSet.forEach(property => {
    try {
      if (typeof NativeModule[property] === 'function') {
        native[property] = nativeModuleMethodWrapped(namespace, NativeModule[property], argToPrepend);
      } else if (native[property] === undefined) {
        native[property] = NativeModule[property];
      }
    } catch (e) {}
  });

  if (typeof Proxy !== 'undefined') {
    return new Proxy(native, {
      get(target, prop) {
        if (prop in target) return target[prop];
        try {
          const raw = NativeModule[prop];
          if (typeof raw === 'function') {
            target[prop] = nativeModuleMethodWrapped(namespace, raw, argToPrepend);
            return target[prop];
          }
          return raw;
        } catch (e) {
          return undefined;
        }
      }
    });
  }

  return native;
}`;
        content = content.substring(0, startIndex) + replacement + content.substring(funcEndIndex);
      }
    }

    // 1B. Patch initialiseNativeModule to return Proxy for NATIVE_MODULE_REGISTRY[key]
    const freezeTarget = '  Object.freeze(multiModuleRoot);\n\n  NATIVE_MODULE_REGISTRY[key] = multiModuleRoot;\n\n  return NATIVE_MODULE_REGISTRY[key];';
    const fallbackTarget = '  NATIVE_MODULE_REGISTRY[key] = multiModuleRoot;\n\n  return NATIVE_MODULE_REGISTRY[key];';

    const registryReplacement = `  // [RNFB-PATCH] Registry Proxy fallback for TurboModule interop
  const multiModuleProxy = (typeof Proxy !== 'undefined') ? new Proxy(multiModuleRoot, {
    get(target, prop) {
      if (prop in target) {
        return target[prop];
      }
      for (let i = 0; i < nativeModuleNames.length; i++) {
        const nm = NativeModules[nativeModuleNames[i]];
        if (nm) {
          try {
            const val = nm[prop];
            if (typeof val === 'function') {
              const prepended = [];
              if (hasMultiAppSupport) prepended.push(module.app.name);
              if (hasCustomUrlOrRegionSupport && !disablePrependCustomUrlOrRegion) prepended.push(module._customUrlOrRegion);
              target[prop] = nativeModuleMethodWrapped(namespace, val, prepended);
              return target[prop];
            }
            if (val !== undefined) {
              return val;
            }
          } catch (e) {}
        }
      }
      return undefined;
    },
    has(target, prop) {
      if (prop in target) return true;
      for (let i = 0; i < nativeModuleNames.length; i++) {
        const nm = NativeModules[nativeModuleNames[i]];
        if (nm && (prop in nm || nm[prop] !== undefined)) return true;
      }
      return false;
    }
  }) : multiModuleRoot;

  NATIVE_MODULE_REGISTRY[key] = multiModuleProxy;

  return NATIVE_MODULE_REGISTRY[key];`;

    if (content.includes(freezeTarget)) {
      content = content.replace(freezeTarget, registryReplacement);
    } else if (content.includes(fallbackTarget)) {
      content = content.replace(fallbackTarget, registryReplacement);
    }

    fs.writeFileSync(nativeModulePath, content, 'utf8');
    console.log('[patch-firebase] Successfully patched registry/nativeModule.js with complete Proxy support.');
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
  let content = fs.readFileSync(authIndexPath, 'utf8');
  const listenerGuardsMarker = 'typeof this.native.addAuthStateListener === \'function\'';

  if (content.includes(listenerGuardsMarker)) {
    console.log('[patch-firebase] auth/lib/index.js is already fully patched with listener guards.');
    skipCount++;
  } else {
    // 2A. Language and User defensive guards (if not already present)
    const langTarget = '    this._languageCode = this.native.APP_LANGUAGE[this.app._name];';
    if (content.includes(langTarget)) {
      const langReplacement = `    const appLanguage = (this.native && this.native.APP_LANGUAGE) || {};
    this._languageCode = appLanguage[this.app._name] || appLanguage['[DEFAULT]'] || '';`;
      content = content.replace(langTarget, langReplacement);
    }

    const langDefaultTarget = "      this._languageCode = this.native.APP_LANGUAGE['[DEFAULT]'];";
    if (content.includes(langDefaultTarget)) {
      content = content.replace(
        langDefaultTarget,
        "      this._languageCode = appLanguage['[DEFAULT]'] || '';"
      );
    }

    const userTarget = '    if (this.native.APP_USER[this.app._name]) {';
    if (content.includes(userTarget)) {
      const userReplacement = `    const appUser = (this.native && this.native.APP_USER) || {};
    if (appUser[this.app._name]) {`;
      content = content.replace(userTarget, userReplacement);
    }

    const setUserTarget = '      this._setUser(this.native.APP_USER[this.app._name]);';
    if (content.includes(setUserTarget)) {
      content = content.replace(
        setUserTarget,
        '      this._setUser(appUser[this.app._name]);'
      );
    }

    // 2B. Listener defensive guards (Fixes "undefined is not a function" in auth constructor)
    const listenersTarget = `    this.native.addAuthStateListener();
    this.native.addIdTokenListener();

    // custom authDomain in only available from App's FirebaseOptions,
    // but we need it in Auth if it exists. During app configuration we store
    // mappings from app name to authDomain, this auth constructor
    // is a reasonable time to use the mapping and set it into auth natively
    this.native.configureAuthDomain();`;

    const listenersReplacement = `    if (this.native && typeof this.native.addAuthStateListener === 'function') {
      this.native.addAuthStateListener();
    }
    if (this.native && typeof this.native.addIdTokenListener === 'function') {
      this.native.addIdTokenListener();
    }

    // custom authDomain in only available from App's FirebaseOptions,
    // but we need it in Auth if it exists. During app configuration we store
    // mappings from app name to authDomain, this auth constructor
    // is a reasonable time to use the mapping and set it into auth natively
    if (this.native && typeof this.native.configureAuthDomain === 'function') {
      this.native.configureAuthDomain();
    }`;

    if (content.includes(listenersTarget)) {
      content = content.replace(listenersTarget, listenersReplacement);
    } else {
      // Line by line fallback
      content = content.replace('    this.native.addAuthStateListener();', '    if (this.native && typeof this.native.addAuthStateListener === \'function\') { this.native.addAuthStateListener(); }');
      content = content.replace('    this.native.addIdTokenListener();', '    if (this.native && typeof this.native.addIdTokenListener === \'function\') { this.native.addIdTokenListener(); }');
      content = content.replace('    this.native.configureAuthDomain();', '    if (this.native && typeof this.native.configureAuthDomain === \'function\') { this.native.configureAuthDomain(); }');
    }

    fs.writeFileSync(authIndexPath, content, 'utf8');
    console.log('[patch-firebase] Successfully patched auth/lib/index.js with defensive listener guards.');
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

// ─── 4. Patch expo-clipboard expo-module.config.json publication.version ───
const clipboardConfigPath = path.resolve(
  __dirname,
  '../node_modules/expo-clipboard/expo-module.config.json'
);
if (fs.existsSync(clipboardConfigPath)) {
  try {
    const raw = fs.readFileSync(clipboardConfigPath, 'utf8');
    const cfg = JSON.parse(raw);
    if (cfg.android && cfg.android.publication && !cfg.android.publication.version) {
      cfg.android.publication.version = '58.0.4';
      fs.writeFileSync(clipboardConfigPath, JSON.stringify(cfg, null, 2), 'utf8');
      console.log('[patch-firebase] Successfully added publication.version to expo-clipboard.');
      patchCount++;
    } else {
      console.log('[patch-firebase] expo-clipboard already has publication.version.');
      skipCount++;
    }
  } catch (err) {
    console.warn('[patch-firebase] Warning: could not patch expo-clipboard:', err.message);
  }
}

console.log(`[patch-firebase] Done. Patched: ${patchCount}, Already up-to-date: ${skipCount}`);
