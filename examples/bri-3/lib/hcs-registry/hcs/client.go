package hcs

import (
	"bri-3/hcs/accountfactory"
	"bri-3/hcs/topicfactory"

	"github.com/hashgraph/hedera-sdk-go"
)

type HCSClient struct {
	HederaClient *hedera.Client
	Topic        *topicfactory.TopicFactory
	Account      *accountfactory.AccountFactory
}

func NewHCSClient(client *hedera.Client) *HCSClient {
	return &HCSClient{
		HederaClient: client,
		Topic:        topicfactory.NewTopicFactory(client),
		Account:      accountfactory.NewAccountFactory(client),
	}
}
