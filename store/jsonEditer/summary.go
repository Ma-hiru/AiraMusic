package jsonEditer

import "sort"

type EditSummary struct {
	fields  map[string]struct{}
	indexes map[int]struct{}
}

type EditSummaryPayload struct {
	TouchedFields []string `json:"touchedFields,omitempty"`
	TouchedIndex  []int    `json:"touchedIndex,omitempty"`
}

func NewEditSummary() *EditSummary {
	return &EditSummary{
		fields:  make(map[string]struct{}),
		indexes: make(map[int]struct{}),
	}
}

func (s *EditSummary) AddField(field string) {
	if field == "" {
		return
	}
	s.fields[field] = struct{}{}
}

func (s *EditSummary) AddIndex(idx int) {
	s.indexes[idx] = struct{}{}
}

func (s *EditSummary) Export() EditSummaryPayload {
	var fields = make([]string, 0, len(s.fields))
	for f := range s.fields {
		fields = append(fields, f)
	}
	sort.Strings(fields)

	var indexes = make([]int, 0, len(s.indexes))
	for i := range s.indexes {
		indexes = append(indexes, i)
	}
	sort.Ints(indexes)

	return EditSummaryPayload{TouchedFields: fields, TouchedIndex: indexes}
}
