package common

import (
	"encoding/hex"
	"fmt"

	"bri-3/models"

	"github.com/hashgraph/hedera-sdk-go"
	provide "github.com/provideservices/provide-go/api/vault"
)

type HTransaction interface {
	BodyBytes() []byte
	AddSignature(hedera.PublicKey, []byte) *hedera.Transaction
}

type RawTransaction struct {
	signer      *models.TransactionSigner
	transaction interface{}
}

func (rawTransaction *RawTransaction) VaultSign(token string, vaultId string, keyId string) error {
	executableTx := rawTransaction.transaction.(HTransaction)

	messageToSign := hex.EncodeToString(executableTx.BodyBytes())
	sigHexStr, err := provide.SignMessage(token, vaultId, keyId, messageToSign, nil)
	if err != nil {
		return fmt.Errorf("failed to sign message %s", err.Error())
	}

	sigHex := []byte(*sigHexStr.Signature)
	signature := make([]byte, hex.DecodedLen(len(sigHex)))
	hex.Decode(signature, sigHex)

	executableTx.AddSignature(*rawTransaction.signer.PublicKey, signature)
	return nil
}

func (rawTransaction *RawTransaction) SignImplicitly(privKey string) error {
	prKey, err := hedera.PrivateKeyFromString(privKey)
	if err != nil {
		return err
	}

	executableTx := rawTransaction.transaction.(HTransaction)
	signature := prKey.Sign(executableTx.BodyBytes())
	executableTx.AddSignature(prKey.PublicKey(), signature)

	return nil
}

func NewRawTransaction(txSigner *models.TransactionSigner, tx interface{}) *RawTransaction {
	return &RawTransaction{
		signer:      txSigner,
		transaction: tx,
	}
}
