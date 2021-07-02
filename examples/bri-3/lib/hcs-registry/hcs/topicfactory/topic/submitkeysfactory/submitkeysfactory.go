package submitkeysfactory

import (
	"bri-3/hcs/topicfactory/topic/submitkeysfactory/submitkeys"
	"bri-3/hcs/utils"
	"bri-3/models"

	"github.com/hashgraph/hedera-sdk-go"
)

type SubmitKeysFactory struct {
	hederaClient *hedera.Client
}

func (submitKeysFactory *SubmitKeysFactory) SetTx(txCreator *models.TransactionSigner, topicID string, publicKeys []string) (*submitkeys.SubmitKeys, error) {
	topicIDFromString, err := hedera.TopicIDFromString(topicID)
	if err != nil {
		return &submitkeys.SubmitKeys{}, err
	}

	transactionID := hedera.TransactionIDGenerate(*txCreator.Account)
	nodesIDs := submitKeysFactory.hederaClient.GetNetworkNodes()
	thresholdKey, err := utils.AssembleKey(publicKeys, 1)
	if err != nil {
		return &submitkeys.SubmitKeys{}, err
	}

	transaction, err := hedera.NewTopicUpdateTransaction().
		SetAdminKey(thresholdKey).
		SetSubmitKey(thresholdKey).
		SetTopicID(topicIDFromString).
		SetTransactionID(transactionID).
		SetNodeAccountIDs(nodesIDs).
		Freeze()

	if err != nil {
		return &submitkeys.SubmitKeys{}, err
	}

	return submitkeys.NewSubmitKeys(submitKeysFactory.hederaClient, txCreator, transaction), nil
}

func NewSubmitKeysFactory(client *hedera.Client) *SubmitKeysFactory {
	return &SubmitKeysFactory{
		hederaClient: client,
	}
}
