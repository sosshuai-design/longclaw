import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackNavigationProp, RouteProp } from '@react-navigation/stack';
import { ArrowLeft, Check } from 'lucide-react-native';
import { Colors } from '../../constants/colors';
import { useWikiStore } from '../../store/wikiStore';
import { WikiStackParamList, WikiCategory } from '../../types';

type Props = {
  navigation: StackNavigationProp<WikiStackParamList, 'WikiEdit'>;
  route: RouteProp<WikiStackParamList, 'WikiEdit'>;
};

const CATEGORIES: { key: WikiCategory; label: string }[] = [
  { key: 'concept', label: '概念' },
  { key: 'architecture', label: '架构' },
  { key: 'comparison', label: '对比' },
  { key: 'summary', label: '摘要' },
  { key: 'diary', label: '日记' },
  { key: 'note', label: '笔记' },
  { key: 'cognition', label: '认知' },
  { key: 'tool', label: '工具' },
];

export default function WikiEditScreen({ navigation, route }: Props) {
  const { pageId } = route.params;
  const { pages, editPage } = useWikiStore();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<WikiCategory>('note');
  const [tagsText, setTagsText] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const page = pages.find((p) => p.filePath === pageId || p.id === pageId);
    if (page) {
      setTitle(page.title);
      setCategory(page.category);
      setTagsText(page.tags.join(', '));
      // Strip YAML front matter — show only the body
      const body = page.content.replace(/^---[\s\S]*?---\n/, '').trim();
      setContent(body);
      setInitialized(true);
    }
  }, [pageId, pages]);

  async function handleSave() {
    if (!title.trim()) {
      Alert.alert('提示', '标题不能为空');
      return;
    }
    setLoading(true);
    try {
      const tags = tagsText
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      await editPage(pageId, { title: title.trim(), category, tags, content });
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('保存失败', e.message);
    } finally {
      setLoading(false);
    }
  }

  if (!initialized) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.loadingView}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* 顶栏 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={22} color={Colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>编辑页面</Text>
        <TouchableOpacity
          style={[styles.saveBtn, loading && { opacity: 0.5 }]}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Check size={18} color="#fff" />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* 标题 */}
        <Text style={styles.label}>标题</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="页面标题"
          placeholderTextColor={Colors.text.tertiary}
        />

        {/* 分类 */}
        <Text style={styles.label}>分类</Text>
        <View style={styles.chipRow}>
          {CATEGORIES.map((c) => (
            <TouchableOpacity
              key={c.key}
              style={[styles.chip, category === c.key && styles.chipActive]}
              onPress={() => setCategory(c.key)}
            >
              <Text style={[styles.chipText, category === c.key && styles.chipTextActive]}>
                {c.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 标签 */}
        <Text style={styles.label}>标签（逗号分隔）</Text>
        <TextInput
          style={styles.input}
          value={tagsText}
          onChangeText={setTagsText}
          placeholder="标签1, 标签2"
          placeholderTextColor={Colors.text.tertiary}
        />

        {/* 正文 */}
        <Text style={styles.label}>正文（Markdown）</Text>
        <TextInput
          style={[styles.input, styles.contentInput]}
          value={content}
          onChangeText={setContent}
          placeholder="支持 Markdown，用 [[页面标题]] 创建内部链接"
          placeholderTextColor={Colors.text.tertiary}
          multiline
          textAlignVertical="top"
        />

        <TouchableOpacity
          style={[styles.saveFullBtn, loading && { opacity: 0.5 }]}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.saveFullBtnText}>保存修改</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  loadingView: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  backBtn: { padding: 4 },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text.primary,
    marginLeft: 10,
  },
  saveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },

  scroll: { flex: 1 },
  container: { padding: 20, paddingBottom: 48 },

  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.secondary,
    marginTop: 20,
    marginBottom: 8,
  },
  input: {
    borderWidth: 0.5,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.text.primary,
    backgroundColor: Colors.surface,
  },
  contentInput: {
    minHeight: 320,
    fontFamily: 'monospace',
    fontSize: 14,
    lineHeight: 22,
  },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 13, color: Colors.text.secondary },
  chipTextActive: { color: '#fff', fontWeight: '600' },

  saveFullBtn: {
    marginTop: 28,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  saveFullBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
});
