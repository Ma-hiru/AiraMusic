package jsonEditer

import "fmt"

func (Self *JSONEditor) SetObjectField(key string, value any) error {
	m, ok := Self.Data.(map[string]any)
	if !ok {
		return fmt.Errorf("data is not an object")
	}
	m[key] = value
	return nil
}

func (Self *JSONEditor) DeleteObjectField(key string) error {
	m, ok := Self.Data.(map[string]any)
	if !ok {
		return fmt.Errorf("data is not an object")
	}
	delete(m, key)
	return nil
}

func (Self *JSONEditor) ReadObjectField(key string) (any, error) {
	m, ok := Self.Data.(map[string]any)
	if !ok {
		return nil, fmt.Errorf("data is not an object")
	}
	return m[key], nil
}
