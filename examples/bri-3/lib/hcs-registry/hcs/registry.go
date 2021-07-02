package hcs

import (
	"encoding/json"
	"fmt"
	"time"

	"bri-3/hcs/topicfactory/topic/messagefactory/message"
	"bri-3/hcs/topicfactory/topic/submitkeysfactory/submitkeys"
	"bri-3/models"

	"github.com/hashgraph/hedera-sdk-go"
)

type Registry struct {
	BaseTopicOperations
}

func (registry *Registry) SetPartiesTx(txCreator *models.TransactionSigner, registryID string, publicKeys []string) (*submitkeys.SubmitKeys, error) {
	return registry.BaseTopicOperations.SetPartiesTx(txCreator, registryID, publicKeys)
}

func (registry *Registry) SetPartiesAndBroadcast(txCreator *models.TransactionSigner, privKey string, registryID string, publicKeys []string) error {
	return registry.BaseTopicOperations.SetPartiesAndBroadcast(txCreator, privKey, registryID, publicKeys)
}

func (registry *Registry) RegisterTx(txCreator *models.TransactionSigner, registryID string, org *models.Organization, maxFee float64) (*message.Message, error) {
	payload, err := json.Marshal(org)
	if err != nil {
		return &message.Message{}, err
	}

	return registry.HCSClient.Topic.Message.SubmitTx(txCreator, registryID, payload, "", maxFee)
}

func (registry *Registry) RegisterAndBroadcast(txCreator *models.TransactionSigner, privKey string, registryID string, org *models.Organization, maxFee float64) error {
	rawTransaction, err := registry.RegisterTx(txCreator, registryID, org, maxFee)
	if err != nil {
		return err
	}

	err = rawTransaction.SignImplicitly(privKey)
	if err != nil {
		return err
	}

	return rawTransaction.Broadcast()
}

func (registry *Registry) SubmitMessageTx(txCreator *models.TransactionSigner, registryID string, proof []byte, description string, maxFee float64) (message.Message, error) {
	return message.Message{}, fmt.Errorf("use RegisterTx function instead")
}

func (registry *Registry) SubmitMessageAndBroadcast(txCreator *models.TransactionSigner, privKey string, registryID string, messageText []byte, description string, maxFee float64) error {
	return fmt.Errorf("use RegisterAndBroadcast function instead")
}

func (registry *Registry) SubscribeTo(registryID string, start *time.Time, callback func(hedera.TopicMessage)) error {
	return registry.BaseTopicOperations.SubscribeTo(registryID, start, callback)
}

func NewRegistry(client *hedera.Client) *Registry {
	return &Registry{
		BaseTopicOperations{
			HCSClient: NewHCSClient(client),
		},
	}
}
