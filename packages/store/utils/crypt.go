package utils

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/sha256"
	"encoding/binary"
	"errors"
	"io"
)

func Crypt(key string, data []byte, idx int) ([]byte, error) {
	if len(data) == 0 {
		return []byte{}, nil
	}

	var block, err = aes.NewCipher(deriveAESKey(key))
	if err != nil {
		return nil, err
	}

	var out = make([]byte, len(data))
	var stream = cipher.NewCTR(block, deriveChunkIV(key, idx))
	stream.XORKeyStream(out, data)

	return out, nil
}

func CryptStream(key string, idx int, in io.Reader, out io.Writer, ctx context.Context) (int64, error) {
	if in == nil {
		return 0, errors.New("nil reader")
	}
	if out == nil {
		return 0, errors.New("nil writer")
	}

	var block, err = aes.NewCipher(deriveAESKey(key))
	if err != nil {
		return 0, err
	}

	if ctx != nil {
		in = &ctxReader{
			ctx: ctx,
			r:   in,
		}
	}

	var stream = cipher.NewCTR(block, deriveChunkIV(key, idx))
	var reader = &cipher.StreamReader{
		S: stream,
		R: in,
	}

	return io.Copy(out, reader)
}

func deriveAESKey(key string) []byte {
	sum := sha256.Sum256([]byte("ase-key-v1" + key))
	return sum[:]
}

func deriveChunkIV(key string, idx int) []byte {
	var idxBuf [8]byte
	binary.BigEndian.PutUint64(idxBuf[:], uint64(idx)) // 大端序

	h := sha256.New()
	h.Write([]byte("chunk-iv-v1"))
	h.Write([]byte(key))
	h.Write(idxBuf[:])
	sum := h.Sum(nil)

	iv := make([]byte, aes.BlockSize)
	copy(iv, sum[:aes.BlockSize])

	return iv
}

type ctxReader struct {
	ctx context.Context
	r   io.Reader
}

func (Self *ctxReader) Read(p []byte) (int, error) {
	select {
	case <-Self.ctx.Done():
		return 0, Self.ctx.Err()
	default:
		return Self.r.Read(p)
	}
}
