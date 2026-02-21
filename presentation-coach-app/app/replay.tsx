import { useLocalSearchParams, useRouter } from 'expo-router';
import { Video, ResizeMode } from 'expo-av';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function ReplayScreen() {
  const router = useRouter();
  const { videoUri, summary } = useLocalSearchParams<{
    videoUri?: string;
    summary?: string;
  }>();

  if (!videoUri) {
    return (
      <ThemedView style={styles.center}>
        <ThemedText>No video found.</ThemedText>
        <TouchableOpacity onPress={() => router.back()}>
          <ThemedText type="link">Go Back</ThemedText>
        </TouchableOpacity>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">Annotated Replay</ThemedText>
      <ThemedText>{summary}</ThemedText>

      <Video
        source={{ uri: videoUri }}
        useNativeControls
        resizeMode={ResizeMode.CONTAIN}
        style={styles.video}
      />

      <TouchableOpacity onPress={() => router.back()}>
        <ThemedText type="link">Back</ThemedText>
      </TouchableOpacity>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  video: { width: '100%', height: 300 },
});