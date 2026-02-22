import { useLocalSearchParams, Stack } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  Platform,
} from "react-native";
import { Video, ResizeMode, AVPlaybackStatus } from "expo-av";

type Annotation = {
  time: number;
  label: string;
  message: string;
};

function formatSeconds(sec: number) {
  const mm = Math.floor(sec / 60);
  const ss = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

export default function AnnotatedScreen() {
  const { videoUri, annotations } = useLocalSearchParams();

  const parsedAnnotations: Annotation[] = useMemo(() => {
    try {
      return JSON.parse((annotations as string) || "[]") as Annotation[];
    } catch {
      return [];
    }
  }, [annotations]);

  const videoRef = useRef<Video>(null);

  const shownRef = useRef(new Set<number>());
  const [activeNote, setActiveNote] = useState<Annotation | null>(null);
  const [currentTime, setCurrentTime] = useState(0);

  const jumpTo = async (time: number) => {
    try {
      await videoRef.current?.setPositionAsync(time * 1000);
    } catch {}
  };

  const onStatusUpdate = (status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;

    const t = status.positionMillis / 1000;
    setCurrentTime(t);

    const hit = parsedAnnotations.find((a) => Math.abs(a.time - t) < 0.4);
    if (hit && !shownRef.current.has(hit.time)) {
      shownRef.current.add(hit.time);
      setActiveNote(hit);
      setTimeout(() => setActiveNote(null), 2500);
    }
  };

  // Safety: if the user replays from earlier, allow notes to show again
  useEffect(() => {
    if (currentTime < 1) {
      shownRef.current = new Set<number>();
    }
  }, [currentTime]);

  return (
    <SafeAreaView style={styles.screen}>
      <Stack.Screen options={{ title: "Annotated Replay" }} />

      {/* ✅ CENTERED + BIG VIDEO */}
      <View style={styles.videoSection}>
        <View style={styles.videoCard}>
          <Video
            ref={videoRef}
            source={{ uri: videoUri as string }}
            style={styles.video}
            useNativeControls
            resizeMode={ResizeMode.CONTAIN}
            onPlaybackStatusUpdate={onStatusUpdate}
          />

          {/* ✅ Overlay pinned to the video card */}
          {activeNote && (
            <View style={styles.overlay}>
              <Text style={styles.overlayTag}>
                {formatSeconds(activeNote.time)} • {activeNote.label}
              </Text>
              <Text style={styles.overlayText}>{activeNote.message}</Text>
            </View>
          )}
        </View>
      </View>

      {/* List header */}
      <View style={styles.listHeader}>
        <Text style={styles.listTitle}>Annotations</Text>
        <Text style={styles.listSub}>
          Tap one to jump • Current: {formatSeconds(currentTime)}
        </Text>
      </View>

      {/* List */}
      <FlatList
        data={[...parsedAnnotations].sort((a, b) => a.time - b.time)}
        keyExtractor={(item) => item.time.toString()}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.annotationItem}
            onPress={() => jumpTo(item.time)}
            activeOpacity={0.8}
          >
            <Text style={styles.time}>{formatSeconds(item.time)}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>{item.label}</Text>
              <Text style={styles.message}>{item.message}</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No annotations for this video.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#121212" },

  // ✅ centers the whole video block
  videoSection: {
    width: "100%",
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 10,
  },

  // ✅ bigger “card”, centered, 16:9, good on web + mobile
  videoCard: {
    width: "100%",
    maxWidth: 960, // increase if you want: 1100
    aspectRatio: 16 / 9,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#0b0b0b",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },

  // ✅ fills the card (this is what fixes “tiny”)
  video: {
    width: "100%",
    height: "100%",
  },

  // ✅ overlay sits INSIDE the video card
  overlay: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
    backgroundColor: "rgba(0,0,0,0.75)",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  overlayTag: {
    color: "#ff8c42",
    fontWeight: "700",
    marginBottom: 6,
  },
  overlayText: {
    color: "white",
    lineHeight: 18,
  },

  listHeader: {
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 8,
  },
  listTitle: {
    color: "white",
    fontSize: 16,
    fontWeight: "700",
  },
  listSub: {
    color: "rgba(255,255,255,0.65)",
    marginTop: 2,
    fontSize: 12,
  },

  listContent: {
    paddingBottom: 18,
  },

  annotationItem: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },

  time: {
    color: "#ff8c42",
    fontWeight: "700",
    width: 52,
  },

  label: {
    color: "rgba(255,255,255,0.85)",
    fontWeight: "600",
    textTransform: "capitalize",
    marginBottom: 2,
  },

  message: {
    color: "white",
    lineHeight: 18,
  },

  empty: {
    padding: 18,
  },
  emptyText: {
    color: "rgba(255,255,255,0.65)",
  },
});