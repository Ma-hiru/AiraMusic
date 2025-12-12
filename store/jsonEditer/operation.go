package jsonEditer

import (
	"fmt"
	"reflect"
)

type ObjOperations struct {
	Name           string `json:"name" binding:"required"` // 操作名称、预设（push/pop/set/delete/map/merge/...）
	Value          any    `json:"value"`                   // 操作参数
	Field          string `json:"field"`                   // 对象字段名（可选，指向子字段后再操作）
	ItemOperations *struct {
		ObjType       string          `json:"objType"`
		ObjOperations []ObjOperations `json:"objOperations"`
	} `json:"itemOperations"` // map 时对每个元素执行的操作链
}

func ApplyOperations(editor *JSONEditor, objType string, ops []ObjOperations, summary *EditSummary) (any, error) {
	var result any
	for _, op := range ops {
		res, err := applyOperation(editor, objType, op, summary)
		if err != nil {
			return nil, err
		}
		if res != nil {
			result = res
		}
	}
	return result, nil
}

func applyOperation(editor *JSONEditor, objType string, op ObjOperations, summary *EditSummary) (any, error) {
	var resolvedType, err = ResolveObjType(objType, editor.Data)
	if err != nil {
		return nil, err
	}

	switch resolvedType {
	case "array":
		return applyArrayOperation(editor, op, summary)
	case "object":
		return applyObjectOperation(editor, op, summary)
	default:
		return nil, fmt.Errorf("unsupported objType: %s", resolvedType)
	}
}

func applyArrayOperation(editor *JSONEditor, op ObjOperations, summary *EditSummary) (any, error) {
	var arr, err = editor.GetArray()
	if err != nil {
		return nil, err
	}

	switch op.Name {
	case "unshift":
		if op.Value == nil {
			return nil, fmt.Errorf("unshift requires value")
		}
		if err := editor.Unshift(op.Value); err != nil {
			return nil, err
		}
		summary.AddIndex(0)
		return nil, nil
	case "pop":
		var val, err = editor.Pop()
		if err != nil {
			return nil, err
		}
		if len(arr) > 0 {
			summary.AddIndex(len(arr) - 1)
		}
		return val, nil
	case "shift":
		var val, err = editor.Shift()
		if err != nil {
			return nil, err
		}
		if len(arr) > 0 {
			summary.AddIndex(0)
		}
		return val, nil
	case "set":
		var payload, ok = op.Value.(map[string]any)
		if !ok {
			return nil, fmt.Errorf("set expects object with index/value")
		}
		var idx, err = toInt(payload["index"])
		if err != nil {
			return nil, fmt.Errorf("set index invalid: %w", err)
		}
		if err := editor.SetArrayIndex(idx, payload["value"]); err != nil {
			return nil, err
		}
		summary.AddIndex(idx)
		return nil, nil
	case "insert":
		var payload, ok = op.Value.(map[string]any)
		if !ok {
			return nil, fmt.Errorf("insert expects object value")
		}
		var idx, err = toInt(payload["index"])
		if err != nil {
			return nil, fmt.Errorf("insert index invalid: %w", err)
		}
		var val, exists = payload["value"]
		if !exists {
			return nil, fmt.Errorf("insert requires value")
		}
		if err := editor.Splice(idx, 0, val); err != nil {
			return nil, err
		}
		summary.AddIndex(idx)
		return nil, nil
	case "splice":
		var payload, ok = op.Value.(map[string]any)
		if !ok {
			return nil, fmt.Errorf("splice expects object value")
		}
		start, err := toInt(payload["start"])
		if err != nil {
			start, err = toInt(payload["startIndex"])
			if err != nil {
				return nil, fmt.Errorf("splice start invalid: %w", err)
			}
		}
		deleteCount, err := toInt(payload["deleteCount"])
		if err != nil {
			return nil, fmt.Errorf("splice deleteCount invalid: %w", err)
		}
		var items []any
		if raw, exist := payload["items"]; exist {
			if arrItems, ok := raw.([]any); ok {
				items = arrItems
			} else {
				return nil, fmt.Errorf("splice items invalid")
			}
		}
		if err := editor.Splice(start, deleteCount, items...); err != nil {
			return nil, err
		}
		summary.AddIndex(start)
		return nil, nil
	case "read":
		var idx, err = toInt(op.Value)
		if err != nil {
			return nil, fmt.Errorf("read index invalid: %w", err)
		}
		if idx < 0 || idx >= len(arr) {
			return nil, fmt.Errorf("index out of range")
		}
		summary.AddIndex(idx)
		return arr[idx], nil
	case "find":
		// value: { field?: string, value: any }
		criteria, ok := op.Value.(map[string]any)
		if !ok {
			return nil, fmt.Errorf("find expects object value")
		}
		target, hasValue := criteria["value"]
		if !hasValue {
			return nil, fmt.Errorf("find requires value")
		}
		field, _ := criteria["field"].(string)
		for i, v := range arr {
			if field == "" {
				if reflect.DeepEqual(v, target) {
					summary.AddIndex(i)
					return map[string]any{"index": i, "value": v}, nil
				}
				continue
			}
			obj, ok := v.(map[string]any)
			if !ok {
				continue
			}
			if reflect.DeepEqual(obj[field], target) {
				summary.AddIndex(i)
				return map[string]any{"index": i, "value": v}, nil
			}
		}
		return nil, nil
	case "map":
		if op.ItemOperations == nil || len(op.ItemOperations.ObjOperations) == 0 {
			return nil, fmt.Errorf("map requires itemOperations")
		}
		var itemType = op.ItemOperations.ObjType
		for i, v := range arr {
			var child = &JSONEditor{Data: v}
			var resolvedType, err = ResolveObjType(itemType, child.Data)
			if err != nil {
				return nil, err
			}
			if _, err := ApplyOperations(child, resolvedType, op.ItemOperations.ObjOperations, summary); err != nil {
				return nil, err
			}
			arr[i] = child.Data
			summary.AddIndex(i)
		}
		editor.Data = arr
		return nil, nil
	case "clear":
		editor.Data = []any{}
		return editor.Data, nil
	default:
		return nil, fmt.Errorf("unsupported array op: %s", op.Name)
	}
}

