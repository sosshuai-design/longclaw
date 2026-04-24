import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, RouteProp, useNavigation } from '@react-navigation/native';
import {
  Link2,
  FileText,
  Image,
  Mic,
  Camera,
  BookOpen,
  Send,
  X,
  ChevronDown,
  Search,
} from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';

import { Colors, CategoryLabels } from '../constants/colors';
import { useChatStore } from '../store/chatStore';
import { useWikiStore } from '../store/wikiStore';
import { useSettingsStore } from '../store/settingsStore';
import {
  callLLMStream,
  buildIngestSystemPrompt,
  buildQuerySystemPrompt,
  parseWikiActions,
  stripWikiActions,
  extractWikiRefs,
  transcribeAudio,
  PROVIDERS,
} from '../services/llm';
import { readSchema, readIndex } from '../services/wiki';
import { ChatMessage, Attachment, MainTabParamList, WikiCategory, WikiSource, WikiPage } from '../types';

type RouteProps = RouteProp<MainTabParamList, 'Chat'>;

// ─── 消息气泡 ─────────────────────────────────────────────────────────────────

function MessageBubble({
  msg,
  onSaveToWiki,
  onWikiRefPress,
}: {
  msg: ChatMessage;
  onSaveToWiki?: (msg: ChatMessage) => void;
  onWikiRefPress?: (pageId: string, title: string) => void;
}) {
  const isUser = msg.role === 'user';

  return (
    <View style={[styles.msgRow, isUser && styles.msgRowUser]}>
      {!isUser && (
        <View style={styles.aiAvatar}>
          <Text style={styles.aiAvatarText}>AI</Text>
        </View>
      )}
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAi]}>
        {msg.attachments?.map((att) => (
          <View key={att.id} style={styles.attChip}>
            <Text style={styles.attChipText}>{att.name}</Text>
          </View>
        ))}
        <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>{msg.content}</Text>

        {/* Wiki 引用卡片 — 可点击跳转 */}
        {msg.wikiRefs && msg.wikiRefs.length > 0 && (
          <View style={styles.wikiRefs}>
            {msg.wikiRefs.map((ref) => (
              <TouchableOpacity
                key={ref.pageId}
                style={styles.wikiRefChip}
                onPress={() => onWikiRefPress?.(ref.pageId, ref.title)}
                activeOpacity={0.7}
              >
                <BookOpen size={12} color={Colors.primary} />
                <Text style={styles.wikiRefText}>{ref.title}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* 存入 Wiki 横幅 */}
        {msg.canSaveToWiki && onSaveToWiki && (
          <TouchableOpacity
            style={styles.saveToWikiBanner}
            onPress={() => onSaveToWiki(msg)}
          >
            <Text style={styles.saveToWikiText}>把这个回答存入 Wiki</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ─── Wiki 页面选择器 ──────────────────────────────────────────────────────────

function WikiPickerModal({
  visible,
  pages,
  onClose,
  onSelect,
}: {
  visible: boolean;
  pages: WikiPage[];
  onClose: () => void;
  onSelect: (page: WikiPage) => void;
}) {
  const [search, setSearch] = useState('');
  const filtered = search
    ? pages.filter((p) => p.title.toLowerCase().includes(search.toLowerCase()))
    : pages;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <View style={styles.pickerHeaderRow}>
            <Text style={styles.modalTitle}>引用 Wiki 页面</Text>
            <TouchableOpacity onPress={onClose}>
              <X size={20} color={Colors.text.secondary} />
            </TouchableOpacity>
          </View>
          <View style={styles.pickerSearchRow}>
            <Search size={14} color={Colors.text.tertiary} />
            <TextInput
              style={styles.pickerSearch}
              value={search}
              onChangeText={setSearch}
              placeholder="搜索页面…"
              placeholderTextColor={Colors.text.tertiary}
              autoFocus
            />
          </View>
          <FlatList
            data={filtered}
            keyExtractor={(p) => p.id}
            keyboardShouldPersistTaps="handled"
            style={{ maxHeight: 380 }}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.pickerItem} onPress={() => { onSelect(item); onClose(); }}>
                <View style={styles.pickerCatBadge}>
                  <Text style={styles.pickerCatText}>{CategoryLabels[item.category] ?? item.category}</Text>
                </View>
                <Text style={styles.pickerItemTitle} numberOfLines={1}>{item.title}</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <Text style={styles.pickerEmpty}>暂无匹配页面</Text>
            }
          />
        </View>
      </View>
    </Modal>
  );
}

// ─── 保存至 Wiki 模态框 ───────────────────────────────────────────────────────

function SaveToWikiModal({
  visible,
  onClose,
  onSave,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (title: string, category: WikiCategory) => void;
}) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<WikiCategory>('summary');

  const categories: { key: WikiCategory; label: string }[] = [
    { key: 'concept', label: '概念' },
    { key: 'summary', label: '摘要' },
    { key: 'architecture', label: '架构' },
    { key: 'comparison', label: '对比' },
    { key: 'tool', label: '工具' },
    { key: 'note', label: '笔记' },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>存入 Wiki</Text>

          <Text style={styles.modalLabel}>页面标题</Text>
          <TextInput
            style={styles.modalInput}
            value={title}
            onChangeText={setTitle}
            placeholder="为这段内容起个名字"
            placeholderTextColor={Colors.text.tertiary}
          />

          <Text style={styles.modalLabel}>分类</Text>
          <View style={styles.catGrid}>
            {categories.map((c) => (
              <TouchableOpacity
                key={c.key}
                style={[styles.catChip, category === c.key && styles.catChipActive]}
                onPress={() => setCategory(c.key)}
              >
                <Text style={[styles.catChipText, category === c.key && styles.catChipTextActive]}>
                  {c.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.modalCancelBtn} onPress={onClose}>
              <Text style={styles.modalCancelText}>取消</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalSaveBtn}
              onPress={() => {
                if (!title.trim()) {
                  Alert.alert('提示', '请填写标题');
                  return;
                }
                onSave(title.trim(), category);
                onClose();
              }}
            >
              <Text style={styles.modalSaveText}>存入</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── ChatScreen ───────────────────────────────────────────────────────────────

export default function ChatScreen() {
  const route = useRoute<RouteProps>();
  const rootNav = useNavigation<any>();
  const initialMode = route.params?.mode ?? 'ingest';

  const {
    mode,
    messages,
    isStreaming,
    pendingAttachments,
    setMode,
    addUserMessage,
    appendToLastAssistant,
    finalizeLastAssistant,
    setStreaming,
    addAttachment,
    removeAttachment,
  } = useChatStore();

  const { pages, addPage } = useWikiStore();
  const { activeProvider } = useSettingsStore();

  const pageTitle = route.params?.pageTitle;
  const pageId = route.params?.pageId;

  const [inputText, setInputText] = useState('');
  const [urlMode, setUrlMode] = useState(false);
  const [saveModalVisible, setSaveModalVisible] = useState(false);
  const [pendingSaveMsg, setPendingSaveMsg] = useState<ChatMessage | null>(null);
  const [wikiPickerVisible, setWikiPickerVisible] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);

  const flatListRef = useRef<FlatList>(null);
  const providerName = PROVIDERS[activeProvider]?.name ?? 'AI';

  // 初始化模式；若携带页面引用则切换到 Query 模式
  useEffect(() => {
    const targetMode = pageTitle ? 'query' : initialMode;
    if (targetMode !== mode) setMode(targetMode);
  }, [initialMode, pageTitle]);

  // 携带页面引用时，预填参考前缀
  useEffect(() => {
    if (pageTitle && pageId) {
      setInputText(`关于《${pageTitle}》，`);
    }
  }, [pageTitle, pageId]);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
  }, []);

  async function handleSend() {
    const text = inputText.trim();
    if (!text && pendingAttachments.length === 0) return;
    if (isStreaming) return;

    const userMsg = addUserMessage(text, pendingAttachments.length > 0 ? [...pendingAttachments] : undefined);
    setInputText('');
    setUrlMode(false);
    scrollToBottom();

    setStreaming(true);
    try {
      // 读取 schema 和 index
      const [schema, index] = await Promise.all([readSchema(), readIndex()]);

      let systemPrompt: string;
      if (mode === 'ingest') {
        systemPrompt = buildIngestSystemPrompt(schema, index);
      } else {
        // Query 模式：简单关键词匹配定位相关页面
        const keywords = text.toLowerCase().split(/\s+/);
        const relevant = pages.filter((p) =>
          keywords.some((kw) => p.title.toLowerCase().includes(kw) || p.content.toLowerCase().includes(kw))
        ).slice(0, 5);
        systemPrompt = buildQuerySystemPrompt(schema, index, relevant);
      }

      // 构建对话历史
      const history = messages.slice(-10).map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

      const msgList = [
        { role: 'system' as const, content: systemPrompt },
        ...history,
        { role: 'user' as const, content: buildUserContent(text, pendingAttachments) },
      ];

      let fullContent = '';

      await callLLMStream(
        activeProvider,
        msgList,
        (chunk) => {
          appendToLastAssistant(chunk);
          fullContent += chunk;
          scrollToBottom();
        },
        async (full) => {
          fullContent = full;
          const wikiActions = parseWikiActions(full);
          const cleanContent = stripWikiActions(full);
          const refs = extractWikiRefs(cleanContent);

          // 执行 wiki-actions
          if (wikiActions.length > 0 && mode === 'ingest') {
            for (const action of wikiActions) {
              await addPage({
                title: action.title,
                category: (action.category as WikiCategory) || 'summary',
                tags: action.tags ?? [],
                source: 'ingest',
                content: action.content,
              });
            }
          }

          const wikiRefs = refs
            .map((title) => {
              const found = pages.find((p) => p.title === title);
              return found ? { pageId: found.id, title: found.title, category: found.category } : null;
            })
            .filter(Boolean) as any[];

          finalizeLastAssistant(wikiRefs, mode === 'query');
          scrollToBottom();
        }
      );
    } catch (e: any) {
      appendToLastAssistant(`\n\n⚠️ 请求失败：${e.message}`);
      finalizeLastAssistant();
    } finally {
      setStreaming(false);
    }
  }

  function buildUserContent(text: string, attachments: Attachment[]): string {
    if (attachments.length === 0) return text;
    const attDesc = attachments
      .map((a) => {
        if (a.type === 'wikiRef' && a.text) {
          return `[Wiki页面《${a.name.replace('📖 ', '')}》：\n${a.text}]`;
        }
        return `[附件: ${a.name}${a.text ? ` 内容: ${a.text.slice(0, 500)}` : ''}]`;
      })
      .join('\n\n');
    return `${attDesc}\n\n${text}`;
  }

  async function handlePickDocument() {
    const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      addAttachment({
        id: `att_${Date.now()}`,
        type: 'pdf',
        name: asset.name,
        uri: asset.uri,
      });
    }
  }

  async function handlePickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images });
    if (!result.canceled && result.assets?.[0]) {
      addAttachment({
        id: `att_${Date.now()}`,
        type: 'image',
        name: '图片',
        uri: result.assets[0].uri,
      });
    }
  }

  function handleSaveToWiki(msg: ChatMessage) {
    setPendingSaveMsg(msg);
    setSaveModalVisible(true);
  }

  async function handleConfirmSave(title: string, category: WikiCategory) {
    if (!pendingSaveMsg) return;
    await addPage({
      title,
      category,
      tags: [],
      source: 'query' as WikiSource,
      content: pendingSaveMsg.content,
    });
    Alert.alert('已保存', `「${title}」已存入 Wiki`);
  }

  // Wiki 引用芯片点击 → 跳转到 WikiDetail
  function handleWikiRefPress(refPageId: string, title: string) {
    const found = pages.find((p) => p.filePath === refPageId || p.id === refPageId || p.title === title);
    if (found) {
      rootNav.navigate('Main', {
        screen: 'Wiki',
        params: { screen: 'WikiDetail', params: { pageId: found.filePath } },
      });
    } else {
      Alert.alert('页面不存在', `未找到「${title}」`);
    }
  }

  // Wiki 页面选择器：选择后将页面内容作为附件附到下一条消息
  function handleWikiPageSelect(page: WikiPage) {
    const body = page.content.replace(/^---[\s\S]*?---\n/, '').trim().slice(0, 800);
    addAttachment({
      id: `att_${Date.now()}`,
      type: 'wikiRef',
      name: `📖 ${page.title}`,
      wikiPageId: page.filePath,
      text: body,
    });
  }

  // ─── 语音录入 ────────────────────────────────────────────────────────────────

  async function handleMicPress() {
    if (isRecording) {
      await stopRecording();
    } else {
      await startRecording();
    }
  }

  async function startRecording() {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('需要麦克风权限', '请在系统设置中允许 WikiMind 使用麦克风');
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      setIsRecording(true);
    } catch (e: any) {
      Alert.alert('录音失败', e.message);
    }
  }

  async function stopRecording() {
    setIsRecording(false);
    const rec = recordingRef.current;
    recordingRef.current = null;
    if (!rec) return;

    try {
      await rec.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      const uri = rec.getURI();
      if (!uri) return;

      setIsTranscribing(true);
      try {
        const text = await transcribeAudio(uri);
        if (text) {
          setInputText((prev) => prev ? `${prev} ${text}` : text);
        }
      } catch (err: any) {
        // Whisper 不可用时退回附件
        addAttachment({ id: `att_${Date.now()}`, type: 'audio', name: '语音消息', uri });
        Alert.alert('语音识别提示', `转文字需要 OpenAI Key（${err.message}），已将录音作为附件附上`);
      } finally {
        setIsTranscribing(false);
      }
    } catch (e: any) {
      Alert.alert('录音处理失败', e.message);
    }
  }

  const modeLabel = mode === 'ingest' ? 'Ingest' : 'Query';
  const placeholder =
    mode === 'ingest'
      ? '粘贴链接、描述资料，或选择附件…'
      : '基于 Wiki 提问…';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior="padding"
        keyboardVerticalOffset={0}
      >
        {/* 顶部 */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>对话</Text>
            <Text style={styles.headerSub}>
              {modeLabel} · {providerName}
            </Text>
          </View>
          {/* 模式切换 */}
          <View style={styles.modeSwitch}>
            {(['ingest', 'query'] as const).map((m) => (
              <TouchableOpacity
                key={m}
                style={[styles.modeSwitchBtn, mode === m && styles.modeSwitchBtnActive]}
                onPress={() => setMode(m)}
              >
                <Text style={[styles.modeSwitchText, mode === m && styles.modeSwitchTextActive]}>
                  {m === 'ingest' ? 'Ingest' : 'Query'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Wiki 页面引用条 */}
        {pageTitle && (
          <View style={styles.pageRefBanner}>
            <BookOpen size={14} color={Colors.primary} />
            <Text style={styles.pageRefText} numberOfLines={1}>
              正在引用：{pageTitle}
            </Text>
          </View>
        )}

        {/* Ingest 提示条 */}
        {mode === 'ingest' && (
          <View style={styles.ingestBanner}>
            <Text style={styles.ingestBannerText}>导入后先与你讨论，再写入 Wiki</Text>
          </View>
        )}

        {/* 消息列表 */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => (
            <MessageBubble
              msg={item}
              onSaveToWiki={handleSaveToWiki}
              onWikiRefPress={handleWikiRefPress}
            />
          )}
          contentContainerStyle={styles.msgList}
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <Text style={styles.emptyChatText}>
                {mode === 'ingest'
                  ? '发送资料链接、文字或附件，开始 Ingest'
                  : '输入问题，AI 将基于你的 Wiki 回答'}
              </Text>
            </View>
          }
          onContentSizeChange={scrollToBottom}
        />

        {/* 附件预览 */}
        {pendingAttachments.length > 0 && (
          <View style={styles.attPreview}>
            {pendingAttachments.map((att) => (
              <View key={att.id} style={styles.attChipLarge}>
                <Text style={styles.attChipLargeText} numberOfLines={1}>{att.name}</Text>
                <TouchableOpacity onPress={() => removeAttachment(att.id)}>
                  <X size={14} color={Colors.text.secondary} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* URL 输入框 */}
        {urlMode && (
          <View style={styles.urlBar}>
            <TextInput
              style={styles.urlInput}
              placeholder="粘贴链接…"
              placeholderTextColor={Colors.text.tertiary}
              autoFocus
              onSubmitEditing={(e) => {
                const url = e.nativeEvent.text.trim();
                if (url) {
                  addAttachment({ id: `att_${Date.now()}`, type: 'url', name: url, uri: url });
                }
                setUrlMode(false);
              }}
            />
          </View>
        )}

        {/* 录音状态条 */}
        {(isRecording || isTranscribing) && (
          <View style={styles.recordingBar}>
            <ActivityIndicator size="small" color={Colors.error} />
            <Text style={styles.recordingText}>
              {isTranscribing ? '正在识别语音…' : '录音中，再按一次停止'}
            </Text>
          </View>
        )}

        {/* 工具栏 + 输入框 */}
        <View style={styles.inputArea}>
          <View style={styles.toolbar}>
            <TouchableOpacity style={styles.toolBtn} onPress={() => setUrlMode((v) => !v)}>
              <Link2 size={18} color={urlMode ? Colors.primary : Colors.text.secondary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.toolBtn} onPress={handlePickDocument}>
              <FileText size={18} color={Colors.text.secondary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.toolBtn} onPress={handlePickImage}>
              <Image size={18} color={Colors.text.secondary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.toolBtn,
                isRecording && { backgroundColor: '#FFECEC' },
                isTranscribing && { opacity: 0.6 },
              ]}
              onPress={handleMicPress}
              disabled={isTranscribing}
            >
              {isTranscribing ? (
                <ActivityIndicator size="small" color={Colors.error} />
              ) : (
                <Mic size={18} color={isRecording ? Colors.error : Colors.text.secondary} />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.toolBtn}
              onPress={() => Alert.alert('拍照识别', '即将上线')}
            >
              <Camera size={18} color={Colors.text.secondary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toolBtn, wikiPickerVisible && { backgroundColor: Colors.primaryLight }]}
              onPress={() => setWikiPickerVisible(true)}
            >
              <BookOpen size={18} color={wikiPickerVisible ? Colors.primary : Colors.text.secondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={inputText}
              onChangeText={setInputText}
              placeholder={placeholder}
              placeholderTextColor={Colors.text.tertiary}
              multiline
              maxLength={2000}
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!inputText.trim() && pendingAttachments.length === 0) && styles.sendBtnDisabled]}
              onPress={handleSend}
              disabled={isStreaming || (!inputText.trim() && pendingAttachments.length === 0)}
            >
              {isStreaming ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Send size={18} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      <SaveToWikiModal
        visible={saveModalVisible}
        onClose={() => setSaveModalVisible(false)}
        onSave={handleConfirmSave}
      />

      <WikiPickerModal
        visible={wikiPickerVisible}
        pages={pages}
        onClose={() => setWikiPickerVisible(false)}
        onSelect={handleWikiPageSelect}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.text.primary },
  headerSub: { fontSize: 12, color: Colors.text.secondary, marginTop: 2 },

  modeSwitch: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 3,
  },
  modeSwitchBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  modeSwitchBtnActive: { backgroundColor: Colors.primary },
  modeSwitchText: { fontSize: 13, fontWeight: '600', color: Colors.text.secondary },
  modeSwitchTextActive: { color: '#fff' },

  pageRefBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  pageRefText: {
    flex: 1,
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '500',
  },

  ingestBanner: {
    backgroundColor: Colors.ingestBanner,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  ingestBannerText: { fontSize: 13, color: Colors.ingestBannerText, fontWeight: '500' },

  msgList: { padding: 16, paddingBottom: 8 },

  msgRow: { flexDirection: 'row', marginBottom: 16, alignItems: 'flex-end' },
  msgRowUser: { justifyContent: 'flex-end' },
  aiAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.ai,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    marginBottom: 2,
  },
  aiAvatarText: { fontSize: 10, fontWeight: '700', color: '#fff' },

  bubble: {
    maxWidth: '80%',
    borderRadius: 16,
    padding: 12,
  },
  bubbleUser: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleAi: {
    backgroundColor: Colors.surface,
    borderBottomLeftRadius: 4,
    borderWidth: 0.5,
    borderColor: Colors.border,
  },
  bubbleText: { fontSize: 15, color: Colors.text.primary, lineHeight: 22 },
  bubbleTextUser: { color: '#fff' },

  attChip: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 6,
    alignSelf: 'flex-start',
  },
  attChipText: { fontSize: 12, color: '#fff' },

  wikiRefs: { marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  wikiRefChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryLight,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  wikiRefText: { fontSize: 12, color: Colors.primaryDark },

  saveToWikiBanner: {
    marginTop: 10,
    backgroundColor: Colors.ai,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  saveToWikiText: { fontSize: 13, fontWeight: '600', color: '#fff' },

  emptyChat: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    paddingHorizontal: 40,
  },
  emptyChatText: { fontSize: 14, color: Colors.text.secondary, textAlign: 'center', lineHeight: 22 },

  attPreview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 10,
    paddingTop: 0,
    gap: 8,
  },
  attChipLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryLight,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
    maxWidth: 200,
  },
  attChipLargeText: { fontSize: 13, color: Colors.primaryDark, flex: 1 },

  urlBar: {
    paddingHorizontal: 14,
    paddingBottom: 6,
  },
  urlInput: {
    borderWidth: 0.5,
    borderColor: Colors.primary,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.text.primary,
    backgroundColor: Colors.primaryLight,
  },

  inputArea: {
    borderTopWidth: 0.5,
    borderTopColor: Colors.border,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: Colors.background,
  },
  toolbar: {
    flexDirection: 'row',
    marginBottom: 8,
    gap: 4,
  },
  toolBtn: {
    width: 36,
    height: 36,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.surface,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: 0.5,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.text.primary,
    maxHeight: 120,
    backgroundColor: Colors.surface,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: { backgroundColor: Colors.text.tertiary },

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
  modalTitle: { fontSize: 18, fontWeight: '700', color: Colors.text.primary, marginBottom: 16 },
  modalLabel: { fontSize: 13, fontWeight: '600', color: Colors.text.secondary, marginBottom: 8 },
  modalInput: {
    borderWidth: 0.5,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.text.primary,
    backgroundColor: Colors.surface,
    marginBottom: 16,
  },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  catChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  catChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  catChipText: { fontSize: 13, color: Colors.text.secondary },
  catChipTextActive: { color: '#fff', fontWeight: '600' },
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
    backgroundColor: Colors.ai,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalSaveText: { fontSize: 15, fontWeight: '600', color: '#fff' },

  // 录音状态条
  recordingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFECEC',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 0.5,
    borderTopColor: '#FFCDD2',
  },
  recordingText: { fontSize: 13, color: Colors.error, fontWeight: '500' },

  // Wiki 选择器
  pickerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 12,
  },
  pickerSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: Colors.border,
    gap: 8,
  },
  pickerSearch: { flex: 1, fontSize: 14, color: Colors.text.primary },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    gap: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  pickerCatBadge: {
    backgroundColor: Colors.primaryLight,
    borderRadius: 5,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  pickerCatText: { fontSize: 11, fontWeight: '600', color: Colors.primary },
  pickerItemTitle: { flex: 1, fontSize: 14, color: Colors.text.primary },
  pickerEmpty: {
    textAlign: 'center',
    color: Colors.text.tertiary,
    paddingVertical: 32,
    fontSize: 14,
  },
});
