package keyfactory

import (
	"bri-3/hcs/accountfactory/haccount/keyfactory/accountkey"
	"bri-3/hcs/utils"
	"bri-3/models"

	"github.com/hashgraph/hedera-sdk-go"
)

type KeyFactory struct {
	hederaClient *hedera.Client
}

func (keyFactory *KeyFactory) SetTx(txCreator *models.TransactionSigner, publicKeys []string, threshold uint) (accountkey.AccountKey, error) {
	transactionID := hedera.TransactionIDGenerate(*txCreator.Account)
	nodesIDs := keyFactory.hederaClient.GetNetworkNodes()
	thresholdKey, err := utils.AssembleKey(publicKeys, threshold)
	if err != nil {
		return accountkey.AccountKey{}, err
	}

	transaction, err := hedera.NewAccountUpdateTransaction().
		SetAccountID(*txCreator.Account).
		SetKey(thresholdKey).
		SetTransactionID(transactionID).
		SetNodeAccountIDs(nodesIDs).
		Freeze()

	if err != nil {
		return accountkey.AccountKey{}, err
	}

	return *accountkey.NewAccountKey(keyFactory.hederaClient, txCreator, transaction), nil
}

func NewKeyFactory(client *hedera.Client) *KeyFactory {
	return &KeyFactory{
		hederaClient: client,
	}
}
