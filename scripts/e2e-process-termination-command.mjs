import { execFile } from 'node:child_process';
import { types as utilTypes } from 'node:util';

const DEFAULT_TIMEOUT_MS = 5000;
const MIN_TIMEOUT_MS = 10;
const MAX_TIMEOUT_MS = 15000;
const TIMER_GRACE_MS = 50;
const MAX_BUFFER = 65536;
const IDENTITY_INSUFFICIENT_PLATFORMS = new Set([
  'aix',
  'android',
  'darwin',
  'freebsd',
  'linux',
  'openbsd',
  'sunos',
]);

function invalidResult() {
  return { complete: false, errors: ['termination-command-invalid-input'], attempted: false, target: null };
}

function isProxyObject(value) {
  try {
    return utilTypes.isProxy(value) === true;
  } catch {
    return true;
  }
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  if (isProxyObject(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactDataDescriptors(value, keys) {
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.length !== keys.length || ownKeys.some((key, index) => key !== keys[index])) {
    return null;
  }

  const descriptors = keys.map((key) => Object.getOwnPropertyDescriptor(value, key));
  if (descriptors.some((descriptor) =>
    descriptor === undefined ||
    !Object.prototype.hasOwnProperty.call(descriptor, 'value') ||
    Object.prototype.hasOwnProperty.call(descriptor, 'get') ||
    Object.prototype.hasOwnProperty.call(descriptor, 'set') ||
    descriptor.enumerable !== true)
  ) {
    return null;
  }

  return descriptors;
}

function normalizeInput(input) {
  if (!isPlainObject(input)) {
    return null;
  }

  const ownKeys = Reflect.ownKeys(input);
  const descriptors = new Map();
  for (const key of ownKeys) {
    if (typeof key !== 'string'
      || (key !== 'target' && key !== 'platform' && key !== 'execFileImpl' && key !== 'timeoutMs')) {
      return null;
    }

    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (
      descriptor === undefined ||
      !Object.prototype.hasOwnProperty.call(descriptor, 'value') ||
      Object.prototype.hasOwnProperty.call(descriptor, 'get') ||
      Object.prototype.hasOwnProperty.call(descriptor, 'set') ||
      descriptor.enumerable !== true
    ) {
      return null;
    }

    descriptors.set(key, descriptor);
  }

  if (!descriptors.has('target')) {
    return null;
  }

  const platformDescriptor = descriptors.get('platform');
  const execFileDescriptor = descriptors.get('execFileImpl');
  const timeoutDescriptor = descriptors.get('timeoutMs');
  const platform = platformDescriptor === undefined || platformDescriptor.value === undefined
    ? process.platform
    : platformDescriptor.value;
  const execFileImpl = execFileDescriptor === undefined || execFileDescriptor.value === undefined
    ? execFile
    : execFileDescriptor.value;
  const timeoutMs = timeoutDescriptor === undefined || timeoutDescriptor.value === undefined
    ? DEFAULT_TIMEOUT_MS
    : timeoutDescriptor.value;

  if (
    typeof platform !== 'string' ||
    typeof execFileImpl !== 'function' ||
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs < MIN_TIMEOUT_MS ||
    timeoutMs > MAX_TIMEOUT_MS
  ) {
    return null;
  }

  return {
    target: descriptors.get('target').value,
    platform,
    execFileImpl,
    timeoutMs,
  };
}

function executeWindowsTaskkill(target, normalized) {
  return new Promise((resolve) => {
    let settled = false;
    let timer;
    let timerStarted = false;
    let returnedHelper;

    const settle = (complete, errors) => {
      if (settled) {
        return false;
      }

      settled = true;
      if (timerStarted) {
        try {
          clearTimeout(timer);
        } catch {
        }
      }
      resolve({ complete, errors, attempted: true, target });
      return true;
    };

    const onOuterTimeout = () => {
      if (!settle(false, ['termination-command-timeout'])) {
        return;
      }

      try {
        if (returnedHelper !== null && returnedHelper !== undefined) {
          const kill = returnedHelper.kill;
          if (typeof kill === 'function') {
            Reflect.apply(kill, returnedHelper, []);
          }
        }
      } catch {
      }
    };

    const callback = (error, stdout, stderr) => {
      if (settled) {
        return;
      }

      try {
        if (error !== null && error !== undefined) {
          const code = error.code;
          if (code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') {
            settle(false, ['termination-command-output-overflow']);
            return;
          }
          if (code === 'ETIMEDOUT' || error.killed) {
            settle(false, ['termination-command-timeout']);
            return;
          }
          settle(false, ['termination-command-failed']);
          return;
        }

        if (typeof stdout !== 'string' || typeof stderr !== 'string') {
          settle(false, ['termination-command-output-invalid']);
          return;
        }

        if (
          Buffer.byteLength(stdout, 'utf8') > MAX_BUFFER ||
          Buffer.byteLength(stderr, 'utf8') > MAX_BUFFER
        ) {
          settle(false, ['termination-command-output-overflow']);
          return;
        }

        settle(true, []);
      } catch {
        settle(false, ['termination-command-failed']);
      }
    };

    try {
      timer = setTimeout(onOuterTimeout, normalized.timeoutMs + TIMER_GRACE_MS);
      timerStarted = true;
      if (settled) {
        clearTimeout(timer);
      }
      returnedHelper = normalized.execFileImpl(
        'taskkill.exe',
        ['/PID', String(target.pid), '/F'],
        {
          shell: false,
          windowsHide: true,
          encoding: 'utf8',
          timeout: normalized.timeoutMs,
          maxBuffer: MAX_BUFFER,
          killSignal: 'SIGKILL',
        },
        callback,
      );
    } catch {
      settle(false, ['termination-command-failed']);
    }
  });
}

export async function invokeExactWindowsTaskkill(input = {}) {
  try {
    const normalized = normalizeInput(input);
    if (normalized === null) {
      return invalidResult();
    }

    const target = normalized.target;
    if (!isPlainObject(target)) {
      return invalidResult();
    }

    const targetDescriptors = exactDataDescriptors(target, ['pid', 'creationToken']);
    if (targetDescriptors === null) {
      return invalidResult();
    }

    const pid = targetDescriptors[0].value;
    const creationToken = targetDescriptors[1].value;
    if (
      !Number.isSafeInteger(pid) ||
      pid <= 0 ||
      typeof creationToken !== 'string' ||
      creationToken.trim().length === 0 ||
      creationToken.trim() !== creationToken ||
      creationToken.length > 128 ||
      /[\u0000-\u001F\u007F]/u.test(creationToken)
    ) {
      return invalidResult();
    }

    const targetClone = { pid, creationToken };
    if (IDENTITY_INSUFFICIENT_PLATFORMS.has(normalized.platform)) {
      return {
        complete: false,
        errors: ['termination-command-identity-insufficient'],
        attempted: false,
        target: targetClone,
      };
    }

    if (normalized.platform !== 'win32') {
      return {
        complete: false,
        errors: ['termination-command-platform-unsupported'],
        attempted: false,
        target: targetClone,
      };
    }

    return await executeWindowsTaskkill(targetClone, normalized);
  } catch {
    return invalidResult();
  }
}
