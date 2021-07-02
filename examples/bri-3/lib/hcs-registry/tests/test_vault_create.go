package test

import (
	"encoding/json"
	"fmt"
	"os"

	provide "github.com/provideservices/provide-go/api/vault"
	// FIXME!!
)

func keyFactory(token, vaultID, keyType, keyUsage, keySpec, keyName, keyDescription string) (*provide.Key, error) {
	resp, err := provide.CreateKey(token, vaultID, map[string]interface{}{
		"type":        keyType,
		"usage":       keyUsage,
		"spec":        keySpec,
		"name":        keyName,
		"description": keyDescription,
	})

	if err != nil {
		return nil, fmt.Errorf("failed to create key error: %s", err.Error())
	}

	key := &provide.Key{}
	respRaw, err := json.Marshal(resp)
	if err != nil {
		return nil, fmt.Errorf("failed to marshall key data: %s", err.Error())
	}
	json.Unmarshal(respRaw, &key)
	return key, nil
}

func vaultFactory(token, name, desc string) (*provide.Vault, error) {
	resp, err := provide.CreateVault(token, map[string]interface{}{
		"name":        name,
		"description": desc,
	})
	if err != nil {
		return nil, err
	}
	vlt := &provide.Vault{}
	respRaw, err := json.Marshal(resp)
	if err != nil {
		return nil, err
	}
	json.Unmarshal(respRaw, &vlt)
	return vlt, nil
}

func main() {

	os.Setenv("VAULT_API_HOST", "localhost:8082")
	os.Setenv("VAULT_API_SCHEME", "http")

	tokenStr := "eyJhbGciOiJSUzI1NiIsImtpZCI6IjEwOjJlOmQ5OmUxOmI4OmEyOjM0OjM3Ojk5OjNhOjI0OmZjOmFhOmQxOmM4OjU5IiwidHlwIjoiSldUIn0.eyJhdWQiOiJodHRwczovL3Byb3ZpZGUuc2VydmljZXMvYXBpL3YxIiwiZXhwIjoxNjExMjE5MzQwLCJpYXQiOjE2MTExMzI5NDAsImlzcyI6Imh0dHBzOi8vaWRlbnQucHJvdmlkZS5zZXJ2aWNlcyIsImp0aSI6IjZkODgxYmU3LTUyZDEtNDY5Ny1hODIyLWRjZjhmYmY3YjVkYyIsIm5hdHMiOnsicGVybWlzc2lvbnMiOnsicHVibGlzaCI6eyJhbGxvdyI6WyJiYXNlbGluZS5cdTAwM2UiXX0sInN1YnNjcmliZSI6eyJhbGxvdyI6WyJ1c2VyLmNjNWE2ZTk1LTNhZGMtNGVmZC1iZTFlLTA4ZjdhY2Y0N2E1NiIsIm5ldHdvcmsuKi5jb25uZWN0b3IuKiIsIm5ldHdvcmsuKi5zdGF0dXMiLCJwbGF0Zm9ybS5cdTAwM2UiLCJiYXNlbGluZS5cdTAwM2UiXX19fSwicHJ2ZCI6eyJwZXJtaXNzaW9ucyI6NDE1LCJ1c2VyX2lkIjoiY2M1YTZlOTUtM2FkYy00ZWZkLWJlMWUtMDhmN2FjZjQ3YTU2In0sInN1YiI6InVzZXI6Y2M1YTZlOTUtM2FkYy00ZWZkLWJlMWUtMDhmN2FjZjQ3YTU2In0.rslE3hVlD4cxJs9yNvN9XzkbSQuWI3Py9awNeLfHh0MebvvBqnXJxyYufgDGNlqiZlfBGwYfXMg4DsbSUiieneKJqwMrGSoF4jEKwlLByNCFRtTucgPYKpgt82gRpgM82J2aB9xH3s7nL6OC4BCWq1xo6mGlQ3me3vtoOpxN4PU-Oxmxrs51WFCiWNtvqHCbtHqYkCZmLFIO2KBeiO7v02MIA5niKZEUoT2nJ4rQnt9d2KFpR03rqlg3q0kvNGH0OEZ9Zkg08IcuX4imvNfHwycgkHQl8A4bGIbeYddRn0lkBeSLdzdEdvp7XMtKk_m2rT_HcFKQqRy0geQve7zgdbLJ1VxKR77HfX_hKe5qPPubGUUZHYgVAFAGkLQK8mKJaiuGLrsGpL3X8PkoiUW0CJBGZkj2RqYCTD6tCzVgY3bTPJM_sCCXj1dxhMMVxihYkq294jeD-0A5oeSDa6Rb9dcGWFQbUoBvslbQ9hlyn3yMrVo1kzDG1pnBJN9CeGZN0b0grXJ5vN6zYGH3dCZda3kti7KeWlEwcGzScvatAYOjeZy6m5t7ATYg_CckRvyZQ-oyK0zu8vmPKOhbSy7hmMesVu9kgXne_NTVeepEIcbLEMHQrAlSY4pu90bKqkPz5pU_l6e2ewx2Fs-86FjZGs5CCfD0YYBqc6msT0o2-Tw"

	vault, err := vaultFactory(tokenStr, "vaulty vault", "just a vault with a key")
	if err != nil {
		fmt.Errorf("failed to create vault; %s", err.Error())
	}

	key, err := keyFactory(tokenStr, vault.ID.String(), "asymmetric", "sign/verify", "Ed25519", "namey name", "cute description")
	if err != nil {
		fmt.Errorf("failed to create key; %s", err.Error())
	}

	fmt.Printf("vaultId %s", vault.ID.String())
	fmt.Printf("keyId %s", key.ID.String())
}
