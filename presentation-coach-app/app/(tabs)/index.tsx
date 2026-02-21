import React, { useState } from 'react';
import { Alert, Platform, StyleSheet, TouchableOpacity } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';

import ParallaxScrollView from '@/components/parallax-scroll-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

type Marker = {
  time_sec: number;
  label: string;
  detail?: string;
};

type CoachResponse = {
  summary: string;
  bullets?: string[];
  markers?: Marker[];
  notes?: string[];
  transcript?: string;
};
const BACKEND_URL =
  Platform.select({
    android: 'http://10.0.2.2:8000',
    ios: 'http://localhost:8000',
    default: 'http://localhost:8000',
  }) ?? 'http://localhost:8000';

export default function HomeScreen() {
  const router = useRouter();
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const player = useVideoPlayer(videoUri ?? '', (p) => {
    p.loop = false;
  });
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<CoachResponse | null>(null);
  const [videoName, setVideoName] = useState<string>('');

  const pickVideo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
    });

    if (!result.canceled) {
      const asset = result.assets[0];
      setVideoUri(asset.uri);
      setVideoName(asset.fileName ?? asset.uri.split('/').pop() ?? 'selected-video');
      setFeedback(null);
    }
  };

  const analyze = async () => {
    if (!videoUri) {
      Alert.alert('Pick a video first.');
      return;
    }

    setBusy(true);

    try {
      const form = new FormData();

      // ✅ Web needs Blob/File
      if (Platform.OS === 'web') {
        const resp = await fetch(videoUri);
        const blob = await resp.blob();
        form.append('file', blob, 'practice.mp4');
      } else {
        form.append('file', {
          uri: videoUri,
          name: 'practice.mp4',
          type: 'video/mp4',
        } as any);
      }

      // Optional but nice: send duration_seconds so backend doesn't warn
      form.append('duration_seconds', '30');

      const res = await fetch(`${BACKEND_URL}/analyze`, {
        method: 'POST',
        body: form,
      });

      // ✅ IMPORTANT: show error instead of hanging silently
      if (!res.ok) {
        const txt = await res.text();
        Alert.alert('Backend error', `Status ${res.status}\n\n${txt}`);
        return;
      }

      const api = await res.json();

      const mapped: CoachResponse = {
        summary: api.summary_feedback?.[0] ?? 'Feedback ready.',
        bullets: api.summary_feedback ?? [],
        markers: (api.markers ?? []).map((m: any) => ({
          time_sec: m.second,
          label: m.category,
          detail: m.message,
        })),
        notes: api.notes ?? [],
        transcript: api.transcript ?? '',
      };

      setFeedback(mapped);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const openReplay = () => {
    if (!videoUri || !feedback) return;

    router.push({
      pathname: '/replay',
      params: {
        videoUri,
        summary: feedback.summary,
      },
    });
  };

return (
  <ParallaxScrollView
    headerBackgroundColor={{ light: '#A1CEDC', dark: '#1D3D47' }}
    headerImage={
      <ThemedView style={styles.headerBox}>
        <ThemedText type="title" style={styles.headerTitle}>
          Presentation Coach
        </ThemedText>
        <ThemedText style={styles.headerSubtitle}>
          Upload a clip → get timestamped AI feedback.
        </ThemedText>
      </ThemedView>
    }
  >
    <ThemedView style={styles.page}>
      {/* Upload Card */}
      <ThemedView style={styles.card}>
        <ThemedText type="subtitle" style={{ marginBottom: 8 }}>
          Upload
        </ThemedText>

        {!!videoUri && (
          <ThemedView style={{ gap: 10 }}>
            <ThemedView style={styles.videoWrap}>
              <VideoView
                style={styles.video}
                player={player}
                allowsFullscreen
                allowsPictureInPicture
                nativeControls
              />
            </ThemedView>

            <ThemedText type="defaultSemiBold" style={{ fontSize: 16 }} numberOfLines={2}>
              {videoName}
            </ThemedText>
          </ThemedView>
        )}

        <TouchableOpacity style={styles.primaryButton} onPress={pickVideo}>
          <ThemedText type="defaultSemiBold">
            {videoUri ? 'Change Video' : 'Pick Video'}
          </ThemedText>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.primaryButton, (!videoUri || busy) && styles.buttonDisabled]}
          disabled={!videoUri || busy}
          onPress={analyze}
        >
          <ThemedText type="defaultSemiBold">{busy ? 'Analyzing...' : 'Run Coach'}</ThemedText>
        </TouchableOpacity>
      </ThemedView>

      {/* Feedback Card */}
      {feedback && (
        <ThemedView style={styles.card}>
          <ThemedText type="subtitle">Feedback</ThemedText>

          <ThemedText style={{ marginTop: 8 }}>{feedback.summary}</ThemedText>

          {feedback.bullets?.map((b, i) => (
            <ThemedText key={i} style={{ marginTop: 6 }}>
              • {b}
            </ThemedText>
          ))}

          {!!feedback.transcript && (
            <ThemedView style={{ marginTop: 12, gap: 6 }}>
              <ThemedText type="defaultSemiBold">Transcript</ThemedText>
              <ThemedText style={{ opacity: 0.9 }}>{feedback.transcript}</ThemedText>
            </ThemedView>
          )}

          {!!feedback.notes?.length && (
            <ThemedView style={{ marginTop: 12, gap: 4 }}>
              <ThemedText type="defaultSemiBold">Debug Notes</ThemedText>
              {feedback.notes.map((n, i) => (
                <ThemedText key={i}>🛈 {n}</ThemedText>
              ))}
            </ThemedView>
          )}
          <TouchableOpacity style={[styles.primaryButton, { marginTop: 12 }]} onPress={openReplay}>
            <ThemedText type="defaultSemiBold">Open Annotated Replay</ThemedText>
          </TouchableOpacity>
        </ThemedView>
      )}
    </ThemedView>
  </ParallaxScrollView>
);
}

const styles = StyleSheet.create({
  headerBox: { padding: 18, gap: 6 },
  headerTitle: { textAlign: 'center' },
  headerSubtitle: { textAlign: 'center', opacity: 0.9 },
  videoWrap: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  video: {
    width: '100%',
    height: 240, // increase if you want bigger
  },
  // centers content on web + adds breathing room
  page: {
    gap: 16,
    paddingHorizontal: 16,
    paddingBottom: 24,
    maxWidth: 820,
    width: '100%',
    alignSelf: 'center',
  },

  card: {
    padding: 16,
    borderRadius: 16,
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },

  primaryButton: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(100,160,220,0.35)',
    alignItems: 'center',
  },

  buttonDisabled: { opacity: 0.5 },

  fileRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },

  fileName: {
    flex: 1,
    opacity: 0.9,
  },
});