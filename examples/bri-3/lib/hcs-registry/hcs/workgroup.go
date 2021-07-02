package hcs

import (
	"time"

	"github.com/hashgraph/hedera-sdk-go"

	"bri-3/hcs/topicfactory/topic/messagefactory/message"
	"bri-3/hcs/topicfactory/topic/submitkeysfactory/submitkeys"
	"bri-3/models"
)

type WorkgroupService struct {
	BaseTopicOperations
}

func (workgroupService *WorkgroupService) SetPartiesTx(txCreator *models.TransactionSigner, workgroupID string, publicKeys []string) (*submitkeys.SubmitKeys, error) {
	return workgroupService.BaseTopicOperations.SetPartiesTx(txCreator, workgroupID, publicKeys)
}

func (workgroupService *WorkgroupService) SetPartiesAndBroadcast(txCreator *models.TransactionSigner, privKey string, workgroupID string, publicKeys []string) error {
	return workgroupService.BaseTopicOperations.SetPartiesAndBroadcast(txCreator, privKey, workgroupID, publicKeys)
}

func (workgroupService *WorkgroupService) SubmitMessageTx(txCreator *models.TransactionSigner, workgroupID string, messageText []byte, description string, maxFee float64) (*message.Message, error) {
	return workgroupService.BaseTopicOperations.SubmitMessageTx(txCreator, workgroupID, messageText, description, maxFee)
}

func (workgroupService *WorkgroupService) SubmitMessageAndBroadcast(txCreator *models.TransactionSigner, privKey string, workgroupID string, messageText []byte, description string, maxFee float64) error {
	return workgroupService.BaseTopicOperations.SubmitMessageAndBroadcast(txCreator, privKey, workgroupID, messageText, description, maxFee)
}

func (workgroupService *WorkgroupService) SubscribeTo(workgroupID string, start *time.Time, callback func(hedera.TopicMessage)) error {
	return workgroupService.BaseTopicOperations.SubscribeTo(workgroupID, start, callback)
}

// TODO: review after go sdk fix of queryTopicInfo
//func (workgroupService *WorkgroupService) GetAllWorkgroupKeys(workgroupID string) (subscribeKeys string, err error) {
//	memo, allWorkgroupKeys, err := workgroupService.HCSClient.GetTopicInfo(workgroupID)
//	if err != nil {
//		return "", err
//	}
//	fmt.Println(memo)
//	return allWorkgroupKeys, nil
//}

func NewWorkgroup(client *hedera.Client) *WorkgroupService {
	return &WorkgroupService{
		BaseTopicOperations{
			HCSClient: NewHCSClient(client),
		},
	}
}
