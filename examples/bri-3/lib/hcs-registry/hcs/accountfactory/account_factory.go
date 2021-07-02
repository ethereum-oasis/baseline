package accountfactory

import (
	"bri-3/hcs/accountfactory/haccount"
	"bri-3/hcs/accountfactory/haccount/keyfactory"
	"bri-3/hcs/utils"
	"bri-3/models"

	"github.com/hashgraph/hedera-sdk-go"
)

type AccountFactory struct {
	hederaClient *hedera.Client
	Key          *keyfactory.KeyFactory
}

func (accountFactory *AccountFactory) CreateTx(txCreator *models.TransactionSigner, publicKeys []string, initialBalance float64) (*haccount.HAccount, error) {
	transactionID := hedera.TransactionIDGenerate(*txCreator.Account)
	nodesIDs := accountFactory.hederaClient.GetNetworkNodes()
	thresholdKey, err := utils.AssembleKey(publicKeys, 1)
	if err != nil {
		return &haccount.HAccount{}, err
	}

	transaction, err := hedera.NewAccountCreateTransaction().
		SetKey(thresholdKey).
		SetInitialBalance(hedera.NewHbar(initialBalance)).
		SetTransactionID(transactionID).
		SetNodeAccountIDs(nodesIDs).
		Freeze()

	if err != nil {
		return &haccount.HAccount{}, err
	}

	return haccount.NewHAccount(accountFactory.hederaClient, txCreator, transaction), nil
}

func NewAccountFactory(client *hedera.Client) *AccountFactory {
	return &AccountFactory{
		hederaClient: client,
		Key:          keyfactory.NewKeyFactory(client),
	}
}
