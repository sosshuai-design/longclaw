import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Alert,
  TextInput,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  User,
  Cpu,
  HardDrive,
  ChevronRight,
  Key,
  Check,
  X,
  LogOut,
} from 'lucide-react-native';
import { Colors } from '../constants/colors';
import { useAuthStore } from '../store/authStore';
import { useSettingsStore } from '../store/settingsStore';
import { PROVIDERS, PROVIDER_KEYS_ORDERED, saveApiKey, getApiKey, hasApiKey } from '../services/llm';
import { LLMProviderKey } from '../types';

// ─── API Key 管理模态框 ───────────────────────────────────────────────────────

function ApiKeyModal({
  providerKey,
  visible,
  onClose,
}: {
  providerKey: LLMProviderKey;
  visible: boolean;
  onClose: () => void;
}) {
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasKey, setHasKey] = useState(false);
  const provider = PROVIDERS[providerKey];

  React.useEffect(() => {
    if (visible) {
      hasApiKey(providerKey).then(setHasKey);
      setApiKey('');
    }
  }, [visible, providerKey]);

  async function handleSave() {
    if (!apiKey.trim()) return;
    setLoading(true);
    try {
      await saveApiKey(providerKey, apiKey.trim());
      setHasKey(true);
      Alert.alert('保存成功', `${provider.name} API Key 已安全保存`);
      onClose();
    } catch {
      Alert.alert('保存失败', '请重试');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>{provider.name} API Key</Text>
          {hasKey && (
            <View style={styles.hasKeyBadge}>
              <Check size={14} color={Colors.success} />
              <Text style={styles.hasKeyText}>已设置 API Key</Text>
            </View>
          )}

          <Text style={styles.modalHint}>
            API Key 将使用系统 Keychain 安全存储，不会上传至任何服务器。
          </Text>
          <Text style={styles.modalModel}>模型：{provider.model}</Text>

          <TextInput
            style={styles.keyInput}
            value={apiKey}
            onChangeText={setApiKey}
            placeholder={hasKey ? '输入新 Key 以替换…' : '粘贴 API Key…'}
            placeholderTextColor={Colors.text.tertiary}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.modalCancelBtn} onPress={onClose}>
              <Text style={styles.modalCancelText}>取消</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalSaveBtn, !apiKey.trim() && { opacity: 0.5 }]}
              onPress={handleSave}
              disabled={!apiKey.trim() || loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.modalSaveText}>保存</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── SettingsScreen ────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const { user, logout } = useAuthStore();
  const { activeProvider, setActiveProvider, autoLintEnabled, setAutoLint, iCloudSyncEnabled, setICloudSync } = useSettingsStore();
  const [apiKeyModal, setApiKeyModal] = useState<LLMProviderKey | null>(null);

  async function handleLogout() {
    Alert.alert('退出登录', '确定要退出吗？本地 Wiki 数据不会被删除。', [
      { text: '取消', style: 'cancel' },
      { text: '退出', style: 'destructive', onPress: logout },
    ]);
  }

  const initials = user?.username?.slice(0, 1).toUpperCase() ?? 'W';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageTitle}>设置</Text>

        {/* 账户 */}
        <SectionHeader icon={<User size={16} color={Colors.primary} />} label="账户" />
        <View style={styles.card}>
          <View style={styles.userRow}>
            <View style={styles.userAvatar}>
              <Text style={styles.userAvatarText}>{initials}</Text>
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{user?.username}</Text>
              <Text style={styles.userEmail}>{user?.email}</Text>
            </View>
          </View>
          <SettingsItem label="修改密码" onPress={() => Alert.alert('修改密码', '即将上线')} />
          <SettingsItem
            label="退出登录"
            onPress={handleLogout}
            textColor={Colors.lint.conflict}
            icon={<LogOut size={16} color={Colors.lint.conflict} />}
            isLast
          />
        </View>

        {/* 大模型 */}
        <SectionHeader icon={<Cpu size={16} color={Colors.primary} />} label="大模型" />
        <View style={styles.card}>
          {PROVIDER_KEYS_ORDERED.map((key, i) => {
            const provider = PROVIDERS[key];
            const isActive = activeProvider === key;
            const isLast = i === PROVIDER_KEYS_ORDERED.length - 1;

            return (
              <View key={key} style={[styles.providerRow, !isLast && styles.rowBorder]}>
                <TouchableOpacity
                  style={styles.providerLeft}
                  onPress={() => setActiveProvider(key)}
                >
                  <View style={[styles.radioOuter, isActive && styles.radioOuterActive]}>
                    {isActive && <View style={styles.radioInner} />}
                  </View>
                  <View>
                    <Text style={styles.providerName}>{provider.name}</Text>
                    <Text style={styles.providerModel}>{provider.model}</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.keyBtn}
                  onPress={() => setApiKeyModal(key)}
                >
                  <Key size={14} color={Colors.text.secondary} />
                  <Text style={styles.keyBtnText}>API Key</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>

        {/* 存储与同步 */}
        <SectionHeader icon={<HardDrive size={16} color={Colors.primary} />} label="存储与同步" />
        <View style={styles.card}>
          <SettingsItem
            label="存储位置"
            value="本地 Documents/WikiMind"
            onPress={() => {}}
          />
          <SettingsToggle
            label="iCloud 同步"
            desc="自动同步 Wiki 到 iCloud Drive"
            value={iCloudSyncEnabled}
            onToggle={setICloudSync}
          />
          <SettingsToggle
            label="自动健康检查"
            desc="每周自动运行 Lint 检测"
            value={autoLintEnabled}
            onToggle={setAutoLint}
            isLast
          />
        </View>

        {/* Wiki 规则 */}
        <SectionHeader icon={<Key size={16} color={Colors.primary} />} label="Wiki 规则" />
        <View style={styles.card}>
          <SettingsItem label="编辑 WIKI_SCHEMA.md" onPress={() => Alert.alert('Schema', '即将上线')} isLast />
        </View>

        <Text style={styles.version}>WikiMind v1.0.0 · Phase 1 MVP</Text>
      </ScrollView>

      {apiKeyModal && (
        <ApiKeyModal
          providerKey={apiKeyModal}
          visible
          onClose={() => setApiKeyModal(null)}
        />
      )}
    </SafeAreaView>
  );
}

// ─── 小组件 ───────────────────────────────────────────────────────────────────

function SectionHeader({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <View style={styles.sectionHeader}>
      {icon}
      <Text style={styles.sectionLabel}>{label}</Text>
    </View>
  );
}

function SettingsItem({
  label,
  value,
  onPress,
  textColor,
  icon,
  isLast,
}: {
  label: string;
  value?: string;
  onPress: () => void;
  textColor?: string;
  icon?: React.ReactNode;
  isLast?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.settingsItem, !isLast && styles.rowBorder]}
      onPress={onPress}
    >
      {icon && <View style={styles.settingsIcon}>{icon}</View>}
      <Text style={[styles.settingsLabel, textColor ? { color: textColor } : {}]}>{label}</Text>
      {value ? (
        <Text style={styles.settingsValue}>{value}</Text>
      ) : (
        <ChevronRight size={16} color={Colors.text.tertiary} />
      )}
    </TouchableOpacity>
  );
}

