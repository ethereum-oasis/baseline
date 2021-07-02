package topicfactory

import (
	"bri-3/hcs/topicfactory/topic"
	"bri-3/hcs/topicfactory/topic/messagefactory"
	"bri-3/hcs/topicfactory/topic/submitkeysfactory"
	"bri-3/hcs/utils"
	"bri-3/models"

	"time"

	"github.com/hashgraph/hedera-sdk-go"
)

type TopicFactory struct {
	hederaClient *hedera.Client

	Message    *messagefactory.MessageFactory
	SubmitKeys *submitkeysfactory.SubmitKeysFactory
}

func (topicFactory *TopicFactory) CreateTx(txCreator *models.TransactionSigner, publicKeys []string, memo string, maxFee float64) (*topic.Topic, error) {
	transactionID := hedera.TransactionIDGenerate(*txCreator.Account)
	nodesIDs := topicFactory.hederaClient.GetNetworkNodes()
	thresholdKey, err := utils.AssembleKey(publicKeys, 1)
	if err != nil {
		return &topic.Topic{}, err
	}

	transaction, err := hedera.NewTopicCreateTransaction().
		SetAdminKey(thresholdKey).
		SetSubmitKey(thresholdKey).
		SetTransactionMemo(memo).
		SetTransactionID(transactionID).
		SetNodeAccountIDs(nodesIDs).
		SetMaxTransactionFee(hedera.HbarFrom(maxFee, hedera.HbarUnits.Hbar)).
		Freeze()

	if err != nil {
		return &topic.Topic{}, err
	}

	return topic.NewTopic(topicFactory.hederaClient, txCreator, transaction), nil
}

func (topicFactory *TopicFactory) SubscribeTo(topicID string, start *time.Time, callback func(hedera.TopicMessage)) (err error) {
	topicIDFromString, err := hedera.TopicIDFromString(topicID)
	if err != nil {
		return err
	}

	startTime := time.Unix(0, 0)
	if start != nil {
		startTime = *start
	}

	_, err = hedera.NewTopicMessageQuery().
		SetTopicID(topicIDFromString).
		SetStartTime(startTime).
		Subscribe(topicFactory.hederaClient, callback)

	return err
}

func NewTopicFactory(client *hedera.Client) *TopicFactory {
	return &TopicFactory{
		hederaClient: client,

		Message:    messagefactory.NewMessageFactory(client),
		SubmitKeys: submitkeysfactory.NewSubmitKeysFactory(client),
	}
}
