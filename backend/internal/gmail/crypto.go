package gmail

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
)

func Seal(key, value, owner string) (string, error) {
	gcm, err := tokenCipher(key)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return "", err
	}
	return base64.RawStdEncoding.EncodeToString(gcm.Seal(nonce, nonce, []byte(value), []byte(owner))), nil
}
func Open(key, value, owner string) (string, error) {
	gcm, err := tokenCipher(key)
	if err != nil {
		return "", err
	}
	b, err := base64.RawStdEncoding.DecodeString(value)
	if err != nil || len(b) < gcm.NonceSize() {
		return "", errors.New("invalid_encrypted_token")
	}
	plain, err := gcm.Open(nil, b[:gcm.NonceSize()], b[gcm.NonceSize():], []byte(owner))
	if err != nil {
		return "", errors.New("invalid_encrypted_token")
	}
	return string(plain), nil
}
func tokenCipher(key string) (cipher.AEAD, error) {
	b, err := base64.StdEncoding.DecodeString(key)
	if err != nil || len(b) != 32 {
		return nil, errors.New("GMAIL_TOKEN_ENCRYPTION_KEY must be base64 of 32 bytes")
	}
	block, err := aes.NewCipher(b)
	if err != nil {
		return nil, err
	}
	return cipher.NewGCM(block)
}
