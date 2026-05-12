import React, { useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg';
import { ArrowLeft } from 'lucide-react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Colors, CategoryLabels } from '../../constants/colors';
import { useWikiStore } from '../../store/wikiStore';
import { WikiStackParamList, WikiPage, WikiCategory } from '../../types';

type Props = {
  navigation: StackNavigationProp<WikiStackParamList, 'WikiGraph'>;
};

const { width: SW, height: SH } = Dimensions.get('window');
const CW = SW;
const CH = SH - 180;

const CAT_COLOR: Record<string, string> = {
  concept: '#4C44A8',
  note: '#1A6DB5',
  diary: '#C04E7A',
  tool: '#0A7A61',
};

type Edge = [number, number];

function extractEdges(pages: WikiPage[]): Edge[] {
  const titleIdx = new Map(pages.map((p, i) => [p.title, i]));
  const seen = new Set<string>();
  const edges: Edge[] = [];
  for (let i = 0; i < pages.length; i++) {
    for (const m of pages[i].content.matchAll(/\[\[([^\]]+)\]\]/g)) {
      const j = titleIdx.get(m[1]);
      if (j === undefined || j === i) continue;
      const key = `${Math.min(i, j)}-${Math.max(i, j)}`;
      if (!seen.has(key)) {
        seen.add(key);
        edges.push([i, j]);
      }
    }
  }
  return edges;
}

type Pos = { x: number; y: number };

function forceLayout(n: number, edges: Edge[], w: number, h: number): Pos[] {
  if (n === 0) return [];
  const pad = 48;
  const pos: Pos[] = Array.from({ length: n }, (_, i) => ({
    x: pad + (w - 2 * pad) * (0.5 + 0.45 * Math.cos((2 * Math.PI * i) / n)),
    y: pad + (h - 2 * pad) * (0.5 + 0.45 * Math.sin((2 * Math.PI * i) / n)),
  }));
  if (n === 1) return pos;

  const k = Math.sqrt((w * h) / n) * 0.75;
  const dx = new Float32Array(n);
  const dy = new Float32Array(n);

  for (let iter = 0; iter < 100; iter++) {
    dx.fill(0);
    dy.fill(0);

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const ex = pos[i].x - pos[j].x;
        const ey = pos[i].y - pos[j].y;
        const d = Math.max(Math.sqrt(ex * ex + ey * ey), 1);
        const f = (k * k) / d;
        dx[i] += (ex / d) * f;
        dy[i] += (ey / d) * f;
        dx[j] -= (ex / d) * f;
        dy[j] -= (ey / d) * f;
      }
    }

    for (const [a, b] of edges) {
      const ex = pos[a].x - pos[b].x;
      const ey = pos[a].y - pos[b].y;
      const d = Math.max(Math.sqrt(ex * ex + ey * ey), 1);
      const f = (d * d) / k;
      dx[a] -= (ex / d) * f;
      dy[a] -= (ey / d) * f;
      dx[b] += (ex / d) * f;
      dy[b] += (ey / d) * f;
    }

    // gravity to centre
    for (let i = 0; i < n; i++) {
      dx[i] += (w / 2 - pos[i].x) * 0.015;
      dy[i] += (h / 2 - pos[i].y) * 0.015;
    }

    const temp = Math.max((w / 8) * (1 - iter / 100), 2);
    for (let i = 0; i < n; i++) {
      const mag = Math.max(Math.sqrt(dx[i] ** 2 + dy[i] ** 2), 0.001);
      const step = Math.min(mag, temp);
      pos[i].x = Math.max(pad, Math.min(w - pad, pos[i].x + (dx[i] / mag) * step));
      pos[i].y = Math.max(pad, Math.min(h - pad, pos[i].y + (dy[i] / mag) * step));
    }
  }
  return pos;
}

const LEGEND_CATS: WikiCategory[] = ['concept', 'note', 'diary', 'tool'];

