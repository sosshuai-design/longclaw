import React, { useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { FileText, ChevronRight, AlertTriangle, Sparkles, Layers } from 'lucide-react-native';
import { Colors } from '../constants/colors';
import { useWikiStore } from '../store/wikiStore';
import { useAuthStore } from '../store/authStore';
import StatsCard from '../components/StatsCard';
import WikiCard from '../components/WikiCard';
import { MainTabParamList, WikiPage } from '../types';

type NavProp = BottomTabNavigationProp<MainTabParamList>;

export default function HomeScreen() {
  const navigation = useNavigation<NavProp>();
  const { pages, stats, isLoading, loadPages } = useWikiStore();
  const { user } = useAuthStore();

  const recentPages = pages.slice(0, 5);
  const initials = user?.username?.slice(0, 1).toUpperCase() ?? 'W';

  const handleRefresh = useCallback(async () => {
    await loadPages();
  }, [loadPages]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={handleRefresh}
            tintColor={Colors.primary}
          />
        }
      >
        {/* 顶部栏 */}
        <View style={styles.header}>
          <View>
            <Text style={styles.brandName}>WikiMind</Text>
            <Text style={styles.brandSub}>我的知识库</Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.indexBtn}
              onPress={() => navigation.navigate('Wiki')}
            >
              <Layers size={20} color={Colors.primary} />
            </TouchableOpacity>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          </View>
        </View>

        {/* 统计卡片 2×2 */}
        <View style={styles.statsGrid}>
          <View style={styles.statsRow}>
            <StatsCard label="Wiki 页面" value={stats.totalPages} />
            <View style={styles.statsSpacer} />
            <StatsCard label="原始资料" value={stats.totalRawFiles} />
          </View>
          <View style={[styles.statsRow, { marginTop: 10 }]}>
            <StatsCard label="交叉引用" value={stats.totalReferences} />
            <View style={styles.statsSpacer} />
            <StatsCard
              label="待处理矛盾"
              value={stats.pendingConflicts}
              accent={stats.pendingConflicts > 0}
            />
          </View>
        </View>

        {/* 导入快捷条 */}
        <TouchableOpacity
          style={styles.importBanner}
          onPress={() => navigation.navigate('Chat', { mode: 'ingest' })}
          activeOpacity={0.8}
        >
          <View style={styles.importLeft}>
            <Sparkles size={18} color={Colors.primary} />
            <Text style={styles.importText}>导入新资料 · 文章、PDF、链接、录音…</Text>
          </View>
          <ChevronRight size={16} color={Colors.primary} />
        </TouchableOpacity>

        {/* 最近更新 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>最近更新</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Wiki')}>
              <Text style={styles.sectionLink}>全部</Text>
            </TouchableOpacity>
          </View>

          {recentPages.length === 0 ? (
            <EmptyRecentState onImport={() => navigation.navigate('Chat', { mode: 'ingest' })} />
          ) : (
            recentPages.map((page) => (
              <WikiCard
                key={page.id}
                page={page}
                onPress={() => {
                  navigation.navigate('Wiki');
                }}
              />
            ))
          )}
        </View>

        {/* 快捷操作 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>快捷操作</Text>
          <View style={styles.quickActions}>
            <QuickAction
              icon={<FileText size={18} color={Colors.primary} />}
              label="查询知识库"
              desc="基于 Wiki 提问"
              onPress={() => navigation.navigate('Chat', { mode: 'query' })}
            />
            <QuickAction
              icon={<AlertTriangle size={18} color={Colors.lint.conflict} />}
              label="Wiki 健康检查"
              desc={stats.pendingConflicts > 0 ? `${stats.pendingConflicts} 个待处理问题` : '检测矛盾和孤立页面'}
              onPress={() => {}}
            />
            <QuickAction
              icon={<Layers size={18} color={Colors.text.secondary} />}
              label="系统文件"
              desc="index.md · log.md · schema"
              onPress={() => navigation.navigate('Wiki')}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function EmptyRecentState({ onImport }: { onImport: () => void }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>📚</Text>
      <Text style={styles.emptyTitle}>知识库还是空的</Text>
      <Text style={styles.emptyDesc}>导入第一篇资料，开始构建你的知识体系</Text>
      <TouchableOpacity style={styles.emptyBtn} onPress={onImport}>
        <Text style={styles.emptyBtnText}>导入资料</Text>
      </TouchableOpacity>
    </View>
  );
}

interface QuickActionProps {
  icon: React.ReactNode;
  label: string;
  desc: string;
  onPress: () => void;
}

function QuickAction({ icon, label, desc, onPress }: QuickActionProps) {
  return (
    <TouchableOpacity style={styles.quickAction} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.quickActionIcon}>{icon}</View>
      <View style={styles.quickActionContent}>
        <Text style={styles.quickActionLabel}>{label}</Text>
        <Text style={styles.quickActionDesc}>{desc}</Text>
      </View>
      <ChevronRight size={16} color={Colors.text.tertiary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  container: { paddingHorizontal: 18, paddingBottom: 32 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingTop: 8,
    paddingBottom: 20,
  },
  brandName: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text.primary,
    letterSpacing: -0.5,
  },
  brandSub: { fontSize: 13, color: Colors.text.secondary, marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  indexBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: 16, fontWeight: '700', color: '#fff' },

  statsGrid: { marginBottom: 16 },
  statsRow: { flexDirection: 'row' },
  statsSpacer: { width: 10 },

  importBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.primaryLight,
    borderRadius: 13,
    padding: 14,
    marginBottom: 24,
  },
  importLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  importText: { fontSize: 14, color: Colors.primary, fontWeight: '500', flex: 1 },

  section: { marginBottom: 24 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.text.primary },
  sectionLink: { fontSize: 14, color: Colors.primary },

  emptyState: {
    alignItems: 'center',
    paddingVertical: 36,
    backgroundColor: Colors.surface,
    borderRadius: 13,
    borderWidth: 0.5,
    borderColor: Colors.border,
  },
  emptyIcon: { fontSize: 36, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: Colors.text.primary, marginBottom: 6 },
  emptyDesc: { fontSize: 13, color: Colors.text.secondary, textAlign: 'center', paddingHorizontal: 32, marginBottom: 16 },
  emptyBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  emptyBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },

  quickActions: {
    backgroundColor: Colors.background,
    borderRadius: 13,
    borderWidth: 0.5,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  quickAction: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  quickActionIcon: {
    width: 36,
    height: 36,
    borderRadius: 9,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  quickActionContent: { flex: 1 },
  quickActionLabel: { fontSize: 14, fontWeight: '600', color: Colors.text.primary },
  quickActionDesc: { fontSize: 12, color: Colors.text.secondary, marginTop: 1 },
});
