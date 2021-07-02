package topic

import (
	"bri-3/hcs/common"
	"bri-3/models"
	"fmt"

	"github.com/hashgraph/hedera-sdk-go"
)

type Topic struct {
	hederaClient *hedera.Client
	transaction  *hedera.TopicCreateTransaction
	common.RawTransaction
}

func (topic *Topic) Broadcast() (string, error) {
	response, err := topic.transaction.Execute(topic.hederaClient)
	if err != nil {
		return "", err
	}

	receipt, err := response.GetReceipt(topic.hederaClient)
	if err != nil {
		return "", err
	}

	if receipt.Status.String() != "SUCCESS" {
		return "", fmt.Errorf("BroadcastTopic: Transaction status %s", receipt.Status.String())
	}

	topicID := *receipt.TopicID
	return topicID.String(), nil
}

func NewTopic(client *hedera.Client, txCreator *models.TransactionSigner, tx *hedera.TopicCreateTransaction) *Topic {
	return &Topic{
		hederaClient:   client,
		transaction:    tx,
		RawTransaction: *common.NewRawTransaction(txCreator, tx),
	}
}
