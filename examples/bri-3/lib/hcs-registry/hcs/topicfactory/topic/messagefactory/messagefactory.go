package messagefactory

import (
	"bri-3/hcs/topicfactory/topic/messagefactory/message"
	"bri-3/models"

	"github.com/hashgraph/hedera-sdk-go"
)

type MessageFactory struct {
	hederaClient *hedera.Client
}

func (messageFactory *MessageFactory) SubmitTx(txCreator *models.TransactionSigner, topicID string, messageText []byte, memo string, maxFee float64) (*message.Message, error) {
	topicIDFromString, err := hedera.TopicIDFromString(topicID)
	if err != nil {
		return &message.Message{}, err
	}

	transactionID := hedera.TransactionIDGenerate(*txCreator.Account)
	nodesIDs := messageFactory.hederaClient.GetNetworkNodes()

	transaction, err := hedera.NewTopicMessageSubmitTransaction().
		SetMessage(messageText).
		SetTransactionMemo(memo).
		SetTopicID(topicIDFromString).
		SetTransactionID(transactionID).
		SetNodeAccountIDs(nodesIDs).
		SetMaxTransactionFee(hedera.HbarFrom(maxFee, hedera.HbarUnits.Hbar)).
		Freeze()

	if err != nil {
		return &message.Message{}, err
	}

	return message.NewMessage(messageFactory.hederaClient, txCreator, transaction), nil
}

func NewMessageFactory(client *hedera.Client) *MessageFactory {
	return &MessageFactory{
		hederaClient: client,
	}
}