export default function WikiGraphScreen({ navigation }: Props) {
  const { pages } = useWikiStore();
  const [showLabels, setShowLabels] = useState(true);
  const [selected, setSelected] = useState<WikiPage | null>(null);

  const edges = useMemo(() => extractEdges(pages), [pages]);
  const positions = useMemo(() => forceLayout(pages.length, edges, CW, CH), [pages.length, edges]);

  const handleNodePress = useCallback(
    (page: WikiPage) => setSelected((prev) => (prev?.id === page.id ? null : page)),
    []
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={22} color={Colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.headerMid}>
          <Text style={styles.headerTitle}>知识图谱</Text>
          <Text style={styles.headerSub}>{pages.length} 页面 · {edges.length} 连接</Text>
        </View>
        <TouchableOpacity
          style={[styles.labelBtn, showLabels && styles.labelBtnActive]}
          onPress={() => setShowLabels((v) => !v)}
        >
          <Text style={[styles.labelBtnText, showLabels && styles.labelBtnTextActive]}>标签</Text>
        </TouchableOpacity>
      </View>

      {pages.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>暂无页面，请先创建 Wiki 页面</Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          scrollEnabled
          maximumZoomScale={3}
          minimumZoomScale={0.5}
          contentContainerStyle={{ width: CW, height: CH }}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          bouncesZoom
          style={{ flex: 1 }}
        >
          <View style={{ width: CW, height: CH }}>
            {/* SVG layer: edges + circles + labels */}
            <Svg width={CW} height={CH} style={StyleSheet.absoluteFillObject}>
              {edges.map(([a, b], i) => {
                const pa = positions[a];
                const pb = positions[b];
                if (!pa || !pb) return null;
                return (
                  <Line
                    key={`e${i}`}
                    x1={pa.x}
                    y1={pa.y}
                    x2={pb.x}
                    y2={pb.y}
                    stroke={Colors.border}
                    strokeWidth={1.2}
                    opacity={0.55}
                  />
                );
              })}

              {pages.map((page, i) => {
                const pos = positions[i];
                if (!pos) return null;
                const color = CAT_COLOR[page.category] ?? Colors.primary;
                const isSelected = selected?.id === page.id;
                return (
                  <React.Fragment key={page.id}>
                    <Circle
                      cx={pos.x}
                      cy={pos.y}
                      r={isSelected ? 18 : 13}
                      fill={color}
                      opacity={isSelected ? 1 : 0.85}
                      stroke={isSelected ? '#fff' : 'transparent'}
                      strokeWidth={2}
                    />
                    {showLabels && (
                      <SvgText
                        x={pos.x}
                        y={pos.y + 27}
                        textAnchor="middle"
                        fontSize={9}
                        fill={Colors.text.secondary}
                        fontWeight="600"
                      >
                        {page.title.length > 8 ? page.title.slice(0, 8) + '…' : page.title}
                      </SvgText>
                    )}
                  </React.Fragment>
                );
              })}
            </Svg>

            {/* Touch targets overlay */}
            {pages.map((page, i) => {
              const pos = positions[i];
              if (!pos) return null;
              return (
                <TouchableOpacity
                  key={`t${page.id}`}
                  style={[styles.nodeTouch, { left: pos.x - 18, top: pos.y - 18 }]}
                  onPress={() => handleNodePress(page)}
                  activeOpacity={0.7}
                />
              );
            })}
          </View>
        </ScrollView>
      )}

      {/* Selected page info bar */}
      {selected && (
        <TouchableOpacity
          style={styles.selectedBar}
          onPress={() => navigation.navigate('WikiDetail', { pageId: selected.filePath })}
          activeOpacity={0.85}
        >
          <View style={[styles.selectedDot, { backgroundColor: CAT_COLOR[selected.category] ?? Colors.primary }]} />
          <View style={styles.selectedInfo}>
            <Text style={styles.selectedTitle} numberOfLines={1}>{selected.title}</Text>
            <Text style={styles.selectedMeta}>
              {CategoryLabels[selected.category] ?? selected.category} · 点击进入页面
            </Text>
          </View>
          <Text style={styles.selectedArrow}>→</Text>
        </TouchableOpacity>
      )}

      {/* Legend */}
      <View style={styles.legend}>
        {LEGEND_CATS.map((cat) => (
          <View key={cat} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: CAT_COLOR[cat] }]} />
            <Text style={styles.legendLabel}>{CategoryLabels[cat] ?? cat}</Text>
          </View>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
    gap: 10,
  },
  backBtn: { padding: 4 },
  headerMid: { flex: 1 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: Colors.text.primary },
  headerSub: { fontSize: 12, color: Colors.text.secondary, marginTop: 1 },
  labelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  labelBtnActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  labelBtnText: { fontSize: 12, fontWeight: '600', color: Colors.text.secondary },
  labelBtnTextActive: { color: Colors.primary },

  empty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 15, color: Colors.text.secondary },

  nodeTouch: { position: 'absolute', width: 36, height: 36, borderRadius: 18 },

  selectedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.primaryLight,
    borderTopWidth: 0.5,
    borderTopColor: Colors.primary + '40',
    gap: 10,
  },
  selectedDot: { width: 12, height: 12, borderRadius: 6 },
  selectedInfo: { flex: 1 },
  selectedTitle: { fontSize: 15, fontWeight: '700', color: Colors.primary },
  selectedMeta: { fontSize: 12, color: Colors.primaryDark, marginTop: 1 },
  selectedArrow: { fontSize: 18, color: Colors.primary },

  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 12,
    borderTopWidth: 0.5,
    borderTopColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontSize: 11, color: Colors.text.secondary, fontWeight: '500' },
});
