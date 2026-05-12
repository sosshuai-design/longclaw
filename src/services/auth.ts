/**
 * auth.ts — 认证服务
 *
 * 使用 SecureStore 存储 JWT token 和用户信息（系统 Keychain/KeyStore 加密）。
 * 支持：邮箱+密码、微信（OAuth）、GitHub（OAuth）。
 * Phase 1 实现本地模拟认证，后端接入时替换 API 调用即可。
 */

import * as SecureStore from 'expo-secure-store';
import { User } from '../types';

const STORAGE_KEYS = {
  token: 'wikimind_auth_token',
  user: 'wikimind_auth_user',
};

// ─── 本地存储操作 ─────────────────────────────────────────────────────────────

export async function saveAuth(token: string, user: User): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(STORAGE_KEYS.token, token),
    SecureStore.setItemAsync(STORAGE_KEYS.user, JSON.stringify(user)),
  ]);
}

export async function loadAuth(): Promise<{ token: string; user: User } | null> {
  const [token, userStr] = await Promise.all([
    SecureStore.getItemAsync(STORAGE_KEYS.token),
    SecureStore.getItemAsync(STORAGE_KEYS.user),
  ]);

  if (!token || !userStr) return null;

  try {
    return { token, user: JSON.parse(userStr) as User };
  } catch {
    return null;
  }
}

export async function clearAuth(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(STORAGE_KEYS.token),
    SecureStore.deleteItemAsync(STORAGE_KEYS.user),
  ]);
}

// ─── 认证 API（Phase 1：本地模拟） ──────────────────────────────────────────

export interface LoginResult {
  token: string;
  user: User;
}

export async function loginWithEmail(
  email: string,
  password: string
): Promise<LoginResult> {
  // TODO: 替换为真实后端调用（Supabase / Firebase）
  if (!email.includes('@')) throw new Error('邮箱格式不正确');
  if (password.length < 8) throw new Error('密码至少 8 位');

  // 模拟网络延迟
  await new Promise((r) => setTimeout(r, 600));

  const user: User = {
    id: `user_${Date.now()}`,
    email,
    username: email.split('@')[0],
    createdAt: new Date().toISOString(),
  };
  const token = `mock_token_${Date.now()}`;

  await saveAuth(token, user);
  return { token, user };
}

export async function registerWithEmail(params: {
  email: string;
  username: string;
  password: string;
  confirmPassword: string;
}): Promise<LoginResult> {
  const { email, username, password, confirmPassword } = params;

  if (!email.includes('@')) throw new Error('邮箱格式不正确');
  if (username.trim().length < 2) throw new Error('用户名至少 2 个字符');
  if (password.length < 8) throw new Error('密码至少 8 位');
  if (password !== confirmPassword) throw new Error('两次密码不一致');

  // TODO: 替换为真实后端调用
  await new Promise((r) => setTimeout(r, 800));

  const user: User = {
    id: `user_${Date.now()}`,
    email,
    username,
    createdAt: new Date().toISOString(),
  };
  const token = `mock_token_${Date.now()}`;

  await saveAuth(token, user);
  return { token, user };
}

export async function logout(): Promise<void> {
  await clearAuth();
}

// ─── OAuth（占位，Phase 2 实现） ─────────────────────────────────────────────

export async function loginWithWeChat(): Promise<LoginResult> {
  throw new Error('微信登录功能即将上线');
}

export async function loginWithGitHub(): Promise<LoginResult> {
  throw new Error('GitHub 登录功能即将上线');
}

// ─── 修改密码 ─────────────────────────────────────────────────────────────────

export async function changePassword(
  oldPassword: string,
  newPassword: string
): Promise<void> {
  if (newPassword.length < 8) throw new Error('新密码至少 8 位');
  // TODO: 替换为真实后端调用
  await new Promise((r) => setTimeout(r, 500));
}
