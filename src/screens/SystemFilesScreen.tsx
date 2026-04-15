import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft, Eye, Edit2, RefreshCw, Upload, Trash2 } from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Colors, CategoryLabels } from '../constants/colors';
import {
  readIndex,
  readLog,
  readSchema,
  writeSchema,
  listRawFiles,
  listRawFilesDetailed,
  uploadRawFile,
  deleteRawFile,
  rebuildIndex,
  RawFileInfo,
} from '../services/wiki';
import { useWikiStore } from '../store/wikiStore';

// ─── Schema 编辑模态框 ────────────────────────────────────────────────────────

function SchemaEditor({
  visible,
  initialContent,
  onClose,
  onSave,
}: {
  visible: boolean;
  initialContent: string;
  onClose: () => void;
  onSave: (content: string) => Promise<void>;
}) {
  const [content, setContent] = useState(initialContent);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) setContent(initialContent);
  }, [visible, initialContent]);

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(content);
      onClose();
    } catch (e: any) {
      Alert.alert('保存失败', e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={editorStyles.safe} edges={['top', 'bottom']}>
        <View style={editorStyles.header}>
          <TouchableOpacity onPress={onClose} style={editorStyles.cancelBtn}>
            <Text style={editorStyles.cancelText}>取消</Text>
          </TouchableOpacity>
          <Text style={editorStyles.title}>编辑 WIKI_SCHEMA.md</Text>
          <TouchableOpacity
            onPress={handleSave}
            style={editorStyles.saveBtn}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={editorStyles.saveText}>保存</Text>
            )}
          </TouchableOpacity>
        </View>
        <TextInput
          style={editorStyles.editor}
          value={content}
          onChangeText={setContent}
          multiline
          autoCapitalize="none"
          autoCorrect={false}
          scrollEnabled
          textAlignVertical="top"
        />
      </SafeAreaView>
    </Modal>
  );
}

const editorStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  title: { fontSize: 16, fontWeight: '700', color: Colors.text.primary },
  cancelBtn: { padding: 4 },
  cancelText: { fontSize: 15, color: Colors.text.secondary },
  saveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  saveText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  editor: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
    fontSize: 13,
    color: Colors.text.primary,
    fontFamily: 'monospace',
    lineHeight: 20,
  },
});

// ─── 文本查看器 Modal ─────────────────────────────────────────────────────────

function FileViewer({
  visible,
  title,
  content,
  onClose,
}: {
  visible: boolean;
  title: string;
  content: string;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={viewerStyles.safe} edges={['top', 'bottom']}>
        <View style={viewerStyles.header}>
          <TouchableOpacity onPress={onClose}>
            <ArrowLeft size={22} color={Colors.text.primary} />
          </TouchableOpacity>
          <Text style={viewerStyles.title}>{title}</Text>
          <View style={{ width: 22 }} />
        </View>
        <ScrollView
          style={viewerStyles.scroll}
          contentContainerStyle={viewerStyles.content}
          showsVerticalScrollIndicator={false}
        >
          <Text style={viewerStyles.text}>{content}</Text>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const viewerStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  title: { fontSize: 16, fontWeight: '700', color: Colors.text.primary },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  text: {
    fontSize: 13,
    color: Colors.text.primary,
    fontFamily: 'monospace',
    lineHeight: 20,
  },
});

// ─── SystemFilesScreen ────────────────────────────────────────────────────────

type RawSection = 'articles' | 'pdfs' | 'audio' | 'assets';

