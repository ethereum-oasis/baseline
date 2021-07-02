package message

import (
	"bri-3/hcs/common"
	"bri-3/models"
	"fmt"

	"github.com/hashgraph/hedera-sdk-go"
)

type Message struct {
	hederaClient *hedera.Client
	transaction  *hedera.TopicMessageSubmitTransaction
	common.RawTransaction
}

func (message *Message) Broadcast() (err error) {
	response, err := message.transaction.Execute(message.hederaClient)
	if err != nil {
		return err
	}

	receipt, err := response.GetReceipt(message.hederaClient)
	if err != nil {
		return err
	}

	if receipt.Status.String() != "SUCCESS" {
		return fmt.Errorf("SubmitMessage: Transaction status %s", receipt.Status.String())
	}

	return nil
}

func NewMessage(client *hedera.Client, txCreator *models.TransactionSigner, tx *hedera.TopicMessageSubmitTransaction) *Message {
	return &Message{
		hederaClient:   client,
		transaction:    tx,
		RawTransaction: *common.NewRawTransaction(txCreator, tx),
	}
}
