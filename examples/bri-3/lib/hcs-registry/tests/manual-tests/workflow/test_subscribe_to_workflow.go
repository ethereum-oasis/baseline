package manualtest

import (
	"bri-3/hcs"
	"bri-3/models"
	"fmt"
	"time"

	"github.com/hashgraph/hedera-sdk-go"
)

func main() {
	hederaClient := hedera.ClientForTestnet()
	prKey, err := hedera.PrivateKeyFromString("302e020100300506032b657004220420c49c87524b1944a142b58d511f7b094ba7d9d2e1cdd1a9d2c6f3fdcca74ae736")
	hederaClient.SetEmptyOperator()

	proof := []byte{0x05, 0x02, 0x03}

	workflowID := "0.0.269850"
	workflow := hcs.NewWorkflow(hederaClient)

	// Start listening for workflow new proofs
	err = workflow.SubscribeTo(workflowID, nil, func(msg hedera.TopicMessage) {
		fmt.Printf("\n%x", msg.Contents)
	})
	if err != nil {
		panic(err)
	}

	// Submit a new proof
	signer, err := models.NewTransactionSigner("0.0.4266", "302a300506032b6570032100424d2b3f9ec5d189bf24515ced88cdef28725b2fa32eb31023c551c56eb76f2f")
	err = workflow.SubmitMessageAndBroadcast(
		signer,
		prKey.String(),
		workflowID,
		proof,
		"Test proof",
		1,
	)

	if err != nil {
		panic(err)
	}

	// Wait for receiving the new proof
	time.Sleep(10 * time.Second)
}
