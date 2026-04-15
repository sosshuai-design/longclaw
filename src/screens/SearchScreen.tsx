import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Search, X, ArrowLeft } from 'lucide-react-native';
import { Colors } from '../constants/colors';
import { useWikiStore } from '../store/wikiStore';
import CategoryBadge from '../components/CategoryBadge';
import { WikiPage } from '../types';

// 高亮匹配文字
function HighlightText({
  text,
  query,
  style,
}: {
  text: string;
  query: string;
  style?: any;
}) {
  if (!query.trim()) return <Text style={style}>{text}</Text>;

  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const idx = lowerText.indexOf(lowerQuery);

  if (idx === -1) return <Text style={style}>{text}</Text>;

  return (
    <Text style={style}>
      {text.slice(0, idx)}
      <Text style={[style, styles.highlight]}>{text.slice(idx, idx + query.length)}</Text>
      {text.slice(idx + query.length)}
    </Text>
  );
}

// 从正文中提取包含关键词的上下文片段
function extractSnippet(content: string, query: string, maxLen = 100): string {
  const body = content.replace(/^---[\s\S]*?---\n/, '').trim();
  const lower = body.toLowerCase();
  const idx = lower.indexOf(query.toLowerCase());
  if (idx === -1) return body.slice(0, maxLen);

  const start = Math.max(0, idx - 30);
  const end = Math.min(body.length, idx + query.length + 70);
  return (start > 0 ? '…' : '') + body.slice(start, end) + (end < body.length ? '…' : '');
}

export default function SearchScreen() {
  const navigation = useNavigation();
  const { pages } = useWikiStore();
  const [query, setQuery] = useState('');

  const results = useMemo<WikiPage[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q || q.length < 1) return [];

    return pages.filter((p) => {
      const inTitle = p.title.toLowerCase().includes(q);
      const inTags = p.tags.some((t) => t.toLowerCase().includes(q));
      const inContent = p.content.toLowerCase().includes(q);
      return inTitle || inTags || inContent;
    });
  }, [query, pages]);

  function handleSelect(page: WikiPage) {
    // 导航到 Wiki 详情
    (navigation as any).navigate('Wiki', {
      screen: 'WikiDetail',
      params: { pageId: page.filePath },
    });
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* 搜索栏 */}
      <View style={styles.searchBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={20} color={Colors.text.secondary} />
        </TouchableOpacity>
        <Search size={16} color={Colors.text.tertiary} />
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          placeholder="搜索标题、正文、标签…"
          placeholderTextColor={Colors.text.tertiary}
          autoFocus
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')}>
            <X size={16} color={Colors.text.tertiary} />
          </TouchableOpacity>
        )}
      </View>

      {/* 结果统计 */}
      {query.trim().length > 0 && (
        <View style={styles.resultMeta}>
          <Text style={styles.resultMetaText}>
            {results.length > 0
              ? `找到 ${results.length} 个结果`
              : '无匹配结果'}
          </Text>
        </View>
      )}

      {/* 初始状态 */}
      {query.trim().length === 0 && (
        <View style={styles.emptyState}>
          <Search size={36} color={Colors.text.tertiary} />
          <Text style={styles.emptyTitle}>全文搜索</Text>
          <Text style={styles.emptyDesc}>搜索所有 Wiki 页面的标题、正文和标签</Text>
        </View>
      )}

      {/* 结果列表 */}
      <FlatList
        data={results}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const hasContentMatch = item.content.toLowerCase().includes(query.toLowerCase());
          const snippet = hasContentMatch ? extractSnippet(item.content, query) : '';

          return (
            <TouchableOpacity
              style={styles.resultCard}
              onPress={() => handleSelect(item)}
              activeOpacity={0.75}
            >
              <View style={styles.resultTop}>
                <CategoryBadge category={item.category} size="sm" />
                <Text style={styles.resultDate}>{item.updated.slice(0, 10)}</Text>
              </View>
              <HighlightText
                text={item.title}
                query={query}
                style={styles.resultTitle}
              />
              {snippet ? (
                <HighlightText
                  text={snippet}
                  query={query}
                  style={styles.resultSnippet}
                />
              ) : null}
              {item.tags.length > 0 && (
                <View style={styles.resultTags}>
                  {item.tags.slice(0, 3).map((t) => (
                    <View key={t} style={styles.tagChip}>
                      <HighlightText text={t} query={query} style={styles.tagChipText} />
                    </View>
                  ))}
                </View>
              )}
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          query.trim().length > 0 ? (
            <View style={styles.noResults}>
              <Text style={styles.noResultsIcon}>🔍</Text>
              <Text style={styles.noResultsTitle}>没有找到「{query}」</Text>
              <Text style={styles.noResultsHint}>尝试搜索其他关键词，或通过 Ingest 导入相关资料</Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
    gap: 8,
  },
  backBtn: { padding: 2 },
  input: {
    flex: 1,
    fontSize: 15,
    color: Colors.text.primary,
    paddingVertical: 0,
  },

  resultMeta: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    backgroundColor: Colors.surface,
  },
  resultMetaText: { fontSize: 12, color: Colors.text.secondary },

  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 10,
  },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: Colors.text.secondary },
  emptyDesc: { fontSize: 13, color: Colors.text.tertiary, textAlign: 'center', lineHeight: 20 },

  list: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 40 },

  resultCard: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: Colors.border,
    padding: 14,
    marginBottom: 10,
  },
  resultTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  resultDate: { fontSize: 11, color: Colors.text.tertiary },
  resultTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 5,
  },
  resultSnippet: {
    fontSize: 13,
    color: Colors.text.secondary,
    lineHeight: 19,
    marginBottom: 8,
  },
  resultTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  tagChip: {
    backgroundColor: Colors.surface,
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tagChipText: { fontSize: 11, color: Colors.text.secondary },

  highlight: {
    backgroundColor: '#FEF08A',
    color: Colors.text.primary,
    borderRadius: 2,
  },

  noResults: {
    paddingTop: 48,
    alignItems: 'center',
    gap: 8,
  },
  noResultsIcon: { fontSize: 36 },
  noResultsTitle: { fontSize: 16, fontWeight: '600', color: Colors.text.secondary },
  noResultsHint: { fontSize: 13, color: Colors.text.tertiary, textAlign: 'center', lineHeight: 20 },
});
