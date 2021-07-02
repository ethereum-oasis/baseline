package accountkey

import (
	"bri-3/hcs/common"
	"bri-3/models"
	"fmt"

	"github.com/hashgraph/hedera-sdk-go"
)

type AccountKey struct {
	hederaClient *hedera.Client
	transaction  *hedera.AccountUpdateTransaction
	common.RawTransaction
}

func (accountKey *AccountKey) Broadcast() error {
	response, err := accountKey.transaction.Execute(accountKey.hederaClient)
	if err != nil {
		return err
	}

	receipt, err := response.GetReceipt(accountKey.hederaClient)
	if err != nil {
		return err
	}

	if receipt.Status.String() != "SUCCESS" {
		return fmt.Errorf("SetAccount key: Transaction status %s", receipt.Status.String())
	}

	return nil
}

func NewAccountKey(client *hedera.Client, txCreator *models.TransactionSigner, tx *hedera.AccountUpdateTransaction) *AccountKey {
	return &AccountKey{
		hederaClient:   client,
		transaction:    tx,
		RawTransaction: *common.NewRawTransaction(txCreator, tx),
	}
}
