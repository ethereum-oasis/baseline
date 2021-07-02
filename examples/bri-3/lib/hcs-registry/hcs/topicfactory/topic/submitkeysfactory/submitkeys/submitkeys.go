package submitkeys

import (
	"bri-3/hcs/common"
	"bri-3/models"
	"fmt"

	"github.com/hashgraph/hedera-sdk-go"
)

type SubmitKeys struct {
	hederaClient *hedera.Client
	transaction  *hedera.TopicUpdateTransaction
	common.RawTransaction
}

func (submitKeys *SubmitKeys) Broadcast() (err error) {
	response, err := submitKeys.transaction.Execute(submitKeys.hederaClient)
	if err != nil {
		return err
	}

	receipt, err := response.GetReceipt(submitKeys.hederaClient)
	if err != nil {
		return err
	}

	if receipt.Status.String() != "SUCCESS" {
		return fmt.Errorf("SetSubmitKeys: Transaction status %s", receipt.Status.String())
	}

	return nil
}

func NewSubmitKeys(client *hedera.Client, txCreator *models.TransactionSigner, tx *hedera.TopicUpdateTransaction) *SubmitKeys {
	return &SubmitKeys{
		hederaClient:   client,
		transaction:    tx,
		RawTransaction: *common.NewRawTransaction(txCreator, tx),
	}
}
