import React, { useState } from 'react';
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
import { ArrowLeft, Sparkles } from 'lucide-react-native';
import { Colors } from '../../constants/colors';
import { useWikiStore } from '../../store/wikiStore';
import { useSettingsStore } from '../../store/settingsStore';
import { callLLM } from '../../services/llm';
import { WikiStackParamList, WikiCategory } from '../../types';

type Props = {
  navigation: StackNavigationProp<WikiStackParamList, 'WikiNew'>;
  route: RouteProp<WikiStackParamList, 'WikiNew'>;
};

// ─── 快速笔记 ─────────────────────────────────────────────────────────────────

function NoteForm({
  onSave,
  onSaveWithAI,
  aiLoading,
}: {
  onSave: (d: any) => void;
  onSaveWithAI: (d: any) => void;
  aiLoading?: boolean;
}) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');

  return (
    <View style={styles.form}>
      <Text style={styles.fieldLabel}>标题（可选）</Text>
      <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="为笔记起个标题" placeholderTextColor={Colors.text.tertiary} />

      <Text style={styles.fieldLabel}>内容</Text>
      <TextInput
        style={[styles.input, styles.inputMulti]}
        value={content}
        onChangeText={setContent}
        placeholder="记下你的想法…"
        placeholderTextColor={Colors.text.tertiary}
        multiline
      />

      <Text style={styles.fieldLabel}>标签（逗号分隔）</Text>
      <TextInput style={styles.input} value={tags} onChangeText={setTags} placeholder="标签1, 标签2" placeholderTextColor={Colors.text.tertiary} />

      <View style={styles.btnRow}>
        <TouchableOpacity
          style={[styles.aiSaveBtn, aiLoading && { opacity: 0.5 }]}
          onPress={() => onSaveWithAI({ title, content, tags })}
          disabled={aiLoading}
        >
          {aiLoading ? (
            <ActivityIndicator size="small" color={Colors.ai} />
          ) : (
            <>
              <Sparkles size={14} color={Colors.ai} />
              <Text style={styles.aiSaveBtnText}>AI 整理后存入</Text>
            </>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.directSaveBtn} onPress={() => onSave({ title, content, tags })}>
          <Text style={styles.directSaveBtnText}>直接存入</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── 日常记录 ─────────────────────────────────────────────────────────────────

const DIARY_TEMPLATES: Record<string, string> = {
  free: '',
  review: '## 今日完成\n\n## 遇到的挑战\n\n## 明日计划\n\n',
  weekly: '## 本周亮点\n\n## 本周挑战\n\n## 成长与收获\n\n## 下周目标\n\n',
  mood: '## 今日心情\n\n## 发生了什么\n\n## 我的感受\n\n## 下次怎么做\n\n',
};

function DiaryForm({ onSave }: { onSave: (d: any) => void }) {
  const [date] = useState(new Date().toISOString().slice(0, 10));
  const [template, setTemplate] = useState<'free' | 'review' | 'weekly' | 'mood'>('free');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');

  const TEMPLATES = [
    { key: 'free', label: '自由' },
    { key: 'review', label: '复盘' },
    { key: 'weekly', label: '周记' },
    { key: 'mood', label: '心情' },
  ] as const;

  return (
    <View style={styles.form}>
      <Text style={styles.fieldLabel}>日期</Text>
      <View style={styles.staticField}><Text style={styles.staticText}>{date}</Text></View>

      <Text style={styles.fieldLabel}>模板</Text>
      <View style={styles.chipRow}>
        {TEMPLATES.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.chip, template === t.key && styles.chipActive]}
            onPress={() => {
              setTemplate(t.key);
              setContent(DIARY_TEMPLATES[t.key]);
            }}
          >
            <Text style={[styles.chipText, template === t.key && styles.chipTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.fieldLabel}>内容</Text>
      <TextInput
        style={[styles.input, styles.inputMulti]}
        value={content}
        onChangeText={setContent}
        placeholder="写下今天…"
        placeholderTextColor={Colors.text.tertiary}
        multiline
      />

      <Text style={styles.fieldLabel}>标签</Text>
      <TextInput style={styles.input} value={tags} onChangeText={setTags} placeholder="日记, 生活" placeholderTextColor={Colors.text.tertiary} />

      <TouchableOpacity style={styles.primaryBtn} onPress={() => onSave({ date, template, content, tags })}>
        <Text style={styles.primaryBtnText}>存入日记</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── 认知总结 ─────────────────────────────────────────────────────────────────

function CognitionForm({ onSave }: { onSave: (d: any) => void }) {
  const [topic, setTopic] = useState('');
  const [understanding, setUnderstanding] = useState('');
  const [source, setSource] = useState('');
  const [confidence, setConfidence] = useState<'certain' | 'probably' | 'exploring'>('probably');

  const CONFIDENCE = [
    { key: 'certain', label: '很确定' },
    { key: 'probably', label: '大概如此' },
    { key: 'exploring', label: '探索中' },
  ] as const;

  return (
    <View style={styles.form}>
      <Text style={styles.fieldLabel}>主题</Text>
      <TextInput style={styles.input} value={topic} onChangeText={setTopic} placeholder="这个认知关于什么？" placeholderTextColor={Colors.text.tertiary} />

      <Text style={styles.fieldLabel}>我的理解与结论</Text>
      <TextInput
        style={[styles.input, styles.inputMulti]}
        value={understanding}
        onChangeText={setUnderstanding}
        placeholder="我认为…"
        placeholderTextColor={Colors.text.tertiary}
        multiline
      />

      <Text style={styles.fieldLabel}>来源或触发</Text>
      <TextInput style={styles.input} value={source} onChangeText={setSource} placeholder="读了某篇文章 / 经历了某件事…" placeholderTextColor={Colors.text.tertiary} />

      <Text style={styles.fieldLabel}>置信度</Text>
      <View style={styles.chipRow}>
        {CONFIDENCE.map((c) => (
          <TouchableOpacity
            key={c.key}
            style={[styles.chip, confidence === c.key && styles.chipActive]}
            onPress={() => setConfidence(c.key)}
          >
            <Text style={[styles.chipText, confidence === c.key && styles.chipTextActive]}>{c.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.primaryBtn} onPress={() => onSave({ topic, understanding, source, confidence })}>
        <Text style={styles.primaryBtnText}>存入认知总结</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── 知识页面 ─────────────────────────────────────────────────────────────────

function WikiPageForm({ onSave }: { onSave: (d: any) => void }) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<WikiCategory>('concept');
  const [content, setContent] = useState('');
  const [related, setRelated] = useState('');
  const [tags, setTags] = useState('');

  const CATS: { key: WikiCategory; label: string }[] = [
    { key: 'concept', label: '概念' },
    { key: 'architecture', label: '架构' },
    { key: 'comparison', label: '对比' },
    { key: 'summary', label: '摘要' },
    { key: 'tool', label: '工具' },
  ];

  return (
    <View style={styles.form}>
      <Text style={styles.fieldLabel}>标题</Text>
      <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="页面标题" placeholderTextColor={Colors.text.tertiary} />

      <Text style={styles.fieldLabel}>分类</Text>
      <View style={styles.chipRow}>
        {CATS.map((c) => (
          <TouchableOpacity
            key={c.key}
            style={[styles.chip, category === c.key && styles.chipActive]}
            onPress={() => setCategory(c.key)}
          >
            <Text style={[styles.chipText, category === c.key && styles.chipTextActive]}>{c.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.fieldLabel}>内容（Markdown）</Text>
      <TextInput
        style={[styles.input, styles.inputMultiLarge]}
        value={content}
        onChangeText={setContent}
        placeholder="支持 Markdown 格式，用 [[页面标题]] 创建内部链接"
        placeholderTextColor={Colors.text.tertiary}
        multiline
      />

      <Text style={styles.fieldLabel}>关联已有页面</Text>
      <TextInput style={styles.input} value={related} onChangeText={setRelated} placeholder="[[页面1]], [[页面2]]" placeholderTextColor={Colors.text.tertiary} />

      <Text style={styles.fieldLabel}>标签（逗号分隔）</Text>
      <TextInput style={styles.input} value={tags} onChangeText={setTags} placeholder="LLM, 架构, 核心概念" placeholderTextColor={Colors.text.tertiary} />

      <TouchableOpacity style={styles.primaryBtn} onPress={() => onSave({ title, category, content, related, tags })}>
        <Text style={styles.primaryBtnText}>创建 Wiki 页面</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── WikiNewScreen ────────────────────────────────────────────────────────────

const TYPE_CONFIG = {
  note: { title: '快速笔记', color: Colors.fab.note },
  diary: { title: '日常记录', color: Colors.fab.diary },
  cognition: { title: '认知总结', color: Colors.fab.cognition },
  wiki: { title: '知识页面', color: Colors.fab.wiki },
};

export default function WikiNewScreen({ navigation, route }: Props) {
  const { type } = route.params;
  const { addPage } = useWikiStore();
  const { activeProvider } = useSettingsStore();
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const config = TYPE_CONFIG[type];

  async function handleSave(data: any) {
    if (!data.content?.trim() && !data.understanding?.trim()) {
      Alert.alert('提示', '请填写内容');
      return;
    }
    setLoading(true);
    try {
      let title = data.title?.trim();
      let content = '';
      let category: WikiCategory = 'note';
      let tags: string[] = [];

      if (type === 'note') {
        title = title || `笔记 ${new Date().toLocaleDateString()}`;
        content = data.content;
        category = 'note';
        tags = data.tags ? data.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [];
      } else if (type === 'diary') {
        title = `日记 ${data.date}`;
        content = `模板：${data.template}\n\n${data.content}`;
        category = 'diary';
        tags = ['日记', ...(data.tags ? data.tags.split(',').map((t: string) => t.trim()) : [])];
      } else if (type === 'cognition') {
        title = data.topic || '认知总结';
        content = `## 我的理解\n\n${data.understanding}\n\n## 来源\n\n${data.source}\n\n## 置信度\n\n${data.confidence}`;
        category = 'cognition';
        tags = ['认知'];
      } else if (type === 'wiki') {
        title = data.title;
        content = `${data.content}\n\n## 相关概念\n\n${data.related}`;
        category = data.category;
        tags = data.tags ? data.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [];
      }

      await addPage({ title, category, tags, source: 'manual', content });
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('保存失败', e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveWithAI(data: any) {
    const rawContent = data.content?.trim();
    if (!rawContent) {
      Alert.alert('提示', '请先填写内容');
      return;
    }
    setAiLoading(true);
    try {
      const prompt = `你是一个个人知识库助手。请将下面的笔记整理为结构清晰的 Markdown 格式：\n\n原始内容：\n${rawContent}\n\n要求：\n- 补充合适的二级标题（##）\n- 提炼核心要点为要点列表\n- 保留所有原始信息，不要删改语义\n- 只输出整理后的 Markdown，不要解释`;
      const response = await callLLM(activeProvider, [
        { role: 'user', content: prompt },
      ]);
      // 用 AI 整理后的内容替换原内容再保存
      await handleSave({ ...data, content: response.content });
    } catch (e: any) {
      Alert.alert('AI 整理失败', e.message ?? '请检查 API Key 或网络');
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: config.color + '33' }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={22} color={Colors.text.primary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: config.color }]}>{config.title}</Text>
        {(loading || aiLoading) && (
          <ActivityIndicator size="small" color={config.color} />
        )}
        {aiLoading && (
          <Text style={[styles.aiStatusText, { color: config.color }]}>AI 整理中…</Text>
        )}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {type === 'note' && (
          <NoteForm
            onSave={handleSave}
            onSaveWithAI={handleSaveWithAI}
            aiLoading={aiLoading}
          />
        )}
        {type === 'diary' && <DiaryForm onSave={handleSave} />}
        {type === 'cognition' && <CognitionForm onSave={handleSave} />}
        {type === 'wiki' && <WikiPageForm onSave={handleSave} />}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    gap: 10,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700', flex: 1 },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 48 },

  form: {},
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.secondary,
    marginBottom: 8,
    marginTop: 18,
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
  inputMulti: { minHeight: 120, textAlignVertical: 'top' },
  inputMultiLarge: { minHeight: 200, textAlignVertical: 'top' },

  staticField: {
    borderWidth: 0.5,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
  },
  staticText: { fontSize: 15, color: Colors.text.secondary },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 13, color: Colors.text.secondary },
  chipTextActive: { color: '#fff', fontWeight: '600' },

  btnRow: { flexDirection: 'row', gap: 12, marginTop: 28 },
  aiSaveBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    borderWidth: 0.5,
    borderColor: Colors.ai,
    borderRadius: 12,
    paddingVertical: 14,
  },
  aiSaveBtnText: { fontSize: 14, fontWeight: '600', color: Colors.ai },
  directSaveBtn: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  directSaveBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },

  primaryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 28,
  },
  primaryBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  aiStatusText: { fontSize: 12, marginLeft: 8, fontWeight: '500' },
});
