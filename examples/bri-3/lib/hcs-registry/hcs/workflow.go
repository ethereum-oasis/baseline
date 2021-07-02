package hcs

import (
	"fmt"
	"time"

	"github.com/hashgraph/hedera-sdk-go"

	"bri-3/hcs/topicfactory/topic/messagefactory/message"
	"bri-3/hcs/topicfactory/topic/submitkeysfactory/submitkeys"
	"bri-3/models"
)

type WorkflowService struct {
	BaseTopicOperations
}

// Todo: Add explanation
func (workflowService *WorkflowService) NotifyCreationTx(txCreator *models.TransactionSigner, workgroupID string, maxFee float64) (*message.Message, error) {
	messageText := fmt.Sprintf("workflow with id %v has been created", workgroupID)
	return workflowService.BaseTopicOperations.HCSClient.Topic.Message.SubmitTx(txCreator, workgroupID, []byte(messageText), "", maxFee)
}

func (workflowService *WorkflowService) CreateAndBroadcast(txCreator *models.TransactionSigner, privKey string, submittersKeys []string, workgroupID string, description string, maxFee float64) (string, error) {
	// TODO: use GetAllWorkflowKeys and compare allWorkflowKeys with submittersKeys
	//memo, allWorkflowKeys, err := workflowService.HCSClient.GetTopicInfo(workgroupID)
	//if err != nil {
	//	return "", err
	//}

	topicTx, err := workflowService.BaseTopicOperations.CreateTx(txCreator, submittersKeys, description, maxFee)
	if err != nil {
		return "", err
	}

	err = topicTx.SignImplicitly(privKey)
	if err != nil {
		return "", err
	}

	workflowID, err := topicTx.Broadcast()
	if err != nil {
		return "", err
	}

	messageTx, err := workflowService.NotifyCreationTx(txCreator, workgroupID, maxFee)
	if err != nil {
		return "", err
	}

	err = messageTx.SignImplicitly(privKey)
	if err != nil {
		return "", err
	}

	err = messageTx.Broadcast()
	if err != nil {
		return "", err
	}

	return workflowID, nil
}

func (workflowService *WorkflowService) SetPartiesTx(txCreator *models.TransactionSigner, workflowID string, publicKeys []string) (*submitkeys.SubmitKeys, error) {
	return workflowService.BaseTopicOperations.SetPartiesTx(txCreator, workflowID, publicKeys)
}

func (workflowService *WorkflowService) SetPartiesAndBroadcast(txCreator *models.TransactionSigner, privKey string, workflowID string, publicKeys []string) error {
	return workflowService.BaseTopicOperations.SetPartiesAndBroadcast(txCreator, privKey, workflowID, publicKeys)
}

func (workflowService *WorkflowService) SubmitMessageTx(txCreator *models.TransactionSigner, workflowID string, proof []byte, description string, maxFee float64) (*message.Message, error) {
	return workflowService.BaseTopicOperations.SubmitMessageTx(txCreator, workflowID, proof, description, maxFee)
}

func (workflowService *WorkflowService) SubmitMessageAndBroadcast(txCreator *models.TransactionSigner, privKey string, workflowID string, messageText []byte, description string, maxFee float64) error {
	return workflowService.BaseTopicOperations.SubmitMessageAndBroadcast(txCreator, privKey, workflowID, messageText, description, maxFee)
}

func (workflowService *WorkflowService) SubscribeTo(workflowID string, start *time.Time, callback func(hedera.TopicMessage)) error {
	return workflowService.BaseTopicOperations.SubscribeTo(workflowID, start, callback)
}

// TODO: review after go sdk fix of queryTopicInfo
//func (workflowService *WorkflowService) GetAllWorkflowKeys(workflowID string) (subscribeKeys string, err error) {
//	memo, allWorkflowKeys, err := workflowService.HCSClient.GetTopicInfo(workflowID)
//	if err != nil {
//		return "", err
//	}
//	fmt.Println(memo)
//	return allWorkflowKeys, nil
//}

func NewWorkflow(client *hedera.Client) *WorkflowService {
	return &WorkflowService{
		BaseTopicOperations{
			HCSClient: NewHCSClient(client),
		},
	}
}