function SettingsToggle({
  label,
  desc,
  value,
  onToggle,
  isLast,
}: {
  label: string;
  desc?: string;
  value: boolean;
  onToggle: (v: boolean) => void;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.settingsItem, !isLast && styles.rowBorder]}>
      <View style={styles.toggleContent}>
        <Text style={styles.settingsLabel}>{label}</Text>
        {desc && <Text style={styles.toggleDesc}>{desc}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ true: Colors.primary, false: Colors.border }}
        thumbColor="#fff"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.surface },
  scroll: { flex: 1 },
  container: { paddingHorizontal: 18, paddingBottom: 40 },
  pageTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text.primary,
    paddingTop: 12,
    paddingBottom: 20,
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: Colors.primary, textTransform: 'uppercase', letterSpacing: 0.5 },

  card: {
    backgroundColor: Colors.background,
    borderRadius: 13,
    borderWidth: 0.5,
    borderColor: Colors.border,
    marginBottom: 24,
    overflow: 'hidden',
  },

  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userAvatarText: { fontSize: 20, fontWeight: '700', color: '#fff' },
  userInfo: {},
  userName: { fontSize: 16, fontWeight: '600', color: Colors.text.primary },
  userEmail: { fontSize: 13, color: Colors.text.secondary, marginTop: 2 },

  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  settingsIcon: { marginRight: 10 },
  settingsLabel: { flex: 1, fontSize: 15, color: Colors.text.primary },
  settingsValue: { fontSize: 13, color: Colors.text.secondary, marginRight: 4 },
  rowBorder: {
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  toggleContent: { flex: 1 },
  toggleDesc: { fontSize: 12, color: Colors.text.secondary, marginTop: 2 },

  providerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  providerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioOuterActive: { borderColor: Colors.primary },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
  },
  providerName: { fontSize: 15, fontWeight: '600', color: Colors.text.primary },
  providerModel: { fontSize: 12, color: Colors.text.secondary, marginTop: 1 },
  keyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.surface,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 0.5,
    borderColor: Colors.border,
  },
  keyBtnText: { fontSize: 12, color: Colors.text.secondary },

  version: {
    fontSize: 12,
    color: Colors.text.tertiary,
    textAlign: 'center',
    marginTop: 8,
  },

  // 模态框
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: 18,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: Colors.text.primary, marginBottom: 8 },
  hasKeyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#DCFCE7',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  hasKeyText: { fontSize: 13, color: Colors.success, fontWeight: '600' },
  modalHint: { fontSize: 13, color: Colors.text.secondary, marginBottom: 6, lineHeight: 20 },
  modalModel: { fontSize: 12, color: Colors.text.tertiary, marginBottom: 16 },
  keyInput: {
    borderWidth: 0.5,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: Colors.text.primary,
    backgroundColor: Colors.surface,
    marginBottom: 20,
    fontFamily: 'monospace',
  },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalCancelBtn: {
    flex: 1,
    borderWidth: 0.5,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalCancelText: { fontSize: 15, color: Colors.text.secondary },
  modalSaveBtn: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalSaveText: { fontSize: 15, fontWeight: '600', color: '#fff' },
});
