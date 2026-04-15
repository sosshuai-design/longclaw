import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { WikiPage } from '../types';
import { Colors } from '../constants/colors';
import CategoryBadge from './CategoryBadge';

interface Props {
  page: WikiPage;
  onPress?: () => void;
  showSource?: boolean;
}

const SOURCE_LABELS: Record<string, string> = {
  ingest: 'Ingest 导入',
  query: 'Query 存入',
  manual: '手动写入',
};

export default function WikiCard({ page, onPress, showSource = true }: Props) {
  const color = Colors.category[page.category] ?? Colors.category.note;
  const sourceLabel = SOURCE_LABELS[page.source] ?? page.source;
  const isManual = page.source === 'manual';

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.leftAccent}>
        <View style={[styles.dot, { backgroundColor: isManual ? Colors.user : Colors.ai }]} />
      </View>

      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>
          {page.title}
        </Text>

        <View style={styles.meta}>
          <Text style={styles.metaText}>
            {page.updated.slice(0, 10)}
          </Text>
          {showSource && (
            <>
              <Text style={styles.metaDot}>·</Text>
              <Text style={[styles.metaText, { color: isManual ? Colors.user : Colors.ai }]}>
                {sourceLabel}
              </Text>
            </>
          )}
          <Text style={styles.metaDot}>·</Text>
          <Text style={styles.metaText}>{page.references} 引用</Text>
        </View>

        <View style={styles.footer}>
          <CategoryBadge category={page.category} size="sm" />
          {page.tags.slice(0, 2).map((tag) => (
            <View key={tag} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    borderRadius: 13,
    borderWidth: 0.5,
    borderColor: Colors.border,
    padding: 14,
    marginBottom: 10,
  },
  leftAccent: {
    paddingTop: 3,
    marginRight: 12,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  content: { flex: 1 },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 5,
    lineHeight: 21,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  metaText: { fontSize: 12, color: Colors.text.secondary },
  metaDot: { fontSize: 12, color: Colors.text.tertiary, marginHorizontal: 4 },
  footer: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: {
    backgroundColor: Colors.surface,
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tagText: { fontSize: 11, color: Colors.text.secondary },
});
