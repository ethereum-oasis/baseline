package hcs

import (
	"bri-3/hcs/topicfactory/topic"
	"bri-3/hcs/topicfactory/topic/messagefactory/message"
	"bri-3/hcs/topicfactory/topic/submitkeysfactory/submitkeys"
	"bri-3/models"
	"fmt"
	"time"

	"github.com/hashgraph/hedera-sdk-go"
)

type BaseTopicOperations struct {
	HCSClient *HCSClient
}

// Max message size in bytes
var maxMessageSize = 6000

func (baseOperations *BaseTopicOperations) CreateTx(txCreator *models.TransactionSigner, publicKeys []string, description string, maxFee float64) (*topic.Topic, error) {
	return baseOperations.HCSClient.Topic.CreateTx(txCreator, publicKeys, description, maxFee)
}

func (baseOperations *BaseTopicOperations) CreateAndBroadcast(txCreator *models.TransactionSigner, privKey string, publicKeys []string, description string, maxFee float64) (string, error) {
	topicTx, err := baseOperations.CreateTx(txCreator, publicKeys, description, maxFee)
	if err != nil {
		return "", err
	}

	err = topicTx.SignImplicitly(privKey)
	if err != nil {
		return "", err
	}

	return topicTx.Broadcast()
}

func (baseOperations *BaseTopicOperations) SetPartiesTx(txCreator *models.TransactionSigner, topicID string, publicKeys []string) (*submitkeys.SubmitKeys, error) {
	return baseOperations.HCSClient.Topic.SubmitKeys.SetTx(txCreator, topicID, publicKeys)
}

func (baseOperations *BaseTopicOperations) SetPartiesAndBroadcast(txCreator *models.TransactionSigner, privKey string, topicID string, publicKeys []string) error {
	submitKeysTx, err := baseOperations.SetPartiesTx(txCreator, topicID, publicKeys)
	if err != nil {
		return err
	}

	err = submitKeysTx.SignImplicitly(privKey)
	if err != nil {
		return err
	}

	return submitKeysTx.Broadcast()
}

func (baseOperations *BaseTopicOperations) SubmitMessageTx(txCreator *models.TransactionSigner, topicID string, messageText []byte, description string, maxFee float64) (*message.Message, error) {
	if len(messageText) > maxMessageSize {
		return &message.Message{}, fmt.Errorf("message size exceed %v", maxMessageSize)
	}

	return baseOperations.HCSClient.Topic.Message.SubmitTx(txCreator, topicID, messageText, description, maxFee)
}

func (baseOperations *BaseTopicOperations) SubmitMessageAndBroadcast(txCreator *models.TransactionSigner, privKey string, topicID string, messageText []byte, description string, maxFee float64) error {
	messageTx, err := baseOperations.SubmitMessageTx(txCreator, topicID, messageText, description, maxFee)
	if err != nil {
		return err
	}

	err = messageTx.SignImplicitly(privKey)
	if err != nil {
		return err
	}

	return messageTx.Broadcast()
}

func (baseOperations *BaseTopicOperations) SubscribeTo(topicId string, start *time.Time, callback func(hedera.TopicMessage)) error {
	return baseOperations.HCSClient.Topic.SubscribeTo(topicId, start, callback)
}

func NewBaseTopicOperations(client *hedera.Client) *BaseTopicOperations {
	return &BaseTopicOperations{
		HCSClient: NewHCSClient(client),
	}
}
