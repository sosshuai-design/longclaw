import React, { useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import {
  AlertTriangle,
  Unlink,
  FilePlus,
  Compass,
  RefreshCw,
  X,
  ChevronRight,
  Zap,
} from 'lucide-react-native';
import { Colors } from '../constants/colors';
import { useLintStore } from '../store/lintStore';
import { useWikiStore } from '../store/wikiStore';
import { useSettingsStore } from '../store/settingsStore';
import { MainTabParamList, WikiCategory } from '../types';

type NavProp = BottomTabNavigationProp<MainTabParamList>;

// ─── 统计卡片 ─────────────────────────────────────────────────────────────────

function LintStatCard({
  icon,
  count,
  label,
  accentColor,
}: {
  icon: React.ReactNode;
  count: number;
  label: string;
  accentColor: string;
}) {
  return (
    <View style={[styles.statCard, { borderTopColor: accentColor, borderTopWidth: 3 }]}>
      {icon}
      <Text style={[styles.statCount, { color: accentColor }]}>{count}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ─── 分区标题 ─────────────────────────────────────────────────────────────────

function SectionTitle({
  icon,
  label,
  count,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  color: string;
}) {
  return (
    <View style={styles.sectionTitle}>
      {icon}
      <Text style={[styles.sectionTitleText, { color }]}>{label}</Text>
      <View style={[styles.sectionBadge, { backgroundColor: color + '22' }]}>
        <Text style={[styles.sectionBadgeText, { color }]}>{count}</Text>
      </View>
    </View>
  );
}

// ─── LintScreen ───────────────────────────────────────────────────────────────

export default function LintScreen() {
  const navigation = useNavigation<NavProp>();
  const { report, isRunning, progress, lastRanAt, runLintCheck, dismissConflict, dismissOrphan, dismissSuggestion, dismissExploration } = useLintStore();
  const { pages, addPage } = useWikiStore();
  const { activeProvider } = useSettingsStore();

  const handleRun = useCallback(() => {
    runLintCheck(activeProvider).catch((e) =>
      Alert.alert('检查失败', e.message)
    );
  }, [activeProvider, runLintCheck]);

  function handleNavigateToWikiDetail(pageId: string) {
    navigation.navigate('Wiki');
  }

  function handleNavigateToQuery(query: string) {
    navigation.navigate('Chat', { mode: 'query' });
  }

  async function handleAIDraftPage(concept: string) {
    Alert.alert(
      '起草页面',
      `AI 将为「${concept}」创建一个初稿 Wiki 页面，确认吗？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '创建',
          onPress: async () => {
            await addPage({
              title: concept,
              category: 'concept' as WikiCategory,
              tags: [],
              source: 'manual',
              content: `# ${concept}\n\n> 此页面由 Lint 建议创建，请补充内容。\n\n## 定义\n\n（待补充）\n\n## 相关概念\n\n`,
            });
            dismissSuggestion(concept);
            Alert.alert('已创建', `「${concept}」页面已创建，请补充内容`);
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* 顶部 */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Wiki 健康检查</Text>
          {lastRanAt && (
            <Text style={styles.lastRan}>
              上次检查：{new Date(lastRanAt).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </Text>
          )}
        </View>
        <TouchableOpacity
          style={[styles.runBtn, isRunning && styles.runBtnDisabled]}
          onPress={handleRun}
          disabled={isRunning}
        >
          {isRunning ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <RefreshCw size={16} color="#fff" />
          )}
          <Text style={styles.runBtnText}>{isRunning ? '检查中…' : '立即检查'}</Text>
        </TouchableOpacity>
      </View>

      {/* 进度提示 */}
      {isRunning && progress ? (
        <View style={styles.progressBar}>
          <Text style={styles.progressText}>{progress}</Text>
        </View>
      ) : null}

      {/* 无报告 */}
      {!report && !isRunning && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🔍</Text>
          <Text style={styles.emptyTitle}>还没有检查报告</Text>
          <Text style={styles.emptyDesc}>
            点击「立即检查」，AI 将分析你的 Wiki 知识库，检测矛盾、孤立页面和知识空白。
          </Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={handleRun}>
            <Text style={styles.emptyBtnText}>开始检查</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 报告内容 */}
      {report && (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* 统计卡片 */}
          <View style={styles.statsRow}>
            <LintStatCard
              icon={<AlertTriangle size={18} color={Colors.lint.conflict} />}
              count={report.conflicts.length}
              label="矛盾"
              accentColor={Colors.lint.conflict}
            />
            <LintStatCard
              icon={<Unlink size={18} color={Colors.lint.orphan} />}
              count={report.orphans.length}
              label="孤立页面"
              accentColor={Colors.lint.orphan}
            />
            <LintStatCard
              icon={<FilePlus size={18} color={Colors.lint.suggest} />}
              count={report.suggestions.length}
              label="待建议"
              accentColor={Colors.lint.suggest}
            />
            <LintStatCard
              icon={<Compass size={18} color={Colors.lint.explore} />}
              count={report.explorations.length}
              label="探索"
              accentColor={Colors.lint.explore}
            />
          </View>

          {/* ① 矛盾检测 */}
          {report.conflicts.length > 0 && (
            <View style={styles.section}>
              <SectionTitle
                icon={<AlertTriangle size={15} color={Colors.lint.conflict} />}
                label="矛盾检测"
                count={report.conflicts.length}
                color={Colors.lint.conflict}
              />
              {report.conflicts.map((c) => (
                <View key={c.id} style={[styles.itemCard, styles.itemCardConflict]}>
                  <View style={styles.conflictPages}>
                    <TouchableOpacity
                      style={styles.conflictPageBtn}
                      onPress={() => handleNavigateToWikiDetail(c.page1Id)}
                    >
                      <Text style={styles.conflictPageText} numberOfLines={1}>{c.page1Title}</Text>
                    </TouchableOpacity>
                    <Text style={styles.conflictVs}>vs</Text>
                    <TouchableOpacity
                      style={styles.conflictPageBtn}
                      onPress={() => handleNavigateToWikiDetail(c.page2Id)}
                    >
                      <Text style={styles.conflictPageText} numberOfLines={1}>{c.page2Title}</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.conflictDesc}>{c.description}</Text>
                  <View style={styles.itemActions}>
                    <ActionBtn label="标记矛盾" color={Colors.lint.conflict} onPress={() => {}} />
                    <ActionBtn label="AI 建议解决" color={Colors.ai} onPress={() => handleNavigateToQuery(`如何解决「${c.page1Title}」和「${c.page2Title}」之间的矛盾`)} />
                    <ActionBtn label="忽略" color={Colors.text.tertiary} onPress={() => dismissConflict(c.id)} />
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* ② 孤立页面 */}
          {report.orphans.length > 0 && (
            <View style={styles.section}>
              <SectionTitle
                icon={<Unlink size={15} color={Colors.lint.orphan} />}
                label="孤立页面"
                count={report.orphans.length}
                color={Colors.lint.orphan}
              />
              <Text style={styles.sectionHint}>以下页面没有其他页面引用（无入链）</Text>
              {report.orphans.map((o) => (
                <View key={o.pageId} style={[styles.itemCard, styles.itemCardOrphan]}>
                  <TouchableOpacity
                    style={styles.orphanPageRow}
                    onPress={() => handleNavigateToWikiDetail(o.pageId)}
                  >
                    <View>
                      <Text style={styles.itemTitle}>{o.title}</Text>
                      <Text style={styles.itemSub}>{o.category}</Text>
                    </View>
                    <ChevronRight size={16} color={Colors.text.tertiary} />
                  </TouchableOpacity>
                  <View style={styles.itemActions}>
                    <ActionBtn
                      label="找相关页面"
                      color={Colors.lint.orphan}
                      onPress={() => handleNavigateToQuery(`哪些内容和「${o.title}」相关？应该在哪些页面中引用它？`)}
                    />
                    <ActionBtn label="忽略" color={Colors.text.tertiary} onPress={() => dismissOrphan(o.pageId)} />
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* ③ 建议新建 */}
          {report.suggestions.length > 0 && (
            <View style={styles.section}>
              <SectionTitle
                icon={<FilePlus size={15} color={Colors.lint.suggest} />}
                label="建议新建"
                count={report.suggestions.length}
                color={Colors.lint.suggest}
              />
              <Text style={styles.sectionHint}>被多次提及但尚无专属页面的概念</Text>
              {report.suggestions.map((s) => (
                <View key={s.concept} style={[styles.itemCard, styles.itemCardSuggest]}>
                  <Text style={styles.itemTitle}>[[{s.concept}]]</Text>
                  <Text style={styles.itemSub}>
                    被 {s.mentionCount} 个页面提及：{s.mentionedIn.slice(0, 3).join('、')}
                    {s.mentionedIn.length > 3 ? '…' : ''}
                  </Text>
                  <View style={styles.itemActions}>
                    <ActionBtn label="AI 起草页面" color={Colors.lint.suggest} onPress={() => handleAIDraftPage(s.concept)} />
                    <ActionBtn label="忽略" color={Colors.text.tertiary} onPress={() => dismissSuggestion(s.concept)} />
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* ④ AI 探索建议 */}
          {report.explorations.length > 0 && (
            <View style={styles.section}>
              <SectionTitle
                icon={<Compass size={15} color={Colors.lint.explore} />}
                label="AI 建议探索"
                count={report.explorations.length}
                color={Colors.lint.explore}
              />
              <Text style={styles.sectionHint}>AI 发现的知识空白，点击去 Query 探索</Text>
              {report.explorations.map((e) => (
                <View key={e.topic} style={[styles.itemCard, styles.itemCardExplore]}>
                  <View style={styles.exploreRow}>
                    <Zap size={14} color={Colors.lint.explore} />
                    <Text style={styles.itemTitle}>{e.topic}</Text>
                  </View>
                  <Text style={styles.itemSub}>{e.reason}</Text>
                  <View style={styles.itemActions}>
                    <ActionBtn
                      label="去 Query 探索"
                      color={Colors.lint.explore}
                      onPress={() => handleNavigateToQuery(e.suggestedQuery)}
                    />
                    <ActionBtn label="忽略" color={Colors.text.tertiary} onPress={() => dismissExploration(e.topic)} />
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* 全部清零 */}
          {report.conflicts.length === 0 &&
            report.orphans.length === 0 &&
            report.suggestions.length === 0 &&
            report.explorations.length === 0 && (
              <View style={styles.allClearCard}>
                <Text style={styles.allClearIcon}>✅</Text>
                <Text style={styles.allClearTitle}>知识库状态良好</Text>
                <Text style={styles.allClearDesc}>未发现矛盾、孤立页面或知识空白</Text>
              </View>
            )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function ActionBtn({
  label,
  color,
  onPress,
}: {
  label: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.actionBtn, { borderColor: color + '55' }]}
      onPress={onPress}
    >
      <Text style={[styles.actionBtnText, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  title: { fontSize: 20, fontWeight: '700', color: Colors.text.primary },
  lastRan: { fontSize: 12, color: Colors.text.secondary, marginTop: 2 },
  runBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    gap: 6,
  },
  runBtnDisabled: { opacity: 0.6 },
  runBtnText: { fontSize: 13, fontWeight: '600', color: '#fff' },

  progressBar: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  progressText: { fontSize: 13, color: Colors.primary },

  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.text.primary, marginBottom: 8 },
  emptyDesc: { fontSize: 14, color: Colors.text.secondary, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  emptyBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: 28,
    paddingVertical: 12,
  },
  emptyBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 40 },

  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: Colors.border,
    padding: 12,
    alignItems: 'center',
    gap: 4,
  },
  statCount: { fontSize: 22, fontWeight: '700' },
  statLabel: { fontSize: 11, color: Colors.text.secondary, textAlign: 'center' },

  section: { marginBottom: 24 },
  sectionTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  sectionTitleText: { fontSize: 15, fontWeight: '700', flex: 1 },
  sectionBadge: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  sectionBadgeText: { fontSize: 12, fontWeight: '700' },
  sectionHint: { fontSize: 12, color: Colors.text.secondary, marginBottom: 10 },

  itemCard: {
    borderRadius: 12,
    borderWidth: 0.5,
    padding: 14,
    marginBottom: 10,
  },
  itemCardConflict: { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' },
  itemCardOrphan: { backgroundColor: '#FFFBEB', borderColor: '#FCD34D' },
  itemCardSuggest: { backgroundColor: '#EFF6FF', borderColor: '#93C5FD' },
  itemCardExplore: { backgroundColor: '#ECFDF5', borderColor: '#6EE7B7' },

  conflictPages: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  conflictPageBtn: {
    flex: 1,
    backgroundColor: 'rgba(163,45,45,0.08)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  conflictPageText: { fontSize: 13, fontWeight: '600', color: Colors.lint.conflict },
  conflictVs: { fontSize: 12, color: Colors.lint.conflict, fontWeight: '700' },
  conflictDesc: { fontSize: 13, color: Colors.text.secondary, marginBottom: 10, lineHeight: 20 },

  orphanPageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },

  exploreRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },

  itemTitle: { fontSize: 14, fontWeight: '600', color: Colors.text.primary },
  itemSub: { fontSize: 12, color: Colors.text.secondary, marginTop: 2, marginBottom: 10, lineHeight: 18 },

  itemActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  actionBtnText: { fontSize: 12, fontWeight: '600' },

  allClearCard: {
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: '#6EE7B7',
    padding: 32,
  },
  allClearIcon: { fontSize: 40, marginBottom: 12 },
  allClearTitle: { fontSize: 17, fontWeight: '700', color: '#065F46', marginBottom: 6 },
  allClearDesc: { fontSize: 13, color: '#047857', textAlign: 'center' },
});