export default function SystemFilesScreen() {
  const navigation = useNavigation();
  const { pages, loadPages, isLoading } = useWikiStore();

  const [indexContent, setIndexContent] = useState('');
  const [logContent, setLogContent] = useState('');
  const [schemaContent, setSchemaContent] = useState('');
  const [rawFiles, setRawFiles] = useState<Record<RawSection, RawFileInfo[]>>({
    articles: [],
    pdfs: [],
    audio: [],
    assets: [],
  });

  const [loading, setLoading] = useState(true);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerTitle, setViewerTitle] = useState('');
  const [viewerContent, setViewerContent] = useState('');
  const [schemaEditorVisible, setSchemaEditorVisible] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [idx, log, schema, articles, pdfs, audio, assets] = await Promise.all([
        readIndex(),
        readLog(),
        readSchema(),
        listRawFilesDetailed('articles'),
        listRawFilesDetailed('pdfs'),
        listRawFilesDetailed('audio'),
        listRawFilesDetailed('assets'),
      ]);
      setIndexContent(idx);
      setLogContent(log);
      setSchemaContent(schema);
      setRawFiles({ articles, pdfs, audio, assets });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openViewer(title: string, content: string) {
    setViewerTitle(title);
    setViewerContent(content);
    setViewerVisible(true);
  }

  async function handleSaveSchema(content: string) {
    await writeSchema(content);
    setSchemaContent(content);
  }

  async function handleUploadRaw(category: RawSection) {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const filename = asset.name;
      await uploadRawFile(asset.uri, category, filename);
      // 刷新该分类的文件列表
      const updated = await listRawFilesDetailed(category);
      setRawFiles((prev) => ({ ...prev, [category]: updated }));
      Alert.alert('上传成功', `${filename} 已添加到 ${category}`);
    } catch (e: any) {
      Alert.alert('上传失败', e.message);
    }
  }

  async function handleDeleteRaw(file: RawFileInfo) {
    Alert.alert('删除文件', `确定删除「${file.name}」吗？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          await deleteRawFile(file.absolutePath);
          const updated = await listRawFilesDetailed(file.category);
          setRawFiles((prev) => ({ ...prev, [file.category]: updated }));
        },
      },
    ]);
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  async function handleRebuildIndex() {
    Alert.alert('重建索引', '将根据当前所有 Wiki 页面重建 index.md，确认吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '重建',
        onPress: async () => {
          await rebuildIndex(pages);
          const idx = await readIndex();
          setIndexContent(idx);
          Alert.alert('完成', 'index.md 已重建');
        },
      },
    ]);
  }

  // 解析 index.md 为分组列表（用于展示）
  function parseIndexGroups(content: string): { category: string; entries: string[] }[] {
    const groups: { category: string; entries: string[] }[] = [];
    let current: { category: string; entries: string[] } | null = null;

    for (const line of content.split('\n')) {
      if (line.startsWith('## ')) {
        if (current) groups.push(current);
        current = { category: line.slice(3).trim(), entries: [] };
      } else if (line.startsWith('- [[') && current) {
        current.entries.push(line.trim());
      }
    }
    if (current) groups.push(current);
    return groups.filter((g) => g.entries.length > 0);
  }

  // 解析 log.md 最近 N 条
  function parseRecentLogs(content: string, n = 10): string[] {
    const lines = content.split('\n').filter((l) => l.startsWith('## ['));
    return lines.slice(-n).reverse();
  }

  const indexGroups = parseIndexGroups(indexContent);
  const recentLogs = parseRecentLogs(logContent, 8);

  const RAW_SECTIONS: { key: RawSection; label: string; icon: string }[] = [
    { key: 'articles', label: '文章', icon: '📄' },
    { key: 'pdfs', label: 'PDF', icon: '📑' },
    { key: 'audio', label: '录音', icon: '🎙️' },
    { key: 'assets', label: '附件', icon: '🖼️' },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <ArrowLeft size={22} color={Colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>系统文件</Text>
        <TouchableOpacity onPress={load}>
          <RefreshCw size={18} color={Colors.text.secondary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={load} tintColor={Colors.primary} />}
        >
          {/* ── index.md ── */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>index.md</Text>
              <View style={styles.sectionActions}>
                <TouchableOpacity
                  style={styles.iconBtn}
                  onPress={() => openViewer('index.md', indexContent)}
                >
                  <Eye size={16} color={Colors.text.secondary} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconBtn} onPress={handleRebuildIndex}>
                  <RefreshCw size={16} color={Colors.primary} />
                </TouchableOpacity>
              </View>
            </View>
            <Text style={styles.sectionHint}>全局内容目录 · {pages.length} 个页面</Text>
            <View style={styles.card}>
              {indexGroups.length === 0 ? (
                <Text style={styles.emptyText}>暂无内容</Text>
              ) : (
                indexGroups.map((g) => (
                  <View key={g.category} style={styles.indexGroup}>
                    <Text style={styles.indexGroupTitle}>{g.category}</Text>
                    {g.entries.slice(0, 4).map((e, i) => (
                      <Text key={i} style={styles.indexEntry} numberOfLines={1}>{e}</Text>
                    ))}
                    {g.entries.length > 4 && (
                      <Text style={styles.indexMore}>还有 {g.entries.length - 4} 条…</Text>
                    )}
                  </View>
                ))
              )}
            </View>
          </View>

          {/* ── log.md ── */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>log.md</Text>
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => openViewer('log.md（操作日志）', logContent)}
              >
                <Eye size={16} color={Colors.text.secondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.sectionHint}>只增不改的操作日志</Text>
            <View style={styles.card}>
              {recentLogs.length === 0 ? (
                <Text style={styles.emptyText}>暂无日志记录</Text>
              ) : (
                recentLogs.map((line, i) => {
                  // 解析 ## [2026-04-14] type | title
                  const match = line.match(/## \[(\d{4}-\d{2}-\d{2})\] (\w+) \| (.+)/);
                  const date = match?.[1] ?? '';
                  const type = match?.[2] ?? '';
                  const title = match?.[3] ?? line;
                  const typeColor: Record<string, string> = {
                    ingest: Colors.success,
                    query: Colors.primary,
                    lint: Colors.lint.explore,
                    manual: Colors.user,
                  };
                  return (
                    <View
                      key={i}
                      style={[styles.logRow, i < recentLogs.length - 1 && styles.rowBorder]}
                    >
                      <View style={[styles.logTypeBadge, { backgroundColor: (typeColor[type] ?? Colors.text.tertiary) + '22' }]}>
                        <Text style={[styles.logTypeText, { color: typeColor[type] ?? Colors.text.tertiary }]}>
                          {type}
                        </Text>
                      </View>
                      <View style={styles.logContent}>
                        <Text style={styles.logTitle} numberOfLines={1}>{title}</Text>
                        <Text style={styles.logDate}>{date}</Text>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          </View>

          {/* ── WIKI_SCHEMA.md ── */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>WIKI_SCHEMA.md</Text>
              <View style={styles.sectionActions}>
                <TouchableOpacity
                  style={styles.iconBtn}
                  onPress={() => openViewer('WIKI_SCHEMA.md', schemaContent)}
                >
                  <Eye size={16} color={Colors.text.secondary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.iconBtn, styles.editIconBtn]}
                  onPress={() => setSchemaEditorVisible(true)}
                >
                  <Edit2 size={16} color={Colors.primary} />
                </TouchableOpacity>
              </View>
            </View>
            <Text style={styles.sectionHint}>规则文件 · AI 每次操作前都会读取</Text>
            <View style={styles.card}>
              <Text style={styles.schemaPreview} numberOfLines={8}>
                {schemaContent}
              </Text>
              <TouchableOpacity
                style={styles.editSchemaBtn}
                onPress={() => setSchemaEditorVisible(true)}
              >
                <Edit2 size={14} color={Colors.primary} />
                <Text style={styles.editSchemaBtnText}>编辑 Schema（与 AI 协作修改）</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ── 原始资料 ── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>原始资料</Text>
            <Text style={styles.sectionHint}>raw/ 目录 · AI Ingest 时读取</Text>

            <View style={styles.card}>
              {RAW_SECTIONS.map((sec, i) => {
                const files = rawFiles[sec.key];
                return (
                  <View key={sec.key} style={[styles.rawSection, i < RAW_SECTIONS.length - 1 && styles.rowBorder]}>
                    {/* 分类标题行 */}
                    <View style={styles.rawSectionHeader}>
                      <Text style={styles.rawSectionIcon}>{sec.icon}</Text>
                      <Text style={styles.rawSectionLabel}>{sec.label}</Text>
                      <View style={styles.rawCountBadge}>
                        <Text style={styles.rawCountText}>{files.length}</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.uploadBtn}
                        onPress={() => handleUploadRaw(sec.key)}
                      >
                        <Upload size={13} color={Colors.primary} />
                        <Text style={styles.uploadBtnText}>上传</Text>
                      </TouchableOpacity>
                    </View>

                    {/* 文件列表 */}
                    {files.length > 0 ? (
                      <View style={styles.rawFileList}>
                        {files.map((f) => (
                          <View key={f.absolutePath} style={styles.rawFileRow}>
                            <Text style={styles.rawFileName} numberOfLines={1}>{f.name}</Text>
                            <Text style={styles.rawFileSize}>{formatFileSize(f.size)}</Text>
                            <TouchableOpacity
                              onPress={() => handleDeleteRaw(f)}
                              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                            >
                              <Trash2 size={13} color={Colors.lint.conflict} />
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <Text style={styles.rawEmpty}>暂无文件 · 点击「上传」添加</Text>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        </ScrollView>
      )}

      {/* 查看器 */}
      <FileViewer
        visible={viewerVisible}
        title={viewerTitle}
        content={viewerContent}
        onClose={() => setViewerVisible(false)}
      />

      {/* Schema 编辑器 */}
      <SchemaEditor
        visible={schemaEditorVisible}
        initialContent={schemaContent}
        onClose={() => setSchemaEditorVisible(false)}
        onSave={handleSaveSchema}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  title: { fontSize: 18, fontWeight: '700', color: Colors.text.primary },

  loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 48 },

  section: { marginBottom: 28 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  sectionActions: { flexDirection: 'row', gap: 6 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.text.primary },
  sectionHint: { fontSize: 12, color: Colors.text.secondary, marginBottom: 10 },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.surface,
    borderWidth: 0.5,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editIconBtn: { borderColor: Colors.primary + '66' },

  card: {
    backgroundColor: Colors.background,
    borderRadius: 13,
    borderWidth: 0.5,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  rowBorder: { borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  emptyText: { padding: 16, fontSize: 13, color: Colors.text.tertiary },

  // index.md
  indexGroup: { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  indexGroupTitle: { fontSize: 13, fontWeight: '700', color: Colors.primary, marginBottom: 6 },
  indexEntry: { fontSize: 12, color: Colors.text.secondary, lineHeight: 20 },
  indexMore: { fontSize: 11, color: Colors.text.tertiary, marginTop: 2 },

  // log.md
  logRow: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 },
  logTypeBadge: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  logTypeText: { fontSize: 11, fontWeight: '700' },
  logContent: { flex: 1 },
  logTitle: { fontSize: 13, fontWeight: '500', color: Colors.text.primary },
  logDate: { fontSize: 11, color: Colors.text.tertiary, marginTop: 2 },

  // schema
  schemaPreview: {
    padding: 14,
    fontSize: 12,
    color: Colors.text.secondary,
    fontFamily: 'monospace',
    lineHeight: 19,
  },
  editSchemaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 12,
    borderTopWidth: 0.5,
    borderTopColor: Colors.border,
    backgroundColor: Colors.primaryLight,
  },
  editSchemaBtnText: { fontSize: 13, color: Colors.primary, fontWeight: '600' },

  // raw
  rawSection: { padding: 14 },
  rawSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  rawSectionIcon: { fontSize: 16 },
  rawSectionLabel: { fontSize: 14, fontWeight: '600', color: Colors.text.primary, flex: 1 },
  rawCountBadge: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  rawCountText: { fontSize: 12, color: Colors.text.secondary },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primaryLight,
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  uploadBtnText: { fontSize: 12, color: Colors.primary, fontWeight: '600' },
  rawFileList: { gap: 2 },
  rawFileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    gap: 8,
  },
  rawFileName: {
    flex: 1,
    fontSize: 13,
    color: Colors.text.secondary,
  },
  rawFileSize: { fontSize: 11, color: Colors.text.tertiary },
  rawEmpty: { fontSize: 12, color: Colors.text.tertiary, paddingTop: 2 },
});