func applyObjectOperation(editor *JSONEditor, op ObjOperations, summary *EditSummary) (any, error) {
	var obj, ok = editor.Data.(map[string]any)
	if !ok {
		return nil, fmt.Errorf("not an object")
	}
	switch op.Name {
	case "set":
		if op.Field == "" {
			return nil, fmt.Errorf("set requires field")
		}
		obj[op.Field] = op.Value
		summary.AddField(op.Field)
		return op.Value, nil
	case "delete":
		if op.Field == "" {
			return nil, fmt.Errorf("delete requires field")
		}
		var deleted, exist = obj[op.Field]
		if exist {
			delete(obj, op.Field)
			summary.AddField(op.Field)
			return deleted, nil
		}
		return nil, nil
	case "clear":
		editor.Data = map[string]any{}
		return editor.Data, nil
	case "read":
		if op.Field == "" {
			return obj, nil
		}
		val := obj[op.Field]
		summary.AddField(op.Field)
		return val, nil
	case "has":
		if op.Field == "" {
			return nil, fmt.Errorf("has requires field")
		}
		_, ok := obj[op.Field]
		summary.AddField(op.Field)
		return ok, nil
	case "map":
		if op.ItemOperations == nil || len(op.ItemOperations.ObjOperations) == 0 {
			return nil, fmt.Errorf("map requires itemOperations")
		}
		var itemType = op.ItemOperations.ObjType
		for key, val := range obj {
			var child = &JSONEditor{Data: val}
			var resolvedType, err = ResolveObjType(itemType, child.Data)
			if err != nil {
				return nil, err
			}
			if _, err := ApplyOperations(child, resolvedType, op.ItemOperations.ObjOperations, summary); err != nil {
				return nil, err
			}
			obj[key] = child.Data
			summary.AddField(key)
		}
		return nil, nil
	default:
		return nil, fmt.Errorf("unsupported object op: %s", op.Name)
	}
}
