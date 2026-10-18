/**
 * Robust patch for @react-native-firebase/app/lib/internal/NativeFirebaseError.js
 * 
 * Prevents Hermes engine TypeError: "Cannot convert undefined value to object"
 * by safely guarding nativeError, userInfo, code, message, and jsStack.
 */

const fs = require('fs');
const path = require('path');

const targetPath = path.resolve(
  __dirname,
  '../node_modules/@react-native-firebase/app/lib/internal/NativeFirebaseError.js'
);

if (!fs.existsSync(targetPath)) {
  console.log('[patch-firebase] Target file not found, skipping patch:', targetPath);
  process.exit(0);
}

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

fs.writeFileSync(targetPath, safeContent, 'utf8');
console.log('[patch-firebase] Successfully installed bulletproof NativeFirebaseError.js');
