package core

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestIndexLineEncryptionRoundTrip(t *testing.T) {
	idx := Index{
		ID:     "netease_image_avatar_1",
		Mime:   "image/webp",
		Size:   128,
		Key:    "chunk-key",
		Chunks: []string{"chunk-a", "chunk-b"},
	}

	line, err := marshalIndexLine("index-key", idx)
	if err != nil {
		t.Fatalf("marshal encrypted index line: %v", err)
	}

	raw := string(line)
	if !strings.HasPrefix(raw, encryptedIndexPrefix) {
		t.Fatalf("expected encrypted index prefix, got %q", raw)
	}
	if strings.Contains(raw, idx.ID) {
		t.Fatalf("encrypted index line leaked raw id: %q", raw)
	}

	got, ok := parseIndexLine("index-key", raw)
	if !ok {
		t.Fatal("failed to parse encrypted index line")
	}
	if got.ID != idx.ID || got.Mime != idx.Mime || got.Size != idx.Size || got.Key != idx.Key {
		t.Fatalf("unexpected decrypted index: %#v", got)
	}
}

func TestIndexLinePlaintextCompatibility(t *testing.T) {
	idx := Index{
		ID:   "legacy-index",
		Mime: "application/json",
		Size: 64,
	}
	line, err := json.Marshal(idx)
	if err != nil {
		t.Fatalf("marshal plaintext index line: %v", err)
	}

	got, ok := parseIndexLine("index-key", string(line))
	if !ok {
		t.Fatal("failed to parse legacy plaintext index line")
	}
	if got.ID != idx.ID || got.Mime != idx.Mime || got.Size != idx.Size {
		t.Fatalf("unexpected plaintext index: %#v", got)
	}
}
