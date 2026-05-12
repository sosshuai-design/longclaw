import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Modal,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackNavigationProp, RouteProp } from '@react-navigation/stack';
import { ArrowLeft, Check, Link2, X } from 'lucide-react-native';
import { Colors, CategoryLabels } from '../../constants/colors';
import { useWikiStore } from '../../store/wikiStore';
import { WikiStackParamList, WikiCategory, WikiPage } from '../../types';

type Props = {
  navigation: StackNavigationProp<WikiStackParamList, 'WikiEdit'>;
  route: RouteProp<WikiStackParamList, 'WikiEdit'>;
};

const CATEGORIES: { key: WikiCategory; label: string }[] = [
  { key: 'concept', label: '概念' },
  { key: 'note', label: '笔记' },
  { key: 'diary', label: '日记' },
  { key: 'tool', label: '工具' },
];

export default function WikiEditScreen({ navigation, route }: Props) {
  const { pageId } = route.params;
  const { pages, editPage, addPage } = useWikiStore();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<WikiCategory>('note');
  const [tagsText, setTagsText] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [cursorPos, setCursorPos] = useState(0);
  const [linkQuery, setLinkQuery] = useState<string | null>(null);

  useEffect(() => {
    const page = pages.find((p) => p.filePath === pageId || p.id === pageId);
    if (page) {
      setTitle(page.title);
      setCategory(page.category);
      setTagsText(page.tags.join(', '));
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
      const tags = tagsText.split(',').map((t) => t.trim()).filter(Boolean);
      await editPage(pageId, { title: title.trim(), category, tags, content });
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('保存失败', e.message);
    } finally {
      setLoading(false);
    }
  }

  function handleContentChange(text: string) {
    setContent(text);
    // Detect [[ trigger for auto-suggest
    const textUpToCursor = text.slice(0, cursorPos + (text.length - content.length));
    const match = textUpToCursor.match(/\[\[([^\]]*)$/);
    setLinkQuery(match ? match[1] : null);
  }

  function insertWikiLink(pageTitle: string) {
    const link = `[[${pageTitle}]]`;
    const before = content.slice(0, cursorPos);
    const after = content.slice(cursorPos);
    const newContent = before + link + after;
    setContent(newContent);
    setCursorPos(cursorPos + link.length);
    setPickerVisible(false);
    setPickerSearch('');
  }

  function insertSuggestion(pageTitle: string) {
    // Replace the partial [[query with [[Title]]
    const triggerIdx = content.slice(0, cursorPos).lastIndexOf('[[');
    if (triggerIdx === -1) return;
    const before = content.slice(0, triggerIdx);
    const after = content.slice(cursorPos);
    const inserted = `[[${pageTitle}]]`;
    setContent(before + inserted + after);
    setCursorPos(triggerIdx + inserted.length);
    setLinkQuery(null);
  }

  async function createStubAndInsert(stubTitle: string) {
    try {
      await addPage({ title: stubTitle, category: 'note', tags: [], source: 'manual', content: '' });
      insertSuggestion(stubTitle);
    } catch (e: any) {
      Alert.alert('创建失败', e.message);
    }
  }

  const otherPages = pages.filter((p) => p.filePath !== pageId && p.id !== pageId);
  const suggestions =
    linkQuery !== null
      ? otherPages.filter((p) =>
          linkQuery === '' || p.title.toLowerCase().includes(linkQuery.toLowerCase())
        ).slice(0, 8)
      : [];

  const showStubCreate =
    linkQuery !== null &&
    linkQuery.trim().length > 0 &&
    !pages.some((p) => p.title === linkQuery.trim());

  const filteredPages = pickerSearch
    ? otherPages.filter((p) =>
        p.title.toLowerCase().includes(pickerSearch.toLowerCase())
      )
    : otherPages;

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
        <View style={styles.contentLabelRow}>
          <Text style={styles.label}>正文（Markdown）</Text>
          <TouchableOpacity
            style={styles.linkPickerBtn}
            onPress={() => setPickerVisible(true)}
          >
            <Link2 size={13} color={Colors.primary} />
            <Text style={styles.linkPickerBtnText}>插入 [[链接]]</Text>
          </TouchableOpacity>
        </View>
        {/* [[链接]] 自动提示条 */}
        {(suggestions.length > 0 || showStubCreate) && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            style={styles.suggestRow}
            contentContainerStyle={{ gap: 8, paddingHorizontal: 4, paddingVertical: 4 }}
          >
            {suggestions.map((p) => (
              <TouchableOpacity
                key={p.id}
                style={styles.suggestChip}
                onPress={() => insertSuggestion(p.title)}
              >
                <Text style={styles.suggestChipText}>{p.title}</Text>
              </TouchableOpacity>
            ))}
            {showStubCreate && (
              <TouchableOpacity
                style={styles.stubChip}
                onPress={() => createStubAndInsert(linkQuery!.trim())}
              >
                <Text style={styles.stubChipText}>+ 新建《{linkQuery!.trim()}》</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        )}

        <TextInput
          style={[styles.input, styles.contentInput]}
          value={content}
          onChangeText={handleContentChange}
          onSelectionChange={(e) => setCursorPos(e.nativeEvent.selection.start)}
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

      {/* [[链接]] 选择器 Modal */}
      <Modal
        visible={pickerVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setPickerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>选择页面链接</Text>
              <TouchableOpacity onPress={() => { setPickerVisible(false); setPickerSearch(''); }}>
                <X size={20} color={Colors.text.secondary} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.modalSearch}
              value={pickerSearch}
              onChangeText={setPickerSearch}
              placeholder="搜索页面…"
              placeholderTextColor={Colors.text.tertiary}
              autoFocus
            />
            <FlatList
              data={filteredPages}
              keyExtractor={(p) => p.id}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.pickerItem}
                  onPress={() => insertWikiLink(item.title)}
                >
                  <View style={styles.pickerItemCat}>
                    <Text style={styles.pickerCatText}>
                      {CategoryLabels[item.category] ?? item.category}
                    </Text>
                  </View>
                  <Text style={styles.pickerItemTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.pickerEmpty}>暂无其他页面</Text>
              }
            />
          </View>
        </View>
      </Modal>
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

  contentLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
    marginBottom: 8,
  },
  linkPickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  linkPickerBtnText: { fontSize: 12, fontWeight: '600', color: Colors.primary },

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

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingBottom: 32,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: Colors.text.primary },
  modalSearch: {
    margin: 14,
    borderWidth: 0.5,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.text.primary,
    backgroundColor: Colors.surface,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    gap: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  pickerItemCat: {
    backgroundColor: Colors.primaryLight,
    borderRadius: 5,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  pickerCatText: { fontSize: 11, fontWeight: '600', color: Colors.primary },
  pickerItemTitle: { flex: 1, fontSize: 15, color: Colors.text.primary },
  pickerEmpty: {
    textAlign: 'center',
    color: Colors.text.tertiary,
    paddingVertical: 32,
    fontSize: 14,
  },

  // [[ 自动提示
  suggestRow: {
    marginBottom: 6,
    backgroundColor: Colors.primaryLight,
    borderRadius: 8,
    maxHeight: 44,
  },
  suggestChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.primary,
    borderRadius: 6,
  },
  suggestChipText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  stubChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
  },
  stubChipText: { fontSize: 13, fontWeight: '600', color: Colors.primary },
});
