package jsonEditer

import "fmt"

func (Self *JSONEditor) GetArray() ([]any, error) {
	arr, ok := Self.Data.([]any)
	if !ok {
		return nil, fmt.Errorf("not an array")
	}
	return arr, nil
}

func (Self *JSONEditor) SetArrayIndex(index int, value any) error {
	arr, err := Self.GetArray()
	if err != nil {
		return err
	}
	if index < 0 || index >= len(arr) {
		return fmt.Errorf("index out of range")
	}
	arr[index] = value
	return nil
}

func (Self *JSONEditor) ReadArrayIndex(index int) (any, error) {
	arr, err := Self.GetArray()
	if err != nil {
		return nil, err
	}
	if index < 0 || index >= len(arr) {
		return nil, fmt.Errorf("index out of range")
	}
	return arr[index], nil
}

func (Self *JSONEditor) DeleteArrayIndex(index int) error {
	arr, err := Self.GetArray()
	if err != nil {
		return err
	}
	if index < 0 || index >= len(arr) {
		return fmt.Errorf("index out of range")
	}
	Self.Data = append(arr[:index], arr[index+1:]...)
	return nil
}

func (Self *JSONEditor) Push(value any) error {
	arr, err := Self.GetArray()
	if err != nil {
		return err
	}
	Self.Data = append(arr, value)
	return nil
}

func (Self *JSONEditor) Pop() (any, error) {
	arr, err := Self.GetArray()
	if err != nil {
		return nil, err
	}
	if len(arr) == 0 {
		return nil, fmt.Errorf("empty array")
	}
	last := arr[len(arr)-1]
	Self.Data = arr[:len(arr)-1]
	return last, nil
}

func (Self *JSONEditor) Shift() (any, error) {
	arr, err := Self.GetArray()
	if err != nil {
		return nil, err
	}
	if len(arr) == 0 {
		return nil, fmt.Errorf("empty array")
	}
	first := arr[0]
	Self.Data = arr[1:]
	return first, nil
}

func (Self *JSONEditor) Unshift(value any) error {
	arr, err := Self.GetArray()
	if err != nil {
		return err
	}
	Self.Data = append([]any{value}, arr...)
	return nil
}

func (Self *JSONEditor) Splice(start, deleteCount int, items ...any) error {
	arr, err := Self.GetArray()
	if err != nil {
		return err
	}

	if start < 0 {
		start = len(arr) + start
	}
	if start < 0 {
		start = 0
	}
	if start > len(arr) {
		start = len(arr)
	}

	end := start + deleteCount
	if end > len(arr) {
		end = len(arr)
	}

	Self.Data = append(arr[:start], append(items, arr[end:]...)...)
	return nil
}
