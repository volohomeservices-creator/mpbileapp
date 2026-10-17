/**
 * Patch @react-native-firebase/app/lib/internal/NativeFirebaseError.js
 * 
 * Fixes Hermes engine crash: "TypeError: Cannot convert undefined value to object"
 * which occurs when native Android rejects a promise without iOS-style userInfo property,
 * causing `const { userInfo } = nativeError` and `userInfo.code` to evaluate on undefined.
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

let content = fs.readFileSync(targetPath, 'utf8');

const unpatchedPattern = 'const { userInfo } = nativeError;';
if (!content.includes(unpatchedPattern)) {
  console.log('[patch-firebase] NativeFirebaseError.js is already patched.');
  process.exit(0);
}

const replacement = `    const safeError = nativeError || {};
    const userInfo = safeError.userInfo || safeError;`;

content = content.replace(unpatchedPattern, replacement);

// Also guard userInfo.code and userInfo.message
content = content.replace(
  "value: `${this.namespace}/${userInfo.code || 'unknown'}`,",
  "value: `${this.namespace}/${userInfo?.code || safeError?.code || 'unknown'}`,",
);
content = content.replace(
  "value: `[${this.code}] ${userInfo.message || nativeError.message}`,",
  "value: `[${this.code}] ${userInfo?.message || safeError?.message || 'Unknown error'}`,",
);

fs.writeFileSync(targetPath, content, 'utf8');
console.log('[patch-firebase] Successfully patched NativeFirebaseError.js');
