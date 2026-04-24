import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  TextInput,
  Animated,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Search, Plus, FileText, BookOpen, Lightbulb, PenLine, Link2, Share2 } from 'lucide-react-native';
import { Colors, CategoryLabels } from '../../constants/colors';
import { useWikiStore } from '../../store/wikiStore';
import WikiCard from '../../components/WikiCard';
import { WikiStackParamList, WikiCategory, WikiPage } from '../../types';

type NavProp = StackNavigationProp<WikiStackParamList, 'WikiList'>;

const CATEGORIES: { key: WikiCategory | 'all'; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'concept', label: '概念' },
  { key: 'architecture', label: '架构' },
  { key: 'comparison', label: '对比' },
  { key: 'summary', label: '摘要' },
  { key: 'diary', label: '日记' },
  { key: 'cognition', label: '认知' },
  { key: 'note', label: '笔记' },
  { key: 'tool', label: '工具' },
];

export default function WikiListScreen() {
  const navigation = useNavigation<NavProp>();
  const rootNav = useNavigation<any>();
  const { pages, isLoading, loadPages, selectedCategory, setSelectedCategory } = useWikiStore();

  const [searchText, setSearchText] = useState('');
  const [searchVisible, setSearchVisible] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);

  const fabAnim = useState(new Animated.Value(0))[0];

  function toggleFab() {
    const toValue = fabOpen ? 0 : 1;
    Animated.spring(fabAnim, { toValue, useNativeDriver: true }).start();
    setFabOpen((v) => !v);
  }

  const filteredPages = pages.filter((p) => {
    const matchCat = selectedCategory === 'all' || p.category === selectedCategory;
    const matchSearch =
      !searchText ||
      p.title.toLowerCase().includes(searchText.toLowerCase()) ||
      p.tags.some((t) => t.toLowerCase().includes(searchText.toLowerCase()));
    return matchCat && matchSearch;
  });

  // 分组：手动写入 vs AI 整理
  const manualPages = filteredPages.filter((p) => p.source === 'manual');
  const aiPages = filteredPages.filter((p) => p.source !== 'manual');

  const uniqueSources = new Set(pages.map((p) => p.source)).size;

  function handleNavigateToNew(type: 'note' | 'diary' | 'cognition' | 'wiki' | 'link') {
    setFabOpen(false);
    Animated.spring(fabAnim, { toValue: 0, useNativeDriver: true }).start();
    navigation.navigate('WikiNew', { type });
  }

  const FAB_ITEMS = [
    { type: 'note' as const, label: '快速笔记', color: Colors.fab.note, Icon: PenLine },
    { type: 'diary' as const, label: '日常记录', color: Colors.fab.diary, Icon: FileText },
    { type: 'cognition' as const, label: '认知总结', color: Colors.fab.cognition, Icon: Lightbulb },
    { type: 'wiki' as const, label: '知识页面', color: Colors.fab.wiki, Icon: BookOpen },
    { type: 'link' as const, label: '链接导入', color: '#1677ff', Icon: Link2 },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* 顶部栏 */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Wiki 知识库</Text>
          <Text style={styles.subtitle}>
            {pages.length} 个页面 · {uniqueSources} 类来源
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity onPress={() => navigation.navigate('WikiGraph')} style={styles.searchBtn}>
            <Share2 size={20} color={Colors.text.secondary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => rootNav.navigate('Search')} style={styles.searchBtn}>
            <Search size={20} color={Colors.text.secondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* 搜索框 */}
      {searchVisible && (
        <View style={styles.searchBar}>
          <Search size={15} color={Colors.text.tertiary} />
          <TextInput
            style={styles.searchInput}
            value={searchText}
            onChangeText={setSearchText}
            placeholder="搜索标题、标签…"
            placeholderTextColor={Colors.text.tertiary}
            autoFocus
          />
        </View>
      )}

      {/* 分类过滤 */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.catScroll}
        contentContainerStyle={styles.catScrollContent}
      >
        {CATEGORIES.map((c) => (
          <TouchableOpacity
            key={c.key}
            style={[styles.catChip, selectedCategory === c.key && styles.catChipActive]}
            onPress={() => setSelectedCategory(c.key)}
          >
            <Text style={[styles.catChipText, selectedCategory === c.key && styles.catChipTextActive]}>
              {c.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* 页面列表 */}
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={loadPages} tintColor={Colors.primary} />
        }
      >
        {/* 我的记录 */}
        {manualPages.length > 0 && (
          <View style={styles.group}>
            <View style={styles.groupHeader}>
              <View style={[styles.groupDot, { backgroundColor: Colors.user }]} />
              <Text style={styles.groupTitle}>我的记录</Text>
              <View style={styles.groupTag}>
                <Text style={styles.groupTagText}>手动写入</Text>
              </View>
            </View>
            {manualPages.map((page) => (
              <WikiCard
                key={page.id}
                page={page}
                onPress={() => navigation.navigate('WikiDetail', { pageId: page.filePath })}
              />
            ))}
          </View>
        )}

        {/* AI 整理 */}
        {aiPages.length > 0 && (
          <View style={styles.group}>
            <View style={styles.groupHeader}>
              <View style={[styles.groupDot, { backgroundColor: Colors.ai }]} />
              <Text style={styles.groupTitle}>AI 整理</Text>
              <View style={[styles.groupTag, { backgroundColor: Colors.aiBg }]}>
                <Text style={[styles.groupTagText, { color: Colors.aiDark }]}>Ingest / Query 存入</Text>
              </View>
            </View>
            {aiPages.map((page) => (
              <WikiCard
                key={page.id}
                page={page}
                onPress={() => navigation.navigate('WikiDetail', { pageId: page.filePath })}
              />
            ))}
          </View>
        )}

        {filteredPages.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>暂无 Wiki 页面</Text>
            <Text style={styles.emptyHint}>点击右下角 + 按钮新建</Text>
          </View>
        )}
      </ScrollView>

      {/* FAB */}
      <View style={styles.fabContainer}>
        {fabOpen && FAB_ITEMS.map((item, i) => {
          const translateY = fabAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0, -((i + 1) * 62)],
          });
          return (
            <Animated.View
              key={item.type}
              style={[styles.fabItem, { transform: [{ translateY }], opacity: fabAnim }]}
            >
              <TouchableOpacity
                style={styles.fabItemLabel}
                onPress={() => handleNavigateToNew(item.type)}
              >
                <Text style={styles.fabItemLabelText}>{item.label}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.fabItemBtn, { backgroundColor: item.color }]}
                onPress={() => handleNavigateToNew(item.type)}
              >
                <item.Icon size={18} color="#fff" />
              </TouchableOpacity>
            </Animated.View>
          );
        })}

        <TouchableOpacity
          style={[styles.fab, fabOpen && styles.fabOpen]}
          onPress={toggleFab}
        >
          <Plus
            size={24}
            color="#fff"
            style={{ transform: [{ rotate: fabOpen ? '45deg' : '0deg' }] }}
          />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 12,
  },
  title: { fontSize: 20, fontWeight: '700', color: Colors.text.primary },
  subtitle: { fontSize: 12, color: Colors.text.secondary, marginTop: 2 },
  searchBtn: { padding: 6 },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 18,
    marginBottom: 8,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14, color: Colors.text.primary },

  catScroll: { maxHeight: 44 },
  catScrollContent: {
    paddingHorizontal: 18,
    paddingBottom: 4,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  catChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  catChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  catChipText: { fontSize: 13, color: Colors.text.secondary },
  catChipTextActive: { color: '#fff', fontWeight: '600' },

  list: { flex: 1 },
  listContent: { paddingHorizontal: 18, paddingBottom: 100 },

  group: { marginBottom: 24 },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  groupDot: { width: 8, height: 8, borderRadius: 4 },
  groupTitle: { fontSize: 15, fontWeight: '700', color: Colors.text.primary },
  groupTag: {
    backgroundColor: Colors.userBg,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  groupTagText: { fontSize: 11, color: Colors.userDark },

  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 16, fontWeight: '600', color: Colors.text.secondary },
  emptyHint: { fontSize: 13, color: Colors.text.tertiary, marginTop: 6 },

  fabContainer: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    alignItems: 'center',
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fabOpen: { backgroundColor: Colors.text.secondary },
  fabItem: {
    position: 'absolute',
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  fabItemLabel: {
    backgroundColor: Colors.text.primary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  fabItemLabelText: { fontSize: 13, color: '#fff', fontWeight: '500' },
  fabItemBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
  },
});
