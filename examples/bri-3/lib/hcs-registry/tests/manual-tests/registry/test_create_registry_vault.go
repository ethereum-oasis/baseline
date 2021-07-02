package manualtest

import (
	"bri-3/hcs"
	"bri-3/models"
	"fmt"
	"os"

	"github.com/hashgraph/hedera-sdk-go"
)

func main() {
	os.Setenv("VAULT_API_HOST", "localhost:8082")
	os.Setenv("VAULT_API_SCHEME", "http")

	keyID := "3126587b-69ca-4fa1-90fe-3c5bba464ea2"
	vaultID := "9e1ddf0b-b97c-4ead-a1c2-1f3115b6044d"
	vaultPubKey := "5ff11bf216ad5f4898d1875c6c13f06d3f221d53342b13781a92c1e0c28d7251"
	tokenStr := "eyJhbGciOiJSUzI1NiIsImtpZCI6IjEwOjJlOmQ5OmUxOmI4OmEyOjM0OjM3Ojk5OjNhOjI0OmZjOmFhOmQxOmM4OjU5IiwidHlwIjoiSldUIn0.eyJhdWQiOiJodHRwczovL3Byb3ZpZGUuc2VydmljZXMvYXBpL3YxIiwiZXhwIjoxNjExMjE5MzQwLCJpYXQiOjE2MTExMzI5NDAsImlzcyI6Imh0dHBzOi8vaWRlbnQucHJvdmlkZS5zZXJ2aWNlcyIsImp0aSI6IjZkODgxYmU3LTUyZDEtNDY5Ny1hODIyLWRjZjhmYmY3YjVkYyIsIm5hdHMiOnsicGVybWlzc2lvbnMiOnsicHVibGlzaCI6eyJhbGxvdyI6WyJiYXNlbGluZS5cdTAwM2UiXX0sInN1YnNjcmliZSI6eyJhbGxvdyI6WyJ1c2VyLmNjNWE2ZTk1LTNhZGMtNGVmZC1iZTFlLTA4ZjdhY2Y0N2E1NiIsIm5ldHdvcmsuKi5jb25uZWN0b3IuKiIsIm5ldHdvcmsuKi5zdGF0dXMiLCJwbGF0Zm9ybS5cdTAwM2UiLCJiYXNlbGluZS5cdTAwM2UiXX19fSwicHJ2ZCI6eyJwZXJtaXNzaW9ucyI6NDE1LCJ1c2VyX2lkIjoiY2M1YTZlOTUtM2FkYy00ZWZkLWJlMWUtMDhmN2FjZjQ3YTU2In0sInN1YiI6InVzZXI6Y2M1YTZlOTUtM2FkYy00ZWZkLWJlMWUtMDhmN2FjZjQ3YTU2In0.rslE3hVlD4cxJs9yNvN9XzkbSQuWI3Py9awNeLfHh0MebvvBqnXJxyYufgDGNlqiZlfBGwYfXMg4DsbSUiieneKJqwMrGSoF4jEKwlLByNCFRtTucgPYKpgt82gRpgM82J2aB9xH3s7nL6OC4BCWq1xo6mGlQ3me3vtoOpxN4PU-Oxmxrs51WFCiWNtvqHCbtHqYkCZmLFIO2KBeiO7v02MIA5niKZEUoT2nJ4rQnt9d2KFpR03rqlg3q0kvNGH0OEZ9Zkg08IcuX4imvNfHwycgkHQl8A4bGIbeYddRn0lkBeSLdzdEdvp7XMtKk_m2rT_HcFKQqRy0geQve7zgdbLJ1VxKR77HfX_hKe5qPPubGUUZHYgVAFAGkLQK8mKJaiuGLrsGpL3X8PkoiUW0CJBGZkj2RqYCTD6tCzVgY3bTPJM_sCCXj1dxhMMVxihYkq294jeD-0A5oeSDa6Rb9dcGWFQbUoBvslbQ9hlyn3yMrVo1kzDG1pnBJN9CeGZN0b0grXJ5vN6zYGH3dCZda3kti7KeWlEwcGzScvatAYOjeZy6m5t7ATYg_CckRvyZQ-oyK0zu8vmPKOhbSy7hmMesVu9kgXne_NTVeepEIcbLEMHQrAlSY4pu90bKqkPz5pU_l6e2ewx2Fs-86FjZGs5CCfD0YYBqc6msT0o2-Tw"

	hederaClient := hedera.ClientForTestnet()
	hederaClient.SetEmptyOperator()

	registry := hcs.NewRegistry(hederaClient)
	signer, err := models.NewTransactionSigner("0.0.269869", vaultPubKey)

	registryTx, err := registry.CreateTx(
		signer,
		[]string{
			vaultPubKey,
		},
		"Testing Registry",
		1,
	)

	if err != nil {
		panic(err)
	}

	err = registryTx.VaultSign(tokenStr, vaultID, keyID)
	if err != nil {
		panic(err)
	}

	registryID, err := registryTx.Broadcast()
	if err != nil {
		panic(err)
	}

	fmt.Printf("%s\n", registryID)
}
