package hcs

import (
	"bri-3/hcs/accountfactory/haccount"
	"bri-3/hcs/accountfactory/haccount/keyfactory/accountkey"
	"bri-3/models"

	"github.com/hashgraph/hedera-sdk-go"
)

type Account struct {
	HCSClient *HCSClient
}

func (account *Account) CreateTx(txCreator *models.TransactionSigner, publicKeys []string, initialBalance float64) (*haccount.HAccount, error) {
	return account.HCSClient.Account.CreateTx(txCreator, publicKeys, initialBalance)
}

func (account *Account) CreateAndBroadcast(txCreator *models.TransactionSigner, privKey string, publicKeys []string, initialBalance float64) (string, error) {
	accountTx, err := account.CreateTx(txCreator, publicKeys, initialBalance)
	if err != nil {
		return "", err
	}

	err = accountTx.SignImplicitly(privKey)
	if err != nil {
		return "", err
	}

	return accountTx.Broadcast()
}

func (account *Account) SetKeyTx(txCreator *models.TransactionSigner, publicKeys []string, threshold uint) (accountkey.AccountKey, error) {
	return account.HCSClient.Account.Key.SetTx(txCreator, publicKeys, threshold)
}

func (account *Account) SetKeyAndBroadcast(txCreator *models.TransactionSigner, privKey string, publicKeys []string, threshold uint) error {
	accountKeyTx, err := account.SetKeyTx(txCreator, publicKeys, threshold)
	if err != nil {
		return err
	}

	err = accountKeyTx.SignImplicitly(privKey)
	if err != nil {
		return err
	}

	return accountKeyTx.Broadcast()
}

func NewAccount(client *hedera.Client) *Account {
	return &Account{
		HCSClient: NewHCSClient(client),
	}
}
