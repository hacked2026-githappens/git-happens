import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
<<<<<<< Updated upstream
=======
  Alert,
  Pressable,
>>>>>>> Stashed changes
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/auth';
import { fetchSessions } from '@/lib/database';

const palette = {
  accent: '#d1652c',
  accentDeep: '#b54f1b',
  mint: '#17998a',
  lightCanvas: '#f6ede2',
  darkCanvas: '#1b1510',
  lightCard: '#fff8ee',
  darkCard: '#2a211b',
  borderLight: '#e7c9a4',
  borderDark: 'rgba(255, 214, 168, 0.28)',
};

const PRESET_COLORS: Record<string, string> = {
  general: '#8a7560',
  pitch: '#d1652c',
  classroom: '#17998a',
  interview: '#3577ba',
  keynote: '#9b5f1f',
};

const SCORE_COLORS = {
  clarity: '#17998a',
  confidence: '#d1652c',
  structure: '#3577ba',
};

<<<<<<< Updated upstream
=======
// ── Analytics constants ───────────────────────────────────────────────────────

type MetricType = 'scores' | 'pace' | 'filler' | 'nonverbal';
type PresetFilter = 'all' | 'general' | 'pitch' | 'classroom' | 'interview' | 'keynote';

const PRESET_OPTIONS: PresetFilter[] = ['all', 'general', 'pitch', 'classroom', 'interview', 'keynote'];

const PERIOD_OPTIONS: { label: string; days: number }[] = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
  { label: 'All', days: 0 },
];

const METRIC_TABS: { key: MetricType; label: string }[] = [
  { key: 'scores', label: 'Scores' },
  { key: 'pace', label: 'Pace' },
  { key: 'filler', label: 'Filler' },
  { key: 'nonverbal', label: 'Non-verbal' },
];

const NON_VERBAL_COLORS = {
  gesture_energy: '#9b5f1f',
  eye_contact_score: '#3577ba',
  posture_stability: '#17998a',
};

// ── Series config ─────────────────────────────────────────────────────────────

type Annotation = { time: number; label: string; message: string };

>>>>>>> Stashed changes
type Session = {
  id: string;
  created_at: string;
  preset: string;
  wpm: number | null;
  pace_label: string | null;
  filler_count: number | null;
  duration_s: number | null;
  scores: Record<string, number> | null;
  strengths: string[] | null;
  improvements: { title: string; detail: string }[] | null;
  transcript: string | null;
  non_verbal: Record<string, any> | null;

  // ✅ Added for annotated replay
  video_uri?: string | null;
  annotations?: Annotation[] | null;
};

<<<<<<< Updated upstream
=======
type SeriesConfig = {
  key: string;
  label: string;
  color: string;
  getValue: (s: Session) => number;
  minVal: number;
  maxVal: number;
  unit: string;
  lowerIsBetter?: boolean;
};

type ReferenceLine = { value: number; color: string; label?: string };

const SERIES_BY_METRIC: Record<MetricType, SeriesConfig[]> = {
  scores: [
    { key: 'clarity', label: 'Clarity', color: SCORE_COLORS.clarity, getValue: (s) => s.scores?.clarity ?? 0, minVal: 0, maxVal: 10, unit: '/10' },
    { key: 'confidence', label: 'Confidence', color: SCORE_COLORS.confidence, getValue: (s) => s.scores?.confidence_language ?? 0, minVal: 0, maxVal: 10, unit: '/10' },
    { key: 'structure', label: 'Structure', color: SCORE_COLORS.structure, getValue: (s) => s.scores?.content_structure ?? 0, minVal: 0, maxVal: 10, unit: '/10' },
  ],
  pace: [
    { key: 'wpm', label: 'WPM', color: '#17998a', getValue: (s) => s.wpm ?? 0, minVal: 0, maxVal: 240, unit: ' WPM' },
  ],
  filler: [
    {
      key: 'density',
      label: 'Fillers/min',
      color: '#d1652c',
      getValue: (s) => {
        const mins = s.duration_s != null && s.duration_s > 0 ? s.duration_s / 60 : null;
        return mins != null ? (s.filler_count ?? 0) / mins : (s.filler_count ?? 0);
      },
      minVal: 0,
      maxVal: 15,
      unit: '/min',
      lowerIsBetter: true,
    },
  ],
  nonverbal: [
    { key: 'gesture_energy', label: 'Gesture', color: NON_VERBAL_COLORS.gesture_energy, getValue: (s) => s.non_verbal?.gesture_energy ?? 0, minVal: 0, maxVal: 10, unit: '/10' },
    { key: 'eye_contact_score', label: 'Eye contact', color: NON_VERBAL_COLORS.eye_contact_score, getValue: (s) => s.non_verbal?.eye_contact_score ?? 0, minVal: 0, maxVal: 10, unit: '/10' },
    { key: 'posture_stability', label: 'Posture', color: NON_VERBAL_COLORS.posture_stability, getValue: (s) => s.non_verbal?.posture_stability ?? 0, minVal: 0, maxVal: 10, unit: '/10' },
  ],
};

