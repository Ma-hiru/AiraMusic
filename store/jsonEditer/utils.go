package jsonEditer

import (
	"encoding/json"
	"fmt"
	"strconv"
)

func toInt(value any) (int, error) {
	switch v := value.(type) {
	case nil:
		return 0, fmt.Errorf("value is nil")
	case int:
		return v, nil
	case int64:
		return int(v), nil
	case float64:
		return int(v), nil
	case json.Number:
		parsed, err := v.Int64()
		if err != nil {
			return 0, err
		}
		return int(parsed), nil
	case string:
		parsed, err := strconv.Atoi(v)
		if err != nil {
			return 0, err
		}
		return parsed, nil
	default:
		return 0, fmt.Errorf("unsupported number type %T", value)
	}
}

func ResolveObjType(objType string, data any) (string, error) {
	if objType != "" {
		return objType, nil
	}
	switch data.(type) {
	case []any:
		return "array", nil
	case map[string]any:
		return "object", nil
	default:
		return "", fmt.Errorf("unable to infer object type")
	}
}
