import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { WikiCategory } from '../types';
import { Colors, CategoryLabels } from '../constants/colors';

interface Props {
  category: WikiCategory;
  size?: 'sm' | 'md';
}

export default function CategoryBadge({ category, size = 'md' }: Props) {
  const color = Colors.category[category] ?? Colors.category.note;
  const label = CategoryLabels[category] ?? category;

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: color.bg },
        size === 'sm' && styles.badgeSm,
      ]}
    >
      <Text style={[styles.text, { color: color.text }, size === 'sm' && styles.textSm]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  badgeSm: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
  textSm: {
    fontSize: 11,
  },
});
