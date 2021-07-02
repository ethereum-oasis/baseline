package models

import "github.com/hashgraph/hedera-sdk-go"

type TransactionSigner struct {
	Account   *hedera.AccountID
	PublicKey *hedera.PublicKey
}

func NewTransactionSigner(accountID string, pubKey string) (*TransactionSigner, error) {
	account, err := hedera.AccountIDFromString(accountID)
	if err != nil {
		return &TransactionSigner{}, err
	}

	publicKey, err := hedera.PublicKeyFromString(pubKey)
	if err != nil {
		return &TransactionSigner{}, err
	}

	return &TransactionSigner{
		Account:   &account,
		PublicKey: &publicKey,
	}, nil
}
