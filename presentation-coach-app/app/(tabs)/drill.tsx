import React, { useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

declare global {
  interface Navigator {
    mediaDevices: any;
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

type DrillMode = 'qa' | 'filler';

type EvalResult = {
  is_correct: boolean;
  verdict: 'correct' | 'partially_correct' | 'incorrect' | 'insufficient_information';
  correctness_score: number;
  reason: string;
  missing_points: string[];
  suggested_improvement: string;
};

type FillerResult = {
  fillerCount: number;
  fillerWords: Record<string, number>;
  totalWords: number;
  success: boolean;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const BACKEND_URL =
  Platform.select({
    android: 'http://10.0.2.2:8000',
    ios: 'http://localhost:8000',
    default: 'http://localhost:8000',
  }) ?? 'http://localhost:8000';

const palette = {
  accent: '#d1652c',
  accentDeep: '#b54f1b',
  mint: '#17998a',
  lightCanvas: '#f6ede2',
  darkCanvas: '#1b1510',
  lightCard: '#fff8ee',
  darkCard: '#2a211b',
  lightInk: '#2f2219',
  darkInk: '#f2e4d1',
  borderLight: '#e7c9a4',
  borderDark: 'rgba(255, 214, 168, 0.28)',
};

const PRESETS = [
  { key: 'general', label: 'General', icon: 'mic-outline' as const },
  { key: 'interview', label: 'Interview', icon: 'briefcase-outline' as const },
  { key: 'pitch', label: 'Pitch', icon: 'trending-up-outline' as const },
  { key: 'classroom', label: 'Classroom', icon: 'school-outline' as const },
  { key: 'keynote', label: 'Keynote', icon: 'people-outline' as const },
];

const FILLER_CHALLENGE_SECONDS = 60;

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function pollResults(jobId: string): Promise<any> {
  for (let attempt = 0; attempt < 120; attempt++) {
    await new Promise((r) => setTimeout(r, 2000));
    const poll = await fetch(`${BACKEND_URL}/api/results/${jobId}`);
    if (!poll.ok) throw new Error(`Poll failed (${poll.status})`);
    const data = await poll.json();
    if (data.status === 'done') return data.results;
    if (data.status === 'error')
      throw new Error(data.error_message ?? 'Analysis failed on server');
  }
  throw new Error('Analysis timed out after 4 minutes. Please try again.');
}

async function submitVideoForTranscript(
  videoUri: string,
  preset: string,
  durationHint?: number,
): Promise<any> {
  const form = new FormData();
  if (Platform.OS === 'web') {
    const resp = await fetch(videoUri);
    const blob = await resp.blob();
    form.append('video', blob, 'drill.webm');
  } else {
    form.append('video', { uri: videoUri, name: 'drill.mp4', type: 'video/mp4' } as any);
  }
  form.append('preset', preset);
  if (durationHint != null && durationHint > 0) {
    form.append('duration_seconds', durationHint.toString());
  }
  const result = await fetch(`${BACKEND_URL}/api/analyze`, { method: 'POST', body: form });
  if (!result.ok) {
    const text = await result.text();
    throw new Error(`Backend error ${result.status}: ${text}`);
  }
  const { jobId } = await result.json();
  return pollResults(jobId);
}

// ─── Score Circle ─────────────────────────────────────────────────────────────

function ScoreCircle({ score }: { score: number }) {
  const color = score >= 70 ? palette.mint : score >= 40 ? '#e09b2d' : '#c0392b';
  return (
    <View style={[scoreCircleStyles.ring, { borderColor: color }]}>
      <ThemedText style={[scoreCircleStyles.number, { color }]}>{score}</ThemedText>
      <ThemedText style={scoreCircleStyles.label}>/100</ThemedText>
    </View>
  );
}

const scoreCircleStyles = StyleSheet.create({
  ring: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 5,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 12,
  },
  number: { fontFamily: Fonts.rounded, fontSize: 28, fontWeight: '700', lineHeight: 32 },
  label: { fontFamily: Fonts.rounded, fontSize: 12, opacity: 0.6 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function DrillScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  const ink = isDark ? palette.darkInk : palette.lightInk;
  const card = isDark ? palette.darkCard : palette.lightCard;
  const border = isDark ? palette.borderDark : palette.borderLight;
  const canvas = isDark ? palette.darkCanvas : palette.lightCanvas;

  const [mode, setMode] = useState<DrillMode>('qa');

  // ── Q&A Simulator state ────────────────────────────────────────────────────
  const [qaPreset, setQaPreset] = useState('general');
  const [qaQuestion, setQaQuestion] = useState<string | null>(null);
  const [qaQuestionBusy, setQaQuestionBusy] = useState(false);
  const [qaRecording, setQaRecording] = useState(false);
  const [qaElapsed, setQaElapsed] = useState(0);
  const [qaRecordStart, setQaRecordStart] = useState<number | null>(null);
  const [qaVideoUri, setQaVideoUri] = useState<string | null>(null);
  const [qaAnalyzing, setQaAnalyzing] = useState(false);
  const [qaResult, setQaResult] = useState<EvalResult | null>(null);

  const qaMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const qaStreamRef = useRef<MediaStream | null>(null);
  const qaPreviewRef = useRef<HTMLVideoElement | null>(null);
  const qaAutoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Q&A Simulator error state ──────────────────────────────────────────────
  const [qaError, setQaError] = useState<string | null>(null);

  // ── Filler Challenge state ─────────────────────────────────────────────────
  const [fcRecording, setFcRecording] = useState(false);
  const [fcSecondsLeft, setFcSecondsLeft] = useState(FILLER_CHALLENGE_SECONDS);
  const [fcVideoUri, setFcVideoUri] = useState<string | null>(null);
  const [fcBlobRef] = useState<{ current: Blob | null }>({ current: null });
  const [fcAnalyzing, setFcAnalyzing] = useState(false);
  const [fcResult, setFcResult] = useState<FillerResult | null>(null);
  const [fcError, setFcError] = useState<string | null>(null);

  const fcMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const fcStreamRef = useRef<MediaStream | null>(null);
  const fcPreviewRef = useRef<HTMLVideoElement | null>(null);
  const fcCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fcAutoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── QA elapsed timer ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!qaRecording || !qaRecordStart) {
      setQaElapsed(0);
      return;
    }
    const tick = setInterval(() => {
      setQaElapsed(Math.round((Date.now() - qaRecordStart) / 1000));
    }, 1000);
    return () => clearInterval(tick);
  }, [qaRecording, qaRecordStart]);

  // ── QA preview wiring ──────────────────────────────────────────────────────
  useEffect(() => {
    if (Platform.OS === 'web' && qaRecording && qaStreamRef.current && qaPreviewRef.current) {
      qaPreviewRef.current.srcObject = qaStreamRef.current;
      qaPreviewRef.current.muted = true;
      qaPreviewRef.current.play().catch(() => {});
    }
  }, [qaRecording]);

  // ── FC preview wiring ──────────────────────────────────────────────────────
  useEffect(() => {
    if (Platform.OS === 'web' && fcRecording && fcStreamRef.current && fcPreviewRef.current) {
      fcPreviewRef.current.srcObject = fcStreamRef.current;
      fcPreviewRef.current.muted = true;
      fcPreviewRef.current.play().catch(() => {});
    }
  }, [fcRecording]);

  // ── Reset helpers ──────────────────────────────────────────────────────────
  const resetQa = () => {
    setQaQuestion(null);
    setQaVideoUri(null);
    setQaResult(null);
    setQaRecording(false);
    setQaElapsed(0);
    setQaRecordStart(null);
    if (qaAutoStopRef.current) clearTimeout(qaAutoStopRef.current);
    if (qaStreamRef.current) {
      qaStreamRef.current.getTracks().forEach((t) => t.stop());
      qaStreamRef.current = null;
    }
    qaMediaRecorderRef.current = null;
    if (qaPreviewRef.current) qaPreviewRef.current.srcObject = null;
  };

  const resetAnswer = () => {
    setQaVideoUri(null);
    setQaResult(null);
    setQaRecording(false);
    setQaElapsed(0);
    setQaRecordStart(null);
    if (qaAutoStopRef.current) clearTimeout(qaAutoStopRef.current);
    if (qaStreamRef.current) {
      qaStreamRef.current.getTracks().forEach((t) => t.stop());
      qaStreamRef.current = null;
    }
    qaMediaRecorderRef.current = null;
    if (qaPreviewRef.current) qaPreviewRef.current.srcObject = null;
  };

  const resetFc = () => {
    setFcVideoUri(null);
    setFcResult(null);
    setFcError(null);
    setFcRecording(false);
    setFcSecondsLeft(FILLER_CHALLENGE_SECONDS);
    fcBlobRef.current = null;
    if (fcCountdownRef.current) clearInterval(fcCountdownRef.current);
    if (fcAutoStopRef.current) clearTimeout(fcAutoStopRef.current);
    if (fcStreamRef.current) {
      fcStreamRef.current.getTracks().forEach((t) => t.stop());
      fcStreamRef.current = null;
    }
    fcMediaRecorderRef.current = null;
    if (fcPreviewRef.current) fcPreviewRef.current.srcObject = null;
  };

  // ── Get Question ───────────────────────────────────────────────────────────
  const getQuestion = async () => {
    resetAnswer();
    setQaQuestionBusy(true);
    try {
      const response = await fetch(`${BACKEND_URL}/followup-question`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary_feedback: ['Drill practice session'],
          preset: qaPreset,
        }),
      });
      if (!response.ok) throw new Error(`Server error ${response.status}`);
      const data = await response.json();
      setQaQuestion(data.question?.trim() ?? null);
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not generate question');
    } finally {
      setQaQuestionBusy(false);
    }
  };

  // ── QA Recording ──────────────────────────────────────────────────────────
  const qaStartRecordingWeb = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      qaStreamRef.current = stream;
      setQaRecording(true);
      setQaRecordStart(Date.now());
      setQaVideoUri(null);

      const chunks: Blob[] = [];
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8,opus' });
      recorder.ondataavailable = (e) => { if (e.data?.size > 0) chunks.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        setQaVideoUri(URL.createObjectURL(blob));
        setQaRecording(false);
        setQaRecordStart(null);
        stream.getTracks().forEach((t) => t.stop());
        qaStreamRef.current = null;
        qaMediaRecorderRef.current = null;
        if (qaPreviewRef.current) qaPreviewRef.current.srcObject = null;
      };
      qaMediaRecorderRef.current = recorder;
      recorder.start();

      // Auto-stop at 90s
      qaAutoStopRef.current = setTimeout(() => {
        qaMediaRecorderRef.current?.stop();
      }, 90_000);
    } catch (err: any) {
      Alert.alert('Camera error', err?.message ?? 'Could not access camera');
    }
  };

  const qaStopRecordingWeb = () => {
    if (qaAutoStopRef.current) clearTimeout(qaAutoStopRef.current);
    qaMediaRecorderRef.current?.stop();
  };

  const qaRecordNative = async () => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      videoMaxDuration: 90,
    });
    if (!result.canceled) {
      setQaVideoUri(result.assets[0].uri);
    }
  };

  const handleQaRecord = async () => {
    if (Platform.OS === 'web') {
      if (qaRecording) { qaStopRecordingWeb(); } else { await qaStartRecordingWeb(); }
    } else {
      await qaRecordNative();
    }
  };

  // ── QA Submit ─────────────────────────────────────────────────────────────
  const submitAnswer = async () => {
    if (!qaVideoUri || !qaQuestion) return;
    setQaError(null);
    setQaAnalyzing(true);
    try {
      const results = await submitVideoForTranscript(qaVideoUri, qaPreset);
      const transcript: string = results?.transcript ?? '';

      const evalResp = await fetch(`${BACKEND_URL}/evaluate-followup-answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: qaQuestion, answer_transcript: transcript }),
      });
      if (!evalResp.ok) throw new Error(`Eval error ${evalResp.status}`);
      const evalData = await evalResp.json();
      setQaResult(evalData);
    } catch (err: any) {
      setQaError(err?.message ?? 'Analysis failed. Make sure the backend is running.');
    } finally {
      setQaAnalyzing(false);
    }
  };

  // ── Filler Challenge Recording ─────────────────────────────────────────────
  const fcStartRecordingWeb = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      fcStreamRef.current = stream;
      setFcRecording(true);
      setFcSecondsLeft(FILLER_CHALLENGE_SECONDS);
      setFcVideoUri(null);

      const chunks: Blob[] = [];
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8,opus' });
      recorder.ondataavailable = (e) => { if (e.data?.size > 0) chunks.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        fcBlobRef.current = blob;
        setFcVideoUri(blob.size > 0 ? URL.createObjectURL(blob) : null);
        setFcRecording(false);
        stream.getTracks().forEach((t) => t.stop());
        fcStreamRef.current = null;
        fcMediaRecorderRef.current = null;
        if (fcPreviewRef.current) fcPreviewRef.current.srcObject = null;
        if (fcCountdownRef.current) clearInterval(fcCountdownRef.current);
      };
      fcMediaRecorderRef.current = recorder;
      recorder.start();

      // Countdown
      fcCountdownRef.current = setInterval(() => {
        setFcSecondsLeft((prev) => {
          if (prev <= 1) {
            clearInterval(fcCountdownRef.current!);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Auto-stop at 60s
      fcAutoStopRef.current = setTimeout(() => {
        fcMediaRecorderRef.current?.stop();
        if (fcCountdownRef.current) clearInterval(fcCountdownRef.current);
      }, FILLER_CHALLENGE_SECONDS * 1000);
    } catch (err: any) {
      Alert.alert('Camera error', err?.message ?? 'Could not access camera');
    }
  };

  const fcStopRecordingWeb = () => {
    if (fcAutoStopRef.current) clearTimeout(fcAutoStopRef.current);
    if (fcCountdownRef.current) clearInterval(fcCountdownRef.current);
    fcMediaRecorderRef.current?.stop();
  };

  const fcRecordNative = async () => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      videoMaxDuration: FILLER_CHALLENGE_SECONDS,
    });
    if (!result.canceled) {
      setFcVideoUri(result.assets[0].uri);
    }
  };

  const handleFcRecord = async () => {
    if (Platform.OS === 'web') {
      if (fcRecording) { fcStopRecordingWeb(); } else { await fcStartRecordingWeb(); }
    } else {
      await fcRecordNative();
    }
  };

  // ── Filler Challenge Submit ────────────────────────────────────────────────
  const submitFcRecording = async () => {
    if (!fcVideoUri) return;
    if (fcBlobRef.current !== null && fcBlobRef.current.size === 0) {
      setFcError('Recording was too short — no audio was captured. Try again and speak for at least 2 seconds.');
      return;
    }
    setFcError(null);
    setFcAnalyzing(true);
    try {
      const results = await submitVideoForTranscript(
        fcVideoUri,
        'general',
        FILLER_CHALLENGE_SECONDS,
      );
      const fillerCount: number = results?.metrics?.filler_word_count ?? 0;
      const fillerWords: Record<string, number> = results?.metrics?.filler_words ?? {};
      const totalWords: number = results?.metrics?.word_count ?? 0;
      setFcResult({ fillerCount, fillerWords, totalWords, success: fillerCount === 0 });
    } catch (err: any) {
      setFcError(err?.message ?? 'Analysis failed. Make sure the backend is running.');
    } finally {
      setFcAnalyzing(false);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  const verdictLabel: Record<string, string> = {
    correct: 'Correct',
    partially_correct: 'Partial',
    incorrect: 'Incorrect',
    insufficient_information: 'Unclear',
  };
  const verdictColor: Record<string, string> = {
    correct: palette.mint,
    partially_correct: '#e09b2d',
    incorrect: '#c0392b',
    insufficient_information: '#8a8a8a',
  };

  return (
    <ScrollView
      style={[s.scroll, { backgroundColor: canvas }]}
      contentContainerStyle={s.content}
      keyboardShouldPersistTaps="handled">

      {/* Header */}
      <View style={s.header}>
        <ThemedText style={[s.headerTitle, { color: ink }]}>Drill Mode</ThemedText>
        <ThemedText style={[s.headerSub, { color: ink }]}>
          Focused practice games to sharpen your speaking
        </ThemedText>
      </View>

      {/* Mode Selector */}
      <View style={[s.modeRow, { backgroundColor: card, borderColor: border }]}>
        {(['qa', 'filler'] as DrillMode[]).map((m) => {
          const active = mode === m;
          const mLabel = m === 'qa' ? 'Q&A Simulator' : 'Filler Challenge';
          return (
            <Pressable
              key={m}
              accessibilityRole="button"
              accessibilityLabel={mLabel}
              onPress={() => { setMode(m); resetQa(); resetFc(); }}
              style={[
                s.modePill,
                active && { backgroundColor: palette.accent },
              ]}>
              <ThemedText
                style={[s.modePillText, { color: active ? '#fff' : ink }]}>
                {mLabel}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      {/* ── Q&A Simulator ─────────────────────────────────────────────────── */}
      {mode === 'qa' && (
        <View style={s.panel}>

          {/* Preset picker */}
          <ThemedText style={[s.sectionLabel, { color: ink }]}>Topic</ThemedText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.presetScroll}>
            {PRESETS.map((p) => {
              const active = qaPreset === p.key;
              return (
                <Pressable
                  key={p.key}
                  accessibilityRole="button"
                  accessibilityLabel={p.label}
                  onPress={() => setQaPreset(p.key)}
                  style={[
                    s.presetPill,
                    { borderColor: border },
                    active && { backgroundColor: palette.accentDeep, borderColor: palette.accentDeep },
                  ]}>
                  <Ionicons
                    name={p.icon}
                    size={14}
                    color={active ? '#fff' : palette.accent}
                    style={{ marginRight: 4 }}
                  />
                  <ThemedText style={[s.presetPillText, { color: active ? '#fff' : ink }]}>
                    {p.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Get Question */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Get a question"
            onPress={getQuestion}
            disabled={qaQuestionBusy || qaAnalyzing}
            style={[s.primaryBtn, (qaQuestionBusy || qaAnalyzing) && s.btnDisabled]}>
            <Ionicons name="sparkles-outline" size={16} color="#fff" style={s.btnIcon} />
            <ThemedText style={s.primaryBtnText}>
              {qaQuestionBusy ? 'Generating…' : qaQuestion ? 'New Question' : 'Get Question'}
            </ThemedText>
          </Pressable>

          {/* Question card */}
          {qaQuestion && (
            <View style={[s.questionCard, { backgroundColor: card, borderColor: border }]}>
              <Ionicons name="help-circle" size={20} color={palette.accent} style={{ marginBottom: 6 }} />
              <ThemedText style={[s.questionText, { color: ink }]}>{qaQuestion}</ThemedText>
            </View>
          )}

          {/* Recording section (only after question is loaded) */}
          {qaQuestion && !qaResult && (
            <View style={s.recordSection}>
              <ThemedText style={[s.sectionLabel, { color: ink }]}>
                Record your answer (max 90 s)
              </ThemedText>

              {/* Live preview on web */}
              {Platform.OS === 'web' && qaRecording && (
                // @ts-ignore — video element only exists on web
                <video
                  ref={qaPreviewRef}
                  style={{ width: '100%', borderRadius: 10, marginBottom: 10, maxHeight: 180 }}
                  muted
                  playsInline
                />
              )}

              {/* Elapsed timer */}
              {qaRecording && (
                <ThemedText style={[s.timerText, { color: palette.accent }]}>
                  {qaElapsed}s / 90s
                </ThemedText>
              )}

              {/* Record button */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={qaRecording ? 'Stop recording' : 'Start recording'}
                onPress={handleQaRecord}
                disabled={qaAnalyzing}
                style={[
                  s.recordBtn,
                  qaRecording ? s.recordBtnActive : { borderColor: border, backgroundColor: card },
                  qaAnalyzing && s.btnDisabled,
                ]}>
                <Ionicons
                  name={qaRecording ? 'stop-circle' : 'videocam-outline'}
                  size={20}
                  color={qaRecording ? '#fff' : palette.accent}
                  style={{ marginRight: 6 }}
                />
                <ThemedText style={{ color: qaRecording ? '#fff' : ink, fontFamily: Fonts.rounded }}>
                  {qaRecording ? 'Stop Recording' : 'Start Recording'}
                </ThemedText>
              </Pressable>

              {/* Submit */}
              {qaVideoUri && !qaRecording && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Submit answer for grading"
                  onPress={submitAnswer}
                  disabled={qaAnalyzing}
                  style={[s.primaryBtn, { marginTop: 10 }, qaAnalyzing && s.btnDisabled]}>
                  <Ionicons name="checkmark-circle-outline" size={16} color="#fff" style={s.btnIcon} />
                  <ThemedText style={s.primaryBtnText}>
                    {qaAnalyzing ? 'Analyzing…' : 'Submit Answer'}
                  </ThemedText>
                </Pressable>
              )}

              {/* Inline error */}
              {qaError && (
                <View style={[s.errorBox, { borderColor: '#c0392b' }]}>
                  <Ionicons name="alert-circle-outline" size={16} color="#c0392b" style={{ marginRight: 6 }} />
                  <ThemedText style={s.errorText}>{qaError}</ThemedText>
                </View>
              )}
            </View>
          )}

          {/* Eval result card */}
          {qaResult && (
            <View style={[s.resultCard, { backgroundColor: card, borderColor: border }]}>
              <ScoreCircle score={qaResult.correctness_score} />

              {/* Verdict badge */}
              <View style={[
                s.verdictBadge,
                { backgroundColor: verdictColor[qaResult.verdict] + '22', borderColor: verdictColor[qaResult.verdict] },
              ]}>
                <ThemedText style={[s.verdictText, { color: verdictColor[qaResult.verdict] }]}>
                  {verdictLabel[qaResult.verdict] ?? qaResult.verdict}
                </ThemedText>
              </View>

              {/* Reason */}
              <ThemedText style={[s.resultSection, { color: ink }]}>{qaResult.reason}</ThemedText>

              {/* Missing points */}
              {qaResult.missing_points.length > 0 && (
                <View style={s.missingSection}>
                  <ThemedText style={[s.missingSectionTitle, { color: ink }]}>Missing points</ThemedText>
                  {qaResult.missing_points.map((pt, i) => (
                    <View key={i} style={s.missingRow}>
                      <Ionicons name="ellipse" size={6} color={palette.accent} style={{ marginTop: 5, marginRight: 8 }} />
                      <ThemedText style={[s.missingPoint, { color: ink }]}>{pt}</ThemedText>
                    </View>
                  ))}
                </View>
              )}

              {/* Suggested improvement */}
              <View style={[s.tipBox, { backgroundColor: palette.mint + '18', borderColor: palette.mint }]}>
                <Ionicons name="bulb-outline" size={14} color={palette.mint} style={{ marginRight: 6, marginTop: 2 }} />
                <ThemedText style={[s.tipText, { color: ink }]}>{qaResult.suggested_improvement}</ThemedText>
              </View>

              {/* Buttons */}
              <View style={s.resultButtons}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Get next question"
                  onPress={getQuestion}
                  disabled={qaQuestionBusy}
                  style={[s.primaryBtn, { flex: 1, marginRight: 6 }, qaQuestionBusy && s.btnDisabled]}>
                  <Ionicons name="arrow-forward-circle-outline" size={16} color="#fff" style={s.btnIcon} />
                  <ThemedText style={s.primaryBtnText}>Next Question</ThemedText>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Change topic"
                  onPress={resetQa}
                  style={[s.secondaryBtn, { flex: 1 }]}>
                  <ThemedText style={[s.secondaryBtnText, { color: ink }]}>Change Topic</ThemedText>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      )}

      {/* ── Filler Challenge ───────────────────────────────────────────────── */}
      {mode === 'filler' && (
        <View style={s.panel}>

          {/* Instructions */}
          <View style={[s.questionCard, { backgroundColor: card, borderColor: border }]}>
            <Ionicons name="trophy-outline" size={22} color={palette.accent} style={{ marginBottom: 6 }} />
            <ThemedText style={[s.questionText, { color: ink }]}>
              Speak for 60 seconds without using any filler words — no "um", "uh", "like", "you know",
              "actually", "basically", "literally", or "so".
            </ThemedText>
          </View>

          {/* Countdown ring */}
          <View style={s.countdownWrap}>
            <View style={[
              s.countdownRing,
              { borderColor: fcRecording ? palette.accent : border },
            ]}>
              <ThemedText style={[s.countdownNumber, { color: fcRecording ? palette.accent : ink }]}>
                {fcRecording ? fcSecondsLeft : FILLER_CHALLENGE_SECONDS}
              </ThemedText>
              <ThemedText style={[s.countdownLabel, { color: ink }]}>seconds</ThemedText>
            </View>
          </View>

          {/* Live preview on web */}
          {Platform.OS === 'web' && fcRecording && (
            // @ts-ignore
            <video
              ref={fcPreviewRef}
              style={{ width: '100%', borderRadius: 10, marginBottom: 10, maxHeight: 180 }}
              muted
              playsInline
            />
          )}

          {/* Record button */}
          {!fcVideoUri && !fcResult && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={fcRecording ? 'Stop recording' : 'Start 60-second challenge'}
              onPress={handleFcRecord}
              disabled={fcAnalyzing}
              style={[
                s.recordBtn,
                fcRecording ? s.recordBtnActive : { borderColor: border, backgroundColor: card },
                fcAnalyzing && s.btnDisabled,
              ]}>
              <Ionicons
                name={fcRecording ? 'stop-circle' : 'play-circle-outline'}
                size={22}
                color={fcRecording ? '#fff' : palette.accent}
                style={{ marginRight: 6 }}
              />
              <ThemedText style={{ color: fcRecording ? '#fff' : ink, fontFamily: Fonts.rounded, fontSize: 16 }}>
                {fcRecording ? 'Stop Early' : 'Start Challenge'}
              </ThemedText>
            </Pressable>
          )}

          {/* Submit recorded video */}
          {fcVideoUri && !fcResult && !fcAnalyzing && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Analyze my recording"
              onPress={submitFcRecording}
              style={s.primaryBtn}>
              <Ionicons name="analytics-outline" size={16} color="#fff" style={s.btnIcon} />
              <ThemedText style={s.primaryBtnText}>Check Results</ThemedText>
            </Pressable>
          )}

          {/* Analyzing loading card */}
          {fcAnalyzing && (
            <View style={[s.loadingCard, { backgroundColor: card, borderColor: border }]}>
              <Ionicons name="hourglass-outline" size={22} color={palette.accent} style={{ marginBottom: 6 }} />
              <ThemedText style={[s.loadingText, { color: ink }]}>Analyzing your recording…</ThemedText>
              <ThemedText style={[s.loadingSub, { color: ink }]}>This usually takes 20–60 seconds</ThemedText>
            </View>
          )}

          {/* Inline error */}
          {fcError && (
            <View style={[s.errorBox, { borderColor: '#c0392b' }]}>
              <Ionicons name="alert-circle-outline" size={16} color="#c0392b" style={{ marginRight: 6 }} />
              <ThemedText style={s.errorText}>{fcError}</ThemedText>
            </View>
          )}

          {/* Result */}
          {fcResult && (
            <View style={[s.resultCard, { backgroundColor: card, borderColor: border }]}>
              {/* Success / Fail banner */}
              <View style={[
                s.fcBanner,
                { backgroundColor: fcResult.success ? palette.mint + '22' : '#c0392b22' },
              ]}>
                <Ionicons
                  name={fcResult.success ? 'trophy' : 'close-circle'}
                  size={32}
                  color={fcResult.success ? palette.mint : '#c0392b'}
                />
                <ThemedText style={[
                  s.fcBannerText,
                  { color: fcResult.success ? palette.mint : '#c0392b' },
                ]}>
                  {fcResult.success
                    ? 'Perfect! Zero filler words!'
                    : `${fcResult.fillerCount} filler word${fcResult.fillerCount !== 1 ? 's' : ''} detected`}
                </ThemedText>
              </View>

              {/* Filler breakdown chips */}
              {!fcResult.success && Object.keys(fcResult.fillerWords).length > 0 && (
                <View style={s.chipWrap}>
                  {Object.entries(fcResult.fillerWords).map(([word, count]) => (
                    <View key={word} style={[s.fillerChip, { borderColor: palette.accent + '66' }]}>
                      <ThemedText style={[s.fillerChipWord, { color: ink }]}>"{word}"</ThemedText>
                      <View style={[s.fillerChipBadge, { backgroundColor: palette.accent }]}>
                        <ThemedText style={s.fillerChipCount}>×{count}</ThemedText>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* Stats */}
              <ThemedText style={[s.fcStats, { color: ink }]}>
                {fcResult.totalWords} words spoken
              </ThemedText>

              {/* Try again */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Try the challenge again"
                onPress={resetFc}
                style={s.primaryBtn}>
                <Ionicons name="refresh-outline" size={16} color="#fff" style={s.btnIcon} />
                <ThemedText style={s.primaryBtnText}>Try Again</ThemedText>
              </Pressable>
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 120 },

  header: { marginBottom: 20, marginTop: 60 },
  headerTitle: { fontFamily: Fonts.rounded, fontSize: 28, fontWeight: '700', marginBottom: 4 },
  headerSub: { fontFamily: Fonts.rounded, fontSize: 14, opacity: 0.65 },

  modeRow: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 1,
    padding: 4,
    marginBottom: 20,
  },
  modePill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  modePillText: { fontFamily: Fonts.rounded, fontSize: 14, fontWeight: '600' },

  panel: { gap: 14 },

  sectionLabel: { fontFamily: Fonts.rounded, fontSize: 13, fontWeight: '600', opacity: 0.7, marginBottom: -6 },

  presetScroll: { marginHorizontal: -4 },
  presetPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginHorizontal: 4,
  },
  presetPillText: { fontFamily: Fonts.rounded, fontSize: 13 },

  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.accent,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  primaryBtnText: { fontFamily: Fonts.rounded, fontSize: 15, fontWeight: '600', color: '#fff' },
  btnIcon: { marginRight: 6 },

  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: palette.borderLight,
  },
  secondaryBtnText: { fontFamily: Fonts.rounded, fontSize: 15, fontWeight: '600' },

  btnDisabled: { opacity: 0.45 },

  questionCard: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  questionText: { fontFamily: Fonts.sans, fontSize: 16, lineHeight: 24 },

  recordSection: { gap: 10 },

  timerText: { fontFamily: Fonts.rounded, fontSize: 14, fontWeight: '700', textAlign: 'center' },

  recordBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1.5,
  },
  recordBtnActive: {
    backgroundColor: '#c0392b',
    borderColor: '#c0392b',
  },

  resultCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  verdictBadge: {
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  verdictText: { fontFamily: Fonts.rounded, fontSize: 14, fontWeight: '700' },
  resultSection: { fontFamily: Fonts.sans, fontSize: 14, lineHeight: 22 },

  missingSection: { gap: 6 },
  missingSectionTitle: { fontFamily: Fonts.rounded, fontSize: 13, fontWeight: '600', opacity: 0.7 },
  missingRow: { flexDirection: 'row', alignItems: 'flex-start' },
  missingPoint: { fontFamily: Fonts.sans, fontSize: 13, lineHeight: 20, flex: 1 },

  tipBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  tipText: { fontFamily: Fonts.sans, fontSize: 13, lineHeight: 20, flex: 1 },

  resultButtons: { flexDirection: 'row', gap: 8 },

  // Filler challenge
  countdownWrap: { alignItems: 'center', paddingVertical: 10 },
  countdownRing: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdownNumber: { fontFamily: Fonts.rounded, fontSize: 38, fontWeight: '700', lineHeight: 42 },
  countdownLabel: { fontFamily: Fonts.rounded, fontSize: 12, opacity: 0.65 },

  fcBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 12,
  },
  fcBannerText: { fontFamily: Fonts.rounded, fontSize: 17, fontWeight: '700', flex: 1 },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  fillerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 20,
    paddingLeft: 10,
    paddingRight: 4,
    paddingVertical: 4,
    gap: 6,
  },
  fillerChipWord: { fontFamily: Fonts.rounded, fontSize: 13 },
  fillerChipBadge: {
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  fillerChipCount: { fontFamily: Fonts.rounded, fontSize: 12, color: '#fff', fontWeight: '700' },
  fcStats: { fontFamily: Fonts.rounded, fontSize: 13, textAlign: 'center', opacity: 0.7 },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: '#c0392b12',
  },
  errorText: { fontFamily: Fonts.sans, fontSize: 13, lineHeight: 20, flex: 1, color: '#c0392b' },

  loadingCard: {
    padding: 24,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    gap: 4,
  },
  loadingText: { fontFamily: Fonts.rounded, fontSize: 15, fontWeight: '600' },
  loadingSub: { fontFamily: Fonts.rounded, fontSize: 12, opacity: 0.6 },
});
