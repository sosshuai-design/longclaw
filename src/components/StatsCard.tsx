import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../constants/colors';

interface Props {
  label: string;
  value: number | string;
  accent?: boolean; // 红色高亮（用于矛盾数）
}

export default function StatsCard({ label, value, accent }: Props) {
  return (
    <View style={[styles.card, accent && styles.cardAccent]}>
      <Text style={[styles.value, accent && styles.valueAccent]}>{value}</Text>
      <Text style={[styles.label, accent && styles.labelAccent]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 13,
    borderWidth: 0.5,
    borderColor: Colors.border,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 88,
  },
  cardAccent: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
  },
  value: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  valueAccent: { color: Colors.lint.conflict },
  label: {
    fontSize: 12,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  labelAccent: { color: Colors.lint.conflict },
});
