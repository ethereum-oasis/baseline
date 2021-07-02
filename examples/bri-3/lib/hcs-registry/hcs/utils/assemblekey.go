package utils

import (
	"github.com/hashgraph/hedera-sdk-go"
)

func AssembleKey(publicKeys []string, threshold uint) (hedera.Key, error) {
	if len(publicKeys) > 0 {
		k := hedera.KeyListWithThreshold(threshold)

		for i := 0; i < len(publicKeys); i++ {
			publicKey, err := hedera.PublicKeyFromString(publicKeys[i])
			if err != nil {
				return nil, err
			}
			k = k.Add(publicKey)
		}
		return k, nil
	}

	return hedera.KeyListWithThreshold(0), nil
}
