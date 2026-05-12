import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { ArrowLeft, Edit2, MessageSquare, Trash2, Link } from 'lucide-react-native';
import Markdown from 'react-native-markdown-display';
import { Colors } from '../../constants/colors';
import { WikiStackParamList, WikiPage } from '../../types';
import { readWikiPage } from '../../services/wiki';
import { useWikiStore } from '../../store/wikiStore';
import CategoryBadge from '../../components/CategoryBadge';

type Props = {
  navigation: StackNavigationProp<WikiStackParamList, 'WikiDetail'>;
  route: RouteProp<WikiStackParamList, 'WikiDetail'>;
};

const MONO_FONT = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

// 将 [[Title]] 转为 markdown 链接 wiki://Title
function preprocessWikiLinks(content: string): string {
  return content.replace(/\[\[([^\]]+)\]\]/g, (_, title) => {
    return `[${title}](wiki://${encodeURIComponent(title)})`;
  });
}

export default function WikiDetailScreen({ navigation, route }: Props) {
  const { pageId } = route.params;
  const { pages, removePage } = useWikiStore();
  const rootNav = useNavigation<any>();
  const [page, setPage] = useState<WikiPage | null>(null);
  const [loading, setLoading] = useState(true);

  // 反向链接：所有引用了本页的其他页面
  const backlinks = useMemo(() => {
    if (!page) return [];
    return pages.filter(
      (p) => p.filePath !== page.filePath && p.content.includes(`[[${page.title}]]`)
    );
  }, [page, pages]);

  // 正向链接：本页通过 [[Title]] 链接到的其他页面
  const outgoingLinks = useMemo(() => {
    if (!page) return [];
    const matches = [...page.content.matchAll(/\[\[([^\]]+)\]\]/g)];
    const titles = [...new Set(matches.map((m) => m[1]))];
    return titles
      .map((t) => pages.find((p) => p.title === t))
      .filter((p): p is WikiPage => p !== undefined);
  }, [page, pages]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const fromStore = pages.find((p) => p.filePath === pageId || p.id === pageId);
      if (fromStore) {
        setPage(fromStore);
        setLoading(false);
        return;
      }
      const loaded = await readWikiPage(pageId);
      setPage(loaded);
      setLoading(false);
    }
    load().catch(console.error);
  }, [pageId, pages]);

  async function handleDelete() {
    Alert.alert(
      '删除页面',
      `确定删除「${page?.title}」吗？此操作不可撤销。`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            if (page) await removePage(page.filePath);
            navigation.goBack();
          },
        },
      ]
    );
  }

  function getBodyContent(content: string): string {
    return content.replace(/^---[\s\S]*?---\n/, '').trim();
  }

  function handleChatAboutPage() {
    if (!page) return;
    rootNav.navigate('Main', {
      screen: 'Chat',
      params: { mode: 'query', pageTitle: page.title, pageId: page.filePath },
    });
  }

  const sourceLabel =
    page?.source === 'ingest'
      ? 'Ingest 导入'
      : page?.source === 'query'
      ? 'Query 存入'
      : '手动写入';

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.loading}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!page) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <TouchableOpacity style={styles.backBtnAlone} onPress={() => navigation.goBack()}>
          <ArrowLeft size={22} color={Colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.notFound}>
          <Text style={styles.notFoundText}>页面不存在</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={22} color={Colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.actionBtn} onPress={handleDelete}>
            <Trash2 size={18} color={Colors.lint.conflict} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.badges}>
          <View style={[
            styles.sourceBadge,
            { backgroundColor: page.source === 'manual' ? Colors.userBg : Colors.aiBg },
          ]}>
            <Text style={[
              styles.sourceBadgeText,
              { color: page.source === 'manual' ? Colors.userDark : Colors.aiDark },
            ]}>
              {sourceLabel}
            </Text>
          </View>
          <CategoryBadge category={page.category} />
        </View>

        <Text style={styles.title}>{page.title}</Text>
        <Text style={styles.meta}>{page.updated.slice(0, 10)} · {page.references} 引用</Text>

        {page.tags.length > 0 && (
          <View style={styles.tags}>
            {page.tags.map((tag) => (
              <View key={tag} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.body}>
          <Markdown
            style={markdownStyles as any}
            onLinkPress={(url) => {
              if (url.startsWith('wiki://')) {
                const title = decodeURIComponent(url.replace('wiki://', ''));
                const target = pages.find((p) => p.title === title);
                if (target) {
                  navigation.push('WikiDetail', { pageId: target.filePath });
                } else {
                  Alert.alert('页面不存在', `未找到「${title}」`);
                }
                return false;
              }
              return true;
            }}
          >
            {preprocessWikiLinks(getBodyContent(page.content))}
          </Markdown>
        </View>

        {/* 正向链接面板 */}
        {outgoingLinks.length > 0 && (
          <View style={[styles.backlinksPanel, styles.outgoingPanel]}>
            <View style={styles.backlinksTitleRow}>
              <Link size={14} color={Colors.lint.suggest} />
              <Text style={[styles.backlinksTitle, { color: Colors.lint.suggest }]}>
                链接至 ({outgoingLinks.length})
              </Text>
            </View>
            {outgoingLinks.map((ol) => (
              <TouchableOpacity
                key={ol.id}
                style={styles.backlinkItem}
                onPress={() => navigation.push('WikiDetail', { pageId: ol.filePath })}
              >
                <CategoryBadge category={ol.category} size="sm" />
                <Text style={[styles.backlinkTitle, { color: Colors.lint.suggest }]} numberOfLines={1}>{ol.title}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* 反向链接面板 */}
        <View style={styles.backlinksPanel}>
          <View style={styles.backlinksTitleRow}>
            <Link size={14} color={Colors.aiDark} />
            <Text style={styles.backlinksTitle}>
              被引用 {backlinks.length > 0 ? `(${backlinks.length})` : ''}
            </Text>
          </View>
          {backlinks.length === 0 ? (
            <Text style={styles.backlinksHint}>暂无其他页面引用本页</Text>
          ) : (
            backlinks.map((bl) => (
              <TouchableOpacity
                key={bl.id}
                style={styles.backlinkItem}
                onPress={() => navigation.push('WikiDetail', { pageId: bl.filePath })}
              >
                <CategoryBadge category={bl.category} size="sm" />
                <Text style={styles.backlinkTitle} numberOfLines={1}>{bl.title}</Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.chatBtn} onPress={handleChatAboutPage}>
          <MessageSquare size={16} color={Colors.primary} />
          <Text style={styles.chatBtnText}>基于此页对话</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.editBtn}
          onPress={() => navigation.navigate('WikiEdit', { pageId: page.filePath })}
        >
          <Edit2 size={16} color="#fff" />
          <Text style={styles.editBtnText}>编辑</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const markdownStyles = {
  body: { fontSize: 15, color: Colors.text.primary, lineHeight: 24 },
  heading1: { fontSize: 22, fontWeight: '700', color: Colors.text.primary, marginBottom: 12, marginTop: 8 },
  heading2: { fontSize: 18, fontWeight: '700', color: Colors.text.primary, marginBottom: 10, marginTop: 20 },
  heading3: { fontSize: 16, fontWeight: '600', color: Colors.text.primary, marginBottom: 8, marginTop: 14 },
  bullet_list: { marginVertical: 4 },
  ordered_list: { marginVertical: 4 },
  list_item: { marginVertical: 3 },
  code_inline: {
    backgroundColor: Colors.surface,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    fontSize: 13,
    fontFamily: MONO_FONT,
    color: Colors.primary,
  },
  code_block: {
    backgroundColor: Colors.surface,
    borderRadius: 8,
    padding: 14,
    fontSize: 13,
    fontFamily: MONO_FONT,
    marginVertical: 10,
  },
  blockquote: {
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
    paddingLeft: 12,
    marginVertical: 8,
    opacity: 0.8,
  },
  link: { color: Colors.primary },
  strong: { fontWeight: '700' },
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  notFound: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  notFoundText: { fontSize: 16, color: Colors.text.secondary },
  backBtnAlone: { padding: 18 },

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
  backBtn: { padding: 4 },
  headerActions: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },

  scroll: { flex: 1 },
  container: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 100 },

  badges: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  sourceBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  sourceBadgeText: { fontSize: 12, fontWeight: '600' },

  title: { fontSize: 24, fontWeight: '700', color: Colors.text.primary, lineHeight: 32, marginBottom: 8 },
  meta: { fontSize: 13, color: Colors.text.secondary, marginBottom: 12 },

  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 20 },
  tag: { backgroundColor: Colors.surface, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  tagText: { fontSize: 12, color: Colors.text.secondary },

  body: { marginBottom: 24 },

  backlinksPanel: {
    backgroundColor: Colors.aiBg,
    borderRadius: 13,
    padding: 16,
    marginTop: 8,
  },
  outgoingPanel: {
    backgroundColor: '#EBF2FD',
    marginBottom: 8,
  },
  backlinksTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  backlinksTitle: { fontSize: 14, fontWeight: '700', color: Colors.aiDark },
  backlinksHint: { fontSize: 13, color: Colors.aiDark, opacity: 0.6 },
  backlinkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(76,68,168,0.12)',
  },
  backlinkTitle: {
    flex: 1,
    fontSize: 13,
    color: Colors.aiDark,
    fontWeight: '500',
  },

  bottomBar: {
    flexDirection: 'row',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderTopWidth: 0.5,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background,
    gap: 12,
  },
  chatBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    gap: 6,
  },
  chatBtnText: { fontSize: 14, fontWeight: '600', color: Colors.primary },
  editBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    gap: 6,
  },
  editBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },
});
