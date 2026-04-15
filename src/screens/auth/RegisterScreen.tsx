import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { ArrowLeft } from 'lucide-react-native';
import { AuthStackParamList } from '../../types';
import { Colors } from '../../constants/colors';
import { registerWithEmail } from '../../services/auth';
import { useAuthStore } from '../../store/authStore';

type Props = {
  navigation: StackNavigationProp<AuthStackParamList, 'Register'>;
};

export default function RegisterScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuthStore();

  async function handleRegister() {
    if (!agreed) {
      Alert.alert('提示', '请先同意用户条款');
      return;
    }
    setLoading(true);
    try {
      const { token, user } = await registerWithEmail({ email, username, password, confirmPassword });
      setAuth(token, user);
    } catch (e: any) {
      Alert.alert('注册失败', e.message ?? '请检查填写内容');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          {/* 顶部导航 */}
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <ArrowLeft size={22} color={Colors.text.primary} />
          </TouchableOpacity>

          <Text style={styles.title}>创建账号</Text>
          <Text style={styles.subtitle}>开始构建你的个人知识库</Text>

          {/* 表单 */}
          <View style={styles.form}>
            {[
              { label: '用户名', value: username, setter: setUsername, placeholder: '2 个字符以上', keyboardType: 'default' as const, secure: false },
              { label: '邮箱', value: email, setter: setEmail, placeholder: 'your@email.com', keyboardType: 'email-address' as const, secure: false },
              { label: '密码', value: password, setter: setPassword, placeholder: '至少 8 位', keyboardType: 'default' as const, secure: true },
              { label: '确认密码', value: confirmPassword, setter: setConfirmPassword, placeholder: '再次输入密码', keyboardType: 'default' as const, secure: true },
            ].map((field) => (
              <View key={field.label}>
                <Text style={styles.label}>{field.label}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={field.placeholder}
                  placeholderTextColor={Colors.text.tertiary}
                  value={field.value}
                  onChangeText={field.setter}
                  keyboardType={field.keyboardType}
                  autoCapitalize="none"
                  secureTextEntry={field.secure}
                />
              </View>
            ))}
          </View>

          {/* 条款同意 */}
          <TouchableOpacity
            style={styles.agreeRow}
            onPress={() => setAgreed((v) => !v)}
            activeOpacity={0.8}
          >
            <View style={[styles.checkbox, agreed && styles.checkboxChecked]}>
              {agreed && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.agreeText}>
              我已阅读并同意{' '}
              <Text style={styles.agreeLink}>用户服务条款</Text>
            </Text>
          </TouchableOpacity>

          {/* 注册按钮 */}
          <TouchableOpacity
            style={[styles.registerBtn, loading && styles.registerBtnDisabled]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.registerBtnText}>注册</Text>
            )}
          </TouchableOpacity>

          {/* 已有账号 */}
          <View style={styles.loginRow}>
            <Text style={styles.loginText}>已有账号？</Text>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text style={styles.loginLink}>直接登录</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  container: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: 16,
    paddingBottom: 32,
  },
  backBtn: { padding: 4, marginBottom: 24, alignSelf: 'flex-start' },
  title: { fontSize: 26, fontWeight: '700', color: Colors.text.primary, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: Colors.text.secondary, marginTop: 6, marginBottom: 8 },

  form: {},
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.secondary,
    marginBottom: 6,
    marginTop: 18,
  },
  input: {
    borderWidth: 0.5,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: Colors.text.primary,
    backgroundColor: Colors.surface,
  },

  agreeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 4,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: Colors.border,
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  checkmark: { fontSize: 12, color: '#fff', fontWeight: '700' },
  agreeText: { fontSize: 14, color: Colors.text.secondary, flex: 1 },
  agreeLink: { color: Colors.primary },

  registerBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 24,
  },
  registerBtnDisabled: { opacity: 0.6 },
  registerBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },

  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 28,
  },
  loginText: { fontSize: 14, color: Colors.text.secondary },
  loginLink: { fontSize: 14, color: Colors.primary, fontWeight: '600', marginLeft: 4 },
});
