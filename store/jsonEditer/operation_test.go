package jsonEditer

import (
	"reflect"
	"testing"
)

func TestApplyOperations_Object(t *testing.T) {
	data := map[string]any{
		"title": "Old Title",
		"owner": "alice",
	}

	ops := []ObjOperations{
		{Name: "set", Field: "title", Value: "LoFi Set"},
		{Name: "has", Field: "title"},
		{Name: "read", Field: "title"},
	}

	editor := &JSONEditor{Data: data}
	summary := NewEditSummary()

	result, err := ApplyOperations(editor, "object", ops, summary)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if result != "LoFi Set" {
		t.Fatalf("expected last result to be 'LoFi Set', got %v", result)
	}

	wantData := map[string]any{
		"title": "LoFi Set",
		"owner": "alice",
	}
	if !reflect.DeepEqual(editor.Data, wantData) {
		t.Fatalf("object data mismatch, got %#v", editor.Data)
	}

	summaryPayload := summary.Export()
	if len(summaryPayload.TouchedFields) == 0 || summaryPayload.TouchedFields[0] != "title" {
		t.Fatalf("summary missing touched field 'title': %#v", summaryPayload)
	}
}

func TestApplyOperations_Array(t *testing.T) {
	data := []any{1, 2, 3}

	ops := []ObjOperations{
		{Name: "unshift", Value: 0},                                      // [0,1,2,3]
		{Name: "insert", Value: map[string]any{"index": 1, "value": 99}}, // [0,99,1,2,3]
		{Name: "set", Value: map[string]any{"index": 2, "value": 7}},     // [0,99,7,2,3]
		{Name: "find", Value: map[string]any{"value": 99}},
	}

	editor := &JSONEditor{Data: data}
	summary := NewEditSummary()

	result, err := ApplyOperations(editor, "array", ops, summary)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	findRes, ok := result.(map[string]any)
	if !ok {
		t.Fatalf("expected find result map, got %T", result)
	}
	if findRes["index"] != 1 {
		t.Fatalf("expected find index 1, got %v", findRes["index"])
	}
	if findRes["value"] != 99 {
		t.Fatalf("expected find value 99, got %v", findRes["value"])
	}

	wantData := []any{0, 99, 7, 2, 3}
	if !reflect.DeepEqual(editor.Data, wantData) {
		t.Fatalf("array data mismatch, got %#v", editor.Data)
	}

	summaryPayload := summary.Export()
	if len(summaryPayload.TouchedIndex) == 0 {
		t.Fatalf("summary missing touched indexes: %#v", summaryPayload)
	}
}