const REFERENCE_LINES: Record<MetricType, ReferenceLine[]> = {
  scores: [{ value: 7, color: 'rgba(23,153,138,0.3)' }],
  pace: [{ value: 120, color: 'rgba(23,153,138,0.35)', label: '120' }, { value: 180, color: 'rgba(23,153,138,0.35)', label: '180' }],
  filler: [{ value: 2, color: 'rgba(23,153,138,0.35)', label: '2' }, { value: 5, color: 'rgba(245,166,35,0.35)', label: '5' }],
  nonverbal: [{ value: 7, color: 'rgba(23,153,138,0.3)' }],
};

const DEFAULT_ACTIVE_LINES: Record<MetricType, string[]> = {
  scores: ['clarity', 'confidence', 'structure'],
  pace: ['wpm'],
  filler: ['density'],
  nonverbal: ['gesture_energy', 'eye_contact_score', 'posture_stability'],
};

// ─────────────────────────────────────────────────────────────────────────────

>>>>>>> Stashed changes
function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

<<<<<<< Updated upstream
/** Bar chart row: label + filled bar + value */
function ScoreBar({
  label,
  value,
  color,
=======
// ── Filter bar ────────────────────────────────────────────────────────────────

function FilterBar({
  presetFilter,
  onPresetChange,
  periodFilter,
  onPeriodChange,
>>>>>>> Stashed changes
  isDark,
}: {
  label: string;
  value: number;
  color: string;
  isDark: boolean;
}) {
<<<<<<< Updated upstream
  const pct = Math.max(0, Math.min(value / 10, 1));
  return (
    <View style={chartStyles.barRow}>
      <ThemedText style={chartStyles.barLabel}>{label}</ThemedText>
      <View style={[chartStyles.barTrack, isDark && chartStyles.barTrackDark]}>
        <View style={[chartStyles.barFill, { width: `${pct * 100}%` as any, backgroundColor: color }]} />
      </View>
      <ThemedText style={[chartStyles.barValue, { color }]}>{value}/10</ThemedText>
=======
  return (
    <View style={filterStyles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={filterStyles.pillRow}>
        {PRESET_OPTIONS.map((p) => {
          const isActive = presetFilter === p;
          const color = p === 'all' ? palette.accent : (PRESET_COLORS[p] ?? palette.accent);
          return (
            <Pressable
              key={p}
              onPress={() => onPresetChange(p)}
              style={[
                filterStyles.pill,
                isDark && filterStyles.pillDark,
                isActive && { backgroundColor: color, borderColor: color },
              ]}>
              <ThemedText style={[filterStyles.pillText, isActive && filterStyles.pillTextActive]}>
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </ThemedText>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={filterStyles.pillRow}>
        {PERIOD_OPTIONS.map(({ label, days }) => {
          const isActive = periodFilter === days;
          return (
            <Pressable
              key={label}
              onPress={() => onPeriodChange(days)}
              style={[
                filterStyles.pill,
                isDark && filterStyles.pillDark,
                isActive && { backgroundColor: palette.accent, borderColor: palette.accent },
              ]}>
              <ThemedText style={[filterStyles.pillText, isActive && filterStyles.pillTextActive]}>
                {label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
>>>>>>> Stashed changes
    </View>
  );
}

<<<<<<< Updated upstream
/** Mini line-like chart using vertical bars per session */
function TrendChart({
  sessions,
  isDark,
}: {
  sessions: Session[];
  isDark: boolean;
}) {
  const recent = sessions.slice(0, 10).reverse();
  if (recent.length < 2) return null;

  const entries = recent.map((s) => ({
    date: formatDate(s.created_at),
    clarity: s.scores?.clarity ?? 0,
    confidence: s.scores?.confidence_language ?? 0,
    structure: s.scores?.content_structure ?? 0,
  }));

  return (
    <View style={chartStyles.trendContainer}>
      <ThemedText style={chartStyles.trendTitle}>Score trends (last {entries.length} sessions)</ThemedText>
      <View style={chartStyles.trendLegend}>
        {(
          [
            { key: 'clarity', label: 'Clarity', color: SCORE_COLORS.clarity },
            { key: 'confidence', label: 'Confidence', color: SCORE_COLORS.confidence },
            { key: 'structure', label: 'Structure', color: SCORE_COLORS.structure },
          ] as const
        ).map(({ key, label, color }) => (
          <View key={key} style={chartStyles.legendItem}>
            <View style={[chartStyles.legendDot, { backgroundColor: color }]} />
            <ThemedText style={chartStyles.legendLabel}>{label}</ThemedText>
          </View>
        ))}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={chartStyles.trendChart}>
          {entries.map((entry, index) => (
            <View key={index} style={chartStyles.trendColumn}>
              <View style={chartStyles.trendBars}>
                {(
                  [
                    { val: entry.clarity, color: SCORE_COLORS.clarity },
                    { val: entry.confidence, color: SCORE_COLORS.confidence },
                    { val: entry.structure, color: SCORE_COLORS.structure },
                  ] as const
                ).map(({ val, color }, barIndex) => (
                  <View key={barIndex} style={chartStyles.trendBarTrack}>
                    <View
                      style={[
                        chartStyles.trendBarFill,
                        {
                          height: `${(val / 10) * 100}%` as any,
                          backgroundColor: color,
                        },
                      ]}
                    />
                  </View>
                ))}
              </View>
              <ThemedText
                style={[chartStyles.trendDateLabel, isDark && chartStyles.trendDateLabelDark]}
                numberOfLines={1}>
                {entry.date.split(',')[0]}
              </ThemedText>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function SessionCard({ session, isDark }: { session: Session; isDark: boolean }) {
=======
// ── Metric tabs ───────────────────────────────────────────────────────────────

function MetricTabs({ active, onChange, isDark }: { active: MetricType; onChange: (m: MetricType) => void; isDark: boolean }) {
  return (
    <View style={[filterStyles.tabRow, isDark && filterStyles.tabRowDark]}>
      {METRIC_TABS.map(({ key, label }) => {
        const isActive = active === key;
        return (
          <Pressable key={key} onPress={() => onChange(key)} style={[filterStyles.tab, isActive && filterStyles.tabActive]}>
            <ThemedText style={[filterStyles.tabText, isActive && filterStyles.tabTextActive]}>{label}</ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

// ── Line chart ────────────────────────────────────────────────────────────────

const CHART_H = 160;
const PAD = { top: 8, bottom: 30, left: 28, right: 4 };

function LineChart({
  sessions,
  allSeries,
  activeKeys,
  referenceLines,
  isDark,
}: {
  sessions: Session[];
  allSeries: SeriesConfig[];
  activeKeys: string[];
  referenceLines: ReferenceLine[];
  isDark: boolean;
}) {
  const [containerW, setContainerW] = useState(0);

  if (sessions.length < 1 || containerW === 0) {
    return (
      <View
        style={{ height: CHART_H }}
        onLayout={(e) => setContainerW(e.nativeEvent.layout.width)}
      />
    );
  }

  const cW = containerW - PAD.left - PAD.right;
  const cH = CHART_H - PAD.top - PAD.bottom;
  const n = sessions.length;

  const { minVal, maxVal } = allSeries[0];

  const getX = (i: number) => (n <= 1 ? cW / 2 : (i / (n - 1)) * cW);
  const getY = (val: number) => cH - Math.max(0, Math.min((val - minVal) / (maxVal - minVal), 1)) * cH;

  const ticks = [0, 0.33, 0.67, 1].map((pct) => minVal + pct * (maxVal - minVal));

  const activeSeries = allSeries.filter((s) => activeKeys.includes(s.key));
  const gridColor = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
  const cardBg = isDark ? palette.darkCard : palette.lightCard;

  return (
    <View
      style={{ height: CHART_H, position: 'relative' }}
      onLayout={(e) => setContainerW(e.nativeEvent.layout.width)}>

      {ticks.map((val, i) => (
        <ThemedText
          key={i}
          style={{
            position: 'absolute',
            left: 0,
            top: PAD.top + getY(val) - 7,
            width: PAD.left - 5,
            fontSize: 9,
            textAlign: 'right',
            opacity: 0.45,
            fontFamily: Fonts.rounded,
          }}>
          {Math.round(val)}
        </ThemedText>
      ))}

      <View
        style={{
          position: 'absolute',
          left: PAD.left,
          top: PAD.top,
          width: cW,
          height: cH,
        }}>

        {ticks.map((val, i) => (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: getY(val),
              height: 1,
              backgroundColor: gridColor,
            }}
          />
        ))}

        {referenceLines.map((ref, i) => {
          if (ref.value < minVal || ref.value > maxVal) return null;
          return (
            <View key={i} style={{ position: 'absolute', left: 0, right: 0, top: getY(ref.value), height: 1.5, backgroundColor: ref.color }}>
              {ref.label != null && (
                <ThemedText style={{ position: 'absolute', right: 2, top: -10, fontSize: 8, opacity: 0.7 }}>
                  {ref.label}
                </ThemedText>
              )}
            </View>
          );
        })}

        {activeSeries.map(({ key, color, getValue }) => {
          const points = sessions.map((s, i) => ({ x: getX(i), y: getY(getValue(s)) }));
          return (
            <View key={key} style={StyleSheet.absoluteFill} pointerEvents="none">
              {points.slice(0, -1).map((p, i) => {
                const next = points[i + 1];
                const dx = next.x - p.x;
                const dy = next.y - p.y;
                const len = Math.sqrt(dx * dx + dy * dy);
                const angle = Math.atan2(dy, dx) * (180 / Math.PI);
                return (
                  <View
                    key={i}
                    style={{
                      position: 'absolute',
                      left: p.x + dx / 2 - len / 2,
                      top: p.y + dy / 2 - 1.5,
                      width: len,
                      height: 3,
                      backgroundColor: color,
                      borderRadius: 2,
                      transform: [{ rotate: `${angle}deg` }],
                    }}
                  />
                );
              })}
              {points.map((p, i) => (
                <View
                  key={i}
                  style={{
                    position: 'absolute',
                    left: p.x - 5,
                    top: p.y - 5,
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: color,
                    borderWidth: 2,
                    borderColor: cardBg,
                  }}
                />
              ))}
            </View>
          );
        })}

        {sessions.map((s, i) => (
          <ThemedText
            key={i}
            numberOfLines={1}
            style={{
              position: 'absolute',
              left: getX(i) - 21,
              top: cH + 6,
              width: 42,
              fontSize: 9,
              textAlign: 'center',
              opacity: 0.5,
            }}>
            {formatDate(s.created_at).split(',')[0]}
          </ThemedText>
        ))}
      </View>
    </View>
  );
}

// ── Metric checkboxes ─────────────────────────────────────────────────────────

function MetricCheckboxes({
  allSeries,
  activeKeys,
  onToggle,
  isDark,
}: {
  allSeries: SeriesConfig[];
  activeKeys: string[];
  onToggle: (key: string) => void;
  isDark: boolean;
}) {
  return (
    <View style={checkboxStyles.container}>
      {allSeries.map(({ key, label, color }) => {
        const isActive = activeKeys.includes(key);
        return (
          <Pressable key={key} onPress={() => onToggle(key)} style={checkboxStyles.row}>
            <View style={[checkboxStyles.box, { borderColor: color }, isActive && { backgroundColor: color }]}>
              {isActive && <Ionicons name="checkmark" size={10} color="#fff" />}
            </View>
            <ThemedText
              numberOfLines={1}
              style={[checkboxStyles.label, { color }, !isActive && checkboxStyles.labelInactive]}>
              {label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

// ── Improvement summary ───────────────────────────────────────────────────────

function ImprovementSummary({
  sessions,
  activeSeries,
  isDark,
}: {
  sessions: Session[];
  activeSeries: SeriesConfig[];
  isDark: boolean;
}) {
  if (sessions.length < 2) {
    return (
      <View style={[summaryStyles.container, isDark && summaryStyles.containerDark]}>
        <ThemedText style={summaryStyles.notEnoughText}>Add more sessions to see improvement trends.</ThemedText>
      </View>
    );
  }

  const first = sessions[0];
  const last = sessions[sessions.length - 1];

  return (
    <View style={[summaryStyles.container, isDark && summaryStyles.containerDark]}>
      <ThemedText style={summaryStyles.title}>Progress: first session vs. latest</ThemedText>
      {activeSeries.map(({ key, label, color, getValue, unit, lowerIsBetter }) => {
        const f = getValue(first);
        const l = getValue(last);
        const diff = l - f;
        const improved = lowerIsBetter ? diff < 0 : diff > 0;
        const declined = lowerIsBetter ? diff > 0 : diff < 0;
        const deltaColor = improved ? '#17998a' : declined ? '#e74c3c' : (isDark ? '#c7b5a2' : '#8a7560');
        const icon: any = improved ? 'arrow-up-circle' : declined ? 'arrow-down-circle' : 'remove-circle-outline';
        const pct = f !== 0 ? Math.round(Math.abs(diff / f) * 100) : null;

        return (
          <View key={key} style={summaryStyles.row}>
            <View style={[summaryStyles.rowDot, { backgroundColor: color }]} />
            <ThemedText style={summaryStyles.rowLabel}>{label}</ThemedText>
            <ThemedText style={summaryStyles.rowValues}>
              {f.toFixed(1)}{unit} → {l.toFixed(1)}{unit}
            </ThemedText>
            <View style={summaryStyles.badgeRow}>
              <Ionicons name={icon} size={15} color={deltaColor} />
              <ThemedText style={[summaryStyles.badgeText, { color: deltaColor }]}>
                {diff === 0 ? 'No change' : `${diff > 0 ? '+' : ''}${diff.toFixed(1)}${pct != null ? ` (${pct}%)` : ''}`}
              </ThemedText>
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ── Session card ──────────────────────────────────────────────────────────────

function SessionCard({
  session,
  isDark,
  onOpenAnnotated,
}: {
  session: Session;
  isDark: boolean;
  onOpenAnnotated: (s: Session) => void;
}) {
  const [expanded, setExpanded] = useState(false);
>>>>>>> Stashed changes
  const presetColor = PRESET_COLORS[session.preset] ?? '#8a7560';
  const scores = session.scores;

  return (
    <View style={[cardStyles.card, isDark && cardStyles.cardDark]}>
<<<<<<< Updated upstream
      <View style={cardStyles.headerRow}>
=======
      {/* ✅ Only header toggles expand/collapse */}
      <Pressable
        onPress={() => setExpanded((v) => !v)}
        style={cardStyles.headerRow}
        hitSlop={10}
      >
>>>>>>> Stashed changes
        <View>
          <ThemedText style={cardStyles.dateText}>{formatDate(session.created_at)}</ThemedText>
          <ThemedText style={cardStyles.timeText}>{formatTime(session.created_at)}</ThemedText>
        </View>
<<<<<<< Updated upstream
        <View style={[cardStyles.presetBadge, { backgroundColor: presetColor + '22', borderColor: presetColor + '55' }]}>
          <ThemedText style={[cardStyles.presetBadgeText, { color: presetColor }]}>
            {session.preset.charAt(0).toUpperCase() + session.preset.slice(1)}
          </ThemedText>
=======

        <View style={cardStyles.headerRight}>
          <View style={[cardStyles.presetBadge, { backgroundColor: presetColor + '22', borderColor: presetColor + '55' }]}>
            <ThemedText style={[cardStyles.presetBadgeText, { color: presetColor }]}>
              {session.preset.charAt(0).toUpperCase() + session.preset.slice(1)}
            </ThemedText>
          </View>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={isDark ? '#c7b5a2' : '#8a7560'}
          />
>>>>>>> Stashed changes
        </View>
      </Pressable>

      {session.wpm != null && (
        <View style={cardStyles.statRow}>
          <Ionicons name="speedometer-outline" size={14} color={palette.accentDeep} />
          <ThemedText style={cardStyles.statText}>
            {Math.round(session.wpm)} WPM · {session.pace_label ?? '—'}
          </ThemedText>
          {session.filler_count != null && session.filler_count > 0 && (
            <>
              <ThemedText style={cardStyles.statSep}>·</ThemedText>
              <Ionicons name="chatbubble-ellipses-outline" size={14} color={palette.accentDeep} />
              <ThemedText style={cardStyles.statText}>{session.filler_count} fillers</ThemedText>
            </>
          )}
        </View>
      )}

      {scores && (
        <View style={cardStyles.scoresRow}>
          {[
            { label: 'Clarity', value: scores.clarity, color: SCORE_COLORS.clarity },
            { label: 'Confidence', value: scores.confidence_language, color: SCORE_COLORS.confidence },
            { label: 'Structure', value: scores.content_structure, color: SCORE_COLORS.structure },
          ].map(({ label, value, color }) =>
            value != null ? (
              <View key={label} style={[cardStyles.scoreChip, { borderColor: color + '55' }]}>
                <ThemedText style={[cardStyles.scoreChipValue, { color }]}>{value}</ThemedText>
                <ThemedText style={cardStyles.scoreChipLabel}>{label}</ThemedText>
              </View>
            ) : null,
          )}
        </View>
      )}

      {!!session.strengths?.length && (
        <View style={cardStyles.listRow}>
          <Ionicons name="checkmark-circle-outline" size={14} color={palette.mint} />
          <ThemedText style={cardStyles.listText} numberOfLines={2}>
            {session.strengths[0]}
          </ThemedText>
        </View>
      )}

      {!!session.improvements?.length && (
        <View style={cardStyles.listRow}>
          <Ionicons name="alert-circle-outline" size={14} color={palette.accent} />
          <ThemedText style={cardStyles.listText} numberOfLines={2}>
            {session.improvements[0].title}: {session.improvements[0].detail}
          </ThemedText>
        </View>
      )}
<<<<<<< Updated upstream
=======

      {/* ✅ Button now receives taps properly */}
      {expanded && (
        <Pressable
          onPress={() => {
            console.log('Watch with Annotations pressed:', session.id);
            onOpenAnnotated(session);
          }}
          style={[cardStyles.annotBtn, isDark && cardStyles.annotBtnDark]}
          hitSlop={10}
        >
          <Ionicons name="play-circle-outline" size={18} color="#fff" />
          <ThemedText style={cardStyles.annotBtnText}>Watch with Annotations</ThemedText>
        </Pressable>
      )}
>>>>>>> Stashed changes
    </View>
  );
}

export default function HistoryScreen() {
  const { user } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';

  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

<<<<<<< Updated upstream
=======
  const [presetFilter, setPresetFilter] = useState<PresetFilter>('all');
  const [periodFilter, setPeriodFilter] = useState<number>(0);
  const [activeMetric, setActiveMetric] = useState<MetricType>('scores');
  const [activeLines, setActiveLines] = useState<Record<MetricType, string[]>>(DEFAULT_ACTIVE_LINES);

  const toggleLine = useCallback(
    (key: string) => {
      setActiveLines((prev) => {
        const current = prev[activeMetric];
        if (current.includes(key) && current.length === 1) return prev;
        const next = current.includes(key) ? current.filter((k) => k !== key) : [...current, key];
        return { ...prev, [activeMetric]: next };
      });
    },
    [activeMetric],
  );

  const filteredSessions = useMemo(() => {
    let result = [...sessions];
    if (presetFilter !== 'all') result = result.filter((s) => s.preset === presetFilter);
    if (periodFilter > 0) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - periodFilter);
      result = result.filter((s) => new Date(s.created_at) >= cutoff);
    }
    result.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    return result;
  }, [sessions, presetFilter, periodFilter]);

  const chartSessions = useMemo(() => filteredSessions.slice(-10), [filteredSessions]);

  const currentSeries = SERIES_BY_METRIC[activeMetric];
  const currentActiveKeys = activeLines[activeMetric];
  const activeSeries = currentSeries.filter((s) => currentActiveKeys.includes(s.key));

  const isNonverbalEmpty =
    activeMetric === 'nonverbal' &&
    !chartSessions.some(
      (s) =>
        s.non_verbal?.gesture_energy != null ||
        s.non_verbal?.eye_contact_score != null ||
        s.non_verbal?.posture_stability != null,
    );

>>>>>>> Stashed changes
  const load = useCallback(
    async (silent = false) => {
      if (!user) return;
      if (!silent) setLoading(true);
      setError(null);

      const { data, error: fetchError } = await fetchSessions(user.id);
      if (fetchError) {
        setError(fetchError.message);
      } else {
        setSessions((data as Session[]) ?? []);
      }

      setLoading(false);
      setRefreshing(false);
    },
    [user],
  );

<<<<<<< Updated upstream
  useEffect(() => {
    load();
  }, [load]);

  // Reload when tab gains focus
  useFocusEffect(
    useCallback(() => {
      load(true);
    }, [load]),
  );
=======
  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(true); }, [load]));
>>>>>>> Stashed changes

  const onRefresh = () => {
    setRefreshing(true);
    load(true);
  };

  // ✅ Navigation handler
  const openAnnotated = (s: Session) => {
    console.log("video_uri:", s.video_uri);
    console.log("annotations:", s.annotations);

    if (!s.video_uri) {
      Alert.alert('No video found', 'This session does not have a saved video to replay.');
      return;
    }

    const anns: Annotation[] = s.annotations ?? [];

    router.push({
      pathname: '/annotated',
      params: {
        videoUri: s.video_uri,
        annotations: JSON.stringify(anns),
      },
    });
  };

  const canvas = isDark ? palette.darkCanvas : palette.lightCanvas;
  const card = isDark ? palette.darkCard : palette.lightCard;

  if (loading) {
    return (
      <ThemedView style={[styles.centered, { backgroundColor: canvas }]}>
        <ActivityIndicator size="large" color={palette.accent} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.root, { backgroundColor: canvas }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.accent} />}>
        <View style={styles.pageHeader}>
          <ThemedText style={styles.pageTitle}>Session History</ThemedText>
          <ThemedText style={styles.pageSubtitle}>
<<<<<<< Updated upstream
            {sessions.length > 0
              ? `${sessions.length} session${sessions.length === 1 ? '' : 's'} recorded`
              : 'No sessions yet'}
=======
            {sessions.length === 0
              ? 'No sessions yet'
              : filteredSessions.length === sessions.length
                ? `${sessions.length} session${sessions.length === 1 ? '' : 's'} recorded`
                : `${filteredSessions.length} of ${sessions.length} sessions`}
>>>>>>> Stashed changes
          </ThemedText>
        </View>

        {error && (
          <View style={[styles.errorBox, isDark && styles.errorBoxDark]}>
            <Ionicons name="warning-outline" size={16} color="#9a2f1f" />
            <ThemedText style={styles.errorText}>{error}</ThemedText>
          </View>
        )}

<<<<<<< Updated upstream
        {sessions.length >= 2 && (
=======
        {sessions.length > 0 && (
          <FilterBar
            presetFilter={presetFilter}
            onPresetChange={setPresetFilter}
            periodFilter={periodFilter}
            onPeriodChange={setPeriodFilter}
            isDark={isDark}
          />
        )}

        {filteredSessions.length >= 1 && (
>>>>>>> Stashed changes
          <View style={[styles.chartCard, isDark && styles.chartCardDark]}>
            <TrendChart sessions={sessions} isDark={isDark} />
          </View>
        )}

        {sessions.length === 0 && !error && (
          <View style={[styles.emptyBox, isDark && styles.emptyBoxDark]}>
            <Ionicons name="analytics-outline" size={40} color={palette.accent} style={styles.emptyIcon} />
            <ThemedText style={styles.emptyTitle}>No sessions yet</ThemedText>
            <ThemedText style={styles.emptyText}>
              Run AI Coach on a practice clip to start tracking your progress here.
            </ThemedText>
          </View>
        )}

<<<<<<< Updated upstream
        {sessions.map((session) => (
          <SessionCard key={session.id} session={session} isDark={isDark} />
=======
        {sessions.length > 0 && filteredSessions.length === 0 && (
          <View style={[styles.emptyBox, isDark && styles.emptyBoxDark]}>
            <Ionicons name="filter-outline" size={36} color={palette.accent} style={styles.emptyIcon} />
            <ThemedText style={styles.emptyTitle}>No matching sessions</ThemedText>
            <ThemedText style={styles.emptyText}>Try a different preset or time period.</ThemedText>
          </View>
        )}

        {[...filteredSessions].reverse().map((session) => (
          <SessionCard
            key={session.id}
            session={session}
            isDark={isDark}
            onOpenAnnotated={openAnnotated}
          />
>>>>>>> Stashed changes
        ))}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: 18,
    paddingTop: 60,
    paddingBottom: 100,
    gap: 14,
    maxWidth: 900,
    width: '100%',
    alignSelf: 'center',
  },
  pageHeader: {
    gap: 4,
    marginBottom: 6,
  },
  pageTitle: {
    fontFamily: Fonts.rounded,
    fontSize: 28,
  },
  pageSubtitle: {
    fontSize: 14,
    opacity: 0.7,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#f8ddd8',
    borderWidth: 1,
    borderColor: '#f0b8ae',
<<<<<<< Updated upstream
  },
  errorBoxDark: {
    backgroundColor: 'rgba(154, 47, 31, 0.2)',
    borderColor: 'rgba(240, 184, 174, 0.3)',
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: '#9a2f1f',
=======
>>>>>>> Stashed changes
  },
  chartCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.borderLight,
    backgroundColor: '#fff8ee',
    padding: 16,
<<<<<<< Updated upstream
  },
  chartCardDark: {
    backgroundColor: '#2a211b',
    borderColor: palette.borderDark,
=======
>>>>>>> Stashed changes
  },
  emptyBox: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.borderLight,
    backgroundColor: '#fff8ee',
    padding: 32,
    alignItems: 'center',
    gap: 10,
<<<<<<< Updated upstream
  },
  emptyBoxDark: {
    backgroundColor: '#2a211b',
    borderColor: palette.borderDark,
  },
  emptyIcon: {
    marginBottom: 4,
  },
  emptyTitle: {
    fontFamily: Fonts.rounded,
    fontSize: 20,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    opacity: 0.75,
    maxWidth: 280,
=======
>>>>>>> Stashed changes
  },
});

const chartStyles = StyleSheet.create({
  trendContainer: {
    gap: 12,
  },
  trendTitle: {
    fontFamily: Fonts.rounded,
    fontSize: 15,
  },
  trendLegend: {
    flexDirection: 'row',
    gap: 14,
    flexWrap: 'wrap',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendLabel: {
    fontSize: 12,
    opacity: 0.85,
  },
  trendChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    height: 110,
    paddingBottom: 24,
  },
  trendColumn: {
    alignItems: 'center',
    width: 42,
    gap: 4,
  },
<<<<<<< Updated upstream
  trendBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    height: 80,
=======
  noDataBox: { alignItems: 'center', gap: 10, paddingVertical: 24 },
  noDataText: { fontSize: 13, opacity: 0.75, textAlign: 'center', maxWidth: 260, lineHeight: 19 },
});

const filterStyles = StyleSheet.create({
  container: { gap: 8 },
  pillRow: { flexDirection: 'row', gap: 6 },
  pill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: palette.borderLight },
  pillDark: { borderColor: palette.borderDark },
  pillText: { fontFamily: Fonts.rounded, fontSize: 13, opacity: 0.75 },
  pillTextActive: { color: '#fff', opacity: 1 },
  tabRow: {
    flexDirection: 'row',
    borderRadius: 12,
    backgroundColor: 'rgba(47,34,25,0.08)',
    padding: 3,
    gap: 2,
    marginBottom: 14,
>>>>>>> Stashed changes
  },
  trendBarTrack: {
    width: 10,
    height: 80,
    backgroundColor: 'rgba(47, 34, 25, 0.1)',
    borderRadius: 4,
    justifyContent: 'flex-end',
  },
<<<<<<< Updated upstream
  trendBarFill: {
    width: '100%',
    borderRadius: 4,
  },
  trendDateLabel: {
    fontSize: 9,
    opacity: 0.65,
    textAlign: 'center',
  },
  trendDateLabelDark: {
    opacity: 0.5,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  barLabel: {
    width: 72,
    fontSize: 13,
    fontFamily: Fonts.rounded,
  },
  barTrack: {
    flex: 1,
    height: 10,
    borderRadius: 99,
    backgroundColor: 'rgba(47, 34, 25, 0.12)',
    overflow: 'hidden',
  },
  barTrackDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  barFill: {
    height: '100%',
    borderRadius: 99,
  },
  barValue: {
    width: 40,
    fontSize: 12,
    fontFamily: Fonts.rounded,
    textAlign: 'right',
=======
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  box: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  label: { fontFamily: Fonts.rounded, fontSize: 12, flexShrink: 1 },
  labelInactive: { opacity: 0.35 },
});

const summaryStyles = StyleSheet.create({
  container: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: palette.borderLight,
    gap: 8,
>>>>>>> Stashed changes
  },
});

const cardStyles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.borderLight,
    backgroundColor: '#fff8ee',
    padding: 16,
    gap: 10,
<<<<<<< Updated upstream
  },
  cardDark: {
    backgroundColor: '#2a211b',
    borderColor: palette.borderDark,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  dateText: {
    fontFamily: Fonts.rounded,
    fontSize: 15,
  },
  timeText: {
    fontSize: 12,
    opacity: 0.65,
    marginTop: 2,
  },
  presetBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  presetBadgeText: {
    fontFamily: Fonts.rounded,
    fontSize: 12,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statText: {
    fontSize: 13,
  },
  statSep: {
    opacity: 0.4,
  },
  scoresRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  scoreChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    gap: 2,
  },
  scoreChipValue: {
    fontFamily: Fonts.rounded,
    fontSize: 16,
    lineHeight: 20,
  },
  scoreChipLabel: {
    fontSize: 11,
    opacity: 0.75,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  listText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    opacity: 0.9,
  },
});
=======
  },
  cardDark: { backgroundColor: '#2a211b', borderColor: palette.borderDark },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateText: { fontFamily: Fonts.rounded, fontSize: 15 },
  timeText: { fontSize: 12, opacity: 0.65, marginTop: 2 },
  presetBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  presetBadgeText: { fontFamily: Fonts.rounded, fontSize: 12 },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statText: { fontSize: 13 },
  statSep: { opacity: 0.4 },
  scoresRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  scoreChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1, alignItems: 'center', gap: 2 },
  scoreChipValue: { fontFamily: Fonts.rounded, fontSize: 16, lineHeight: 20 },
  scoreChipLabel: { fontSize: 11, opacity: 0.75 },
  listRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  listText: { flex: 1, fontSize: 13, lineHeight: 19, opacity: 0.9 },

  // ✅ New button styles
  annotBtn: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: palette.accent,
  },
  annotBtnDark: {
    backgroundColor: palette.accentDeep,
  },
  annotBtnText: {
    color: '#fff',
    fontFamily: Fonts.rounded,
    fontSize: 13,
  },
});
>>>>>>> Stashed changes
