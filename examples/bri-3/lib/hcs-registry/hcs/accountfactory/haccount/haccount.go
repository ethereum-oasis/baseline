package haccount

import (
	"bri-3/hcs/common"
	"bri-3/models"
	"fmt"

	"github.com/hashgraph/hedera-sdk-go"
)

type HAccount struct {
	hederaClient *hedera.Client
	transaction  *hedera.AccountCreateTransaction
	common.RawTransaction
}

func (hAccount *HAccount) Broadcast() (string, error) {
	response, err := hAccount.transaction.Execute(hAccount.hederaClient)
	if err != nil {
		return "", err
	}

	receipt, err := response.GetReceipt(hAccount.hederaClient)
	if err != nil {
		return "", err
	}

	if receipt.Status.String() != "SUCCESS" {
		return "", fmt.Errorf("BroadcastAccountCreation: Transaction status %s", receipt.Status.String())
	}

	accountID := *receipt.AccountID
	return accountID.String(), nil
}

func NewHAccount(client *hedera.Client, txCreator *models.TransactionSigner, tx *hedera.AccountCreateTransaction) *HAccount {
	return &HAccount{
		hederaClient:   client,
		transaction:    tx,
		RawTransaction: *common.NewRawTransaction(txCreator, tx),
	}
}
