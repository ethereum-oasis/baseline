package test

import (
	"bri-3/hcs"
	"bri-3/models"
	"encoding/json"
	"time"

	"os"
	"testing"

	"github.com/hashgraph/hedera-sdk-go"
	"github.com/stretchr/testify/assert"
)

/*
	You have to have the following before running the tests
	1. Running Vault Service
	2. Unsealed Key
	3. Created private/public Ed25519 keys pair
		Run test_vault_crate.go to generate for you all of the needed valued
	4. Change the following as per your Vault Service
		* vaultID
		* vaultKeyID
		* vaultPubKey
		* Authentication token

*/

var (
	mainSigner  *models.TransactionSigner
	vaultSigner *models.TransactionSigner

	hederaClient   = hedera.ClientForTestnet()
	mainAccount    = "0.0.4266"
	mainPublicKey  = "302a300506032b6570032100424d2b3f9ec5d189bf24515ced88cdef28725b2fa32eb31023c551c56eb76f2f"
	mainPrivateKey = "302e020100300506032b657004220420c49c87524b1944a142b58d511f7b094ba7d9d2e1cdd1a9d2c6f3fdcca74ae736"

	vaultID    = "9e1ddf0b-b97c-4ead-a1c2-1f3115b6044d"
	vaultKeyID = "3126587b-69ca-4fa1-90fe-3c5bba464ea2"
	token      = "eyJhbGciOiJSUzI1NiIsImtpZCI6IjEwOjJlOmQ5OmUxOmI4OmEyOjM0OjM3Ojk5OjNhOjI0OmZjOmFhOmQxOmM4OjU5IiwidHlwIjoiSldUIn0.eyJhdWQiOiJodHRwczovL3Byb3ZpZGUuc2VydmljZXMvYXBpL3YxIiwiZXhwIjoxNjExNjU5MDAzLCJpYXQiOjE2MTE1NzI2MDMsImlzcyI6Imh0dHBzOi8vaWRlbnQucHJvdmlkZS5zZXJ2aWNlcyIsImp0aSI6Ijg4NGMzYTY5LTc3ZTEtNDIxMC1hNGQ2LWYyNjk1ZGQxNzIzYyIsIm5hdHMiOnsicGVybWlzc2lvbnMiOnsicHVibGlzaCI6eyJhbGxvdyI6WyJiYXNlbGluZS5cdTAwM2UiXX0sInN1YnNjcmliZSI6eyJhbGxvdyI6WyJ1c2VyLmNjNWE2ZTk1LTNhZGMtNGVmZC1iZTFlLTA4ZjdhY2Y0N2E1NiIsIm5ldHdvcmsuKi5jb25uZWN0b3IuKiIsIm5ldHdvcmsuKi5zdGF0dXMiLCJwbGF0Zm9ybS5cdTAwM2UiLCJiYXNlbGluZS5cdTAwM2UiXX19fSwicHJ2ZCI6eyJwZXJtaXNzaW9ucyI6NDE1LCJ1c2VyX2lkIjoiY2M1YTZlOTUtM2FkYy00ZWZkLWJlMWUtMDhmN2FjZjQ3YTU2In0sInN1YiI6InVzZXI6Y2M1YTZlOTUtM2FkYy00ZWZkLWJlMWUtMDhmN2FjZjQ3YTU2In0.EpmcRF4gMA97BqE5vjRnDqooS2dza6JuAN--5pvGMly3NdSwZbrB0Jk4RWSLnJTfkTqPJv9_oyLk-tQ_0cCyToIKTvfMXUSi-YCJKFXHPI0rsLwBUPEONUryzG2ExwzvsHb12OKt7zI8NDp04YEY2uBeTIagEygj0Jp4QWo-QJH70DYCVQ1QUWfdhngY_LUil6Gg96vuX7ALrsb2yxEN9nnEsV5ECmtiBKGFUPETtCuTw-f36oLDCTLHMSh62tskoCIqzcX4SLLuYCcE8948ZN75caVLd_9B5fbhhRsWFR4hAYMMD88UdN1moxNnmWHypAgUY6ZdcAbYR3NX2Q2TCmwgC71yw0i8GJ75C4EVMJhdeDt5qrfXlouNh8SYnpw_QvBfqfBAUc2sN75WVO61BVbmAexvlQbimpQR-drGYX4X1e5KIS-cbgggLGL1GW7ncPaYdU6OEcKjwAr5Mo5bcj_asVdxaHdY1t55KLots82_8ozEeVazbJpEEY1yFye6cIe6rkBgvpg8wWzkXNN1gL6Gw3g59JhVV-QMBo0osxbnmf0OGWB_zDf3f5OPkin9UNcDKnw7r7AyNSDcV0YByQWbtJ3ikXLHUIdT1s0lvlc3IDF5MvFpFh4YdRwJ5-nSOsINMatK8gymmIRRC6ix--W1cO-hbtlj38CtB-nbb5M"

	vaultAccount string
	vaultPubKey  = "5ff11bf216ad5f4898d1875c6c13f06d3f221d53342b13781a92c1e0c28d7251"

	registryID      string
	registryVaultID string

	workgroupID      string
	workgroupVaultID string

	workflowID      string
	workflowVaultID string
)

// Configs
func setUp() {
	os.Setenv("VAULT_API_HOST", "localhost:8082")
	os.Setenv("VAULT_API_SCHEME", "http")
	hederaClient.SetEmptyOperator()

	mainSigner, _ = models.NewTransactionSigner(mainAccount, mainPublicKey)
}

// Account
func TestCreateAccount(t *testing.T) {
	setUp()

	account := hcs.NewAccount(hederaClient)
	vaultAccount, err := account.CreateAndBroadcast(
		mainSigner,
		mainPrivateKey,
		[]string{
			vaultPubKey,
		},
		20,
	)

	if err != nil {
		t.Error(err)
	}

	assert.Contains(t, vaultAccount, "0.0")

	vaultSigner, err = models.NewTransactionSigner(vaultAccount, vaultPubKey)
	if err != nil {
		t.Error(err)
	}
}

func TestCreateAccountVault(t *testing.T) {
	setUp()

	account := hcs.NewAccount(hederaClient)
	accountTx, err := account.CreateTx(
		vaultSigner,
		[]string{
			vaultPubKey,
		},
		1,
	)
	if err != nil {
		t.Error(err)
	}

	err = accountTx.VaultSign(token, vaultID, vaultKeyID)
	if err != nil {
		t.Error(err)
	}

	accountID, err := accountTx.Broadcast()
	if err != nil {
		t.Error(err)
	}

	assert.Contains(t, accountID, "0.0")
}

func TestSetAccountKey(t *testing.T) {
	setUp()

	account := hcs.NewAccount(hederaClient)
	err := account.SetKeyAndBroadcast(
		mainSigner,
		mainPrivateKey,
		[]string{
			mainPublicKey,
		},
		1,
	)

	if err != nil {
		t.Error(err)
	}
}

func TestSetAccountKeyVault(t *testing.T) {
	setUp()

	account := hcs.NewAccount(hederaClient)
	keyTx, err := account.SetKeyTx(
		vaultSigner,
		[]string{
			vaultPubKey,
		},
		1,
	)

	if err != nil {
		t.Error(err)
	}

	err = keyTx.VaultSign(token, vaultID, vaultKeyID)
	if err != nil {
		t.Error(err)
	}

	err = keyTx.Broadcast()
	if err != nil {
		t.Error(err)
	}
}

// Registry
func TestCreateRegistry(t *testing.T) {
	setUp()

	registry := hcs.NewRegistry(hederaClient)
	registry_ID, err := registry.CreateAndBroadcast(
		mainSigner,
		mainPrivateKey,
		[]string{
			mainPublicKey,
		},
		"Testing Registry",
		1,
	)

	if err != nil {
		t.Error(err)
	}

	registryID = registry_ID
	assert.Contains(t, registryID, "0.0")
}

func TestCreateRegistryVault(t *testing.T) {
	setUp()

	registry := hcs.NewRegistry(hederaClient)
	registryTx, err := registry.CreateTx(
		vaultSigner,
		[]string{
			vaultPubKey,
		},
		"Testing Registry",
		1,
	)

	if err != nil {
		t.Error(err)
	}

	err = registryTx.VaultSign(token, vaultID, vaultKeyID)
	if err != nil {
		t.Error(err)
	}

	registry_ID, err := registryTx.Broadcast()
	if err != nil {
		t.Error(err)
	}

	registryVaultID = registry_ID
	assert.Contains(t, registryVaultID, "0.0")
}

func TestRegisterToRegistry(t *testing.T) {
	setUp()
	organization := models.Organization{Name: "Test", Metadata: map[string]interface{}{"test": "test"}}

	registry := hcs.NewRegistry(hederaClient)
	err := registry.RegisterAndBroadcast(
		mainSigner,
		mainPrivateKey,
		registryID,
		&organization,
		1,
	)

	if err != nil {
		t.Error(err)
	}
}

func TestRegisterToRegistryVault(t *testing.T) {
	setUp()
	organization := models.Organization{Name: "Test", Metadata: map[string]interface{}{"test": "test"}}

	registry := hcs.NewRegistry(hederaClient)
	registerTx, err := registry.RegisterTx(
		vaultSigner,
		registryVaultID,
		&organization,
		1,
	)

	if err != nil {
		t.Error(err)
	}

	err = registerTx.VaultSign(token, vaultID, vaultKeyID)
	if err != nil {
		t.Error(err)
	}

	err = registerTx.Broadcast()
	if err != nil {
		t.Error(err)
	}
}

func TestSetRegistryParties(t *testing.T) {
	setUp()

	registry := hcs.NewRegistry(hederaClient)
	err := registry.SetPartiesAndBroadcast(
		mainSigner,
		mainPrivateKey,
		registryID,
		[]string{
			mainPublicKey,
		},
	)

	if err != nil {
		t.Error(err)
	}
}

func TestSetRegistryPartiesVault(t *testing.T) {
	setUp()

	registry := hcs.NewRegistry(hederaClient)
	registryPartiesTx, err := registry.SetPartiesTx(
		vaultSigner,
		registryVaultID,
		[]string{
			vaultPubKey,
		},
	)

	if err != nil {
		t.Error(err)
	}

	err = registryPartiesTx.VaultSign(token, vaultID, vaultKeyID)
	if err != nil {
		t.Error(err)
	}

	err = registryPartiesTx.Broadcast()
	if err != nil {
		t.Error(err)
	}
}

func TestSubscribeToRegistry(t *testing.T) {
	setUp()
	organization := models.Organization{Name: "Test", Metadata: map[string]interface{}{"test": "test"}}

	registry := hcs.NewRegistry(hederaClient)

	// Start listening for new organizations
	err := registry.SubscribeTo(registryID, nil, func(msg hedera.TopicMessage) {
		newOrganization := &models.Organization{}

		err := json.Unmarshal(msg.Contents, newOrganization)
		if err != nil {
			t.Error(err)
		}

		assert.Equal(t, newOrganization.Name, organization.Name)
	})

	if err != nil {
		t.Error(err)
	}

	// Register the new organization
	err = registry.RegisterAndBroadcast(
		mainSigner,
		mainPrivateKey,
		registryID,
		&organization,
		1,
	)

	if err != nil {
		t.Error(err)
	}

	// Wait for receiving the new organization
	time.Sleep(10 * time.Second)
}

// Workgroup
func TestCreateWorkgroup(t *testing.T) {
	setUp()

	workgroup := hcs.NewWorkgroup(hederaClient)
	workgroup_ID, err := workgroup.CreateAndBroadcast(
		mainSigner,
		mainPrivateKey,
		[]string{
			mainPublicKey,
		},
		"Testing Workgroup",
		1,
	)

	if err != nil {
		t.Error(err)
	}

	workgroupID = workgroup_ID
	assert.Contains(t, workgroupID, "0.0")
}

func TestCreateWorkgroupVault(t *testing.T) {
	setUp()

	workgroup := hcs.NewWorkgroup(hederaClient)
	workgroupTx, err := workgroup.CreateTx(
		vaultSigner,
		[]string{
			vaultPubKey,
		},
		"Testing Workgroup",
		1,
	)

	if err != nil {
		t.Error(err)
	}

	err = workgroupTx.VaultSign(token, vaultID, vaultKeyID)
	if err != nil {
		t.Error(err)
	}

	workgroup_ID, err := workgroupTx.Broadcast()
	if err != nil {
		t.Error(err)
	}

	workgroupVaultID = workgroup_ID
	assert.Contains(t, workgroupVaultID, "0.0")
}

func TestSetWorkgroupParties(t *testing.T) {
	setUp()

	workgroup := hcs.NewWorkgroup(hederaClient)
	err := workgroup.SetPartiesAndBroadcast(
		mainSigner,
		mainPrivateKey,
		workgroupID,
		[]string{
			mainPublicKey,
		},
	)

	if err != nil {
		t.Error(err)
	}
}

func TestSetWorkgroupPartiesVault(t *testing.T) {
	setUp()

	workgroup := hcs.NewWorkgroup(hederaClient)
	workgroupPartiesTx, err := workgroup.SetPartiesTx(
		vaultSigner,
		workgroupVaultID,
		[]string{
			vaultPubKey,
		},
	)

	if err != nil {
		t.Error(err)
	}

	err = workgroupPartiesTx.VaultSign(token, vaultID, vaultKeyID)
	if err != nil {
		t.Error(err)
	}

	err = workgroupPartiesTx.Broadcast()
	if err != nil {
		t.Error(err)
	}
}

func TestSubmitWorkgroupMessage(t *testing.T) {
	setUp()
	message := []byte{0x01, 0x02, 0x03}

	workgroup := hcs.NewWorkgroup(hederaClient)
	err := workgroup.SubmitMessageAndBroadcast(
		mainSigner,
		mainPrivateKey,
		workgroupID,
		message,
		"Test message",
		1,
	)

	if err != nil {
		t.Error(err)
	}
}

func TestSubmitWorkgroupMessageVault(t *testing.T) {
	setUp()
	message := []byte{0x01, 0x02, 0x03}

	workgroup := hcs.NewWorkgroup(hederaClient)
	workgroupMessageTx, err := workgroup.SubmitMessageTx(
		vaultSigner,
		workgroupVaultID,
		message,
		"Test message",
		1,
	)

	if err != nil {
		t.Error(err)
	}

	err = workgroupMessageTx.VaultSign(token, vaultID, vaultKeyID)
	if err != nil {
		t.Error(err)
	}

	err = workgroupMessageTx.Broadcast()
	if err != nil {
		t.Error(err)
	}
}

func TestSubscribeToWorkgroup(t *testing.T) {
	setUp()

	message := []byte{0x02, 0x02, 0x03}
	workgroup := hcs.NewWorkgroup(hederaClient)
	workgroup_ID, _ := workgroup.CreateAndBroadcast(mainSigner, mainPrivateKey, []string{mainPublicKey}, "Testing Workgroup", 1)

	err := workgroup.SubscribeTo(workgroup_ID, nil, func(msg hedera.TopicMessage) {
		assert.Equal(t, msg.Contents, message)
	})
	if err != nil {
		t.Error(err)
	}

	// Submit a message to a workgroup
	err = workgroup.SubmitMessageAndBroadcast(mainSigner, mainPrivateKey, workgroup_ID, message, "Test message", 1)
	if err != nil {
		t.Error(err)
	}

	// Wait for receiving new workgroup messages
	time.Sleep(10 * time.Second)
}

// Workflow
func TestCreateWorkflow(t *testing.T) {
	setUp()

	workflow := hcs.NewWorkflow(hederaClient)
	workflow_ID, err := workflow.CreateAndBroadcast(
		mainSigner,
		mainPrivateKey,
		[]string{
			mainPublicKey,
		},
		workgroupID,
		"Testing Workflow",
		1,
	)

	if err != nil {
		t.Error(err)
	}

	workflowID = workflow_ID
	assert.Contains(t, workflowID, "0.0")
}

func TestCreateWorkflowVault(t *testing.T) {
	setUp()

	workflow := hcs.NewWorkflow(hederaClient)
	workflowTx, err := workflow.CreateTx(
		vaultSigner,
		[]string{
			vaultPubKey,
		},
		"Testing Workflow",
		1,
	)

	if err != nil {
		t.Error(err)
	}

	err = workflowTx.VaultSign(token, vaultID, vaultKeyID)
	if err != nil {
		t.Error(err)
	}

	workflow_ID, err := workflowTx.Broadcast()
	if err != nil {
		t.Error(err)
	}

	workflowVaultID = workflow_ID
	assert.Contains(t, workflowVaultID, "0.0")

	// Notify the workgroup that a workflow has been related to it
	workflowNotificationTx, err := workflow.NotifyCreationTx(
		vaultSigner,
		workgroupVaultID,
		1,
	)
	if err != nil {
		t.Error(err)
	}

	err = workflowNotificationTx.VaultSign(token, vaultID, vaultKeyID)
	if err != nil {
		t.Error(err)
	}

	err = workflowNotificationTx.Broadcast()
	if err != nil {
		t.Error(err)
	}
}

func TestSetWorkflowParties(t *testing.T) {
	setUp()

	workflow := hcs.NewWorkflow(hederaClient)
	err := workflow.SetPartiesAndBroadcast(
		mainSigner,
		mainPrivateKey,
		workflowID,
		[]string{
			mainPublicKey,
		},
	)

	if err != nil {
		t.Error(err)
	}
}

func TestSetWorkflowPartiesVault(t *testing.T) {
	setUp()

	workflow := hcs.NewWorkflow(hederaClient)
	workflowPartiesTx, err := workflow.SetPartiesTx(
		vaultSigner,
		workflowVaultID,
		[]string{
			vaultPubKey,
		},
	)

	if err != nil {
		t.Error(err)
	}

	err = workflowPartiesTx.VaultSign(token, vaultID, vaultKeyID)
	if err != nil {
		t.Error(err)
	}

	err = workflowPartiesTx.Broadcast()
	if err != nil {
		t.Error(err)
	}
}

func TestSubmitWorkflowProof(t *testing.T) {
	setUp()
	proof := []byte{0x01, 0x02, 0x03}
	workflow := hcs.NewWorkflow(hederaClient)

	err := workflow.SubmitMessageAndBroadcast(
		mainSigner,
		mainPrivateKey,
		workflowID,
		proof,
		"Test proof",
		1,
	)

	if err != nil {
		t.Error(err)
	}
}

func TestSubmitWorkflowProofVault(t *testing.T) {
	setUp()
	proof := []byte{0x01, 0x02, 0x03}

	workflow := hcs.NewWorkflow(hederaClient)
	workflowProofTx, err := workflow.SubmitMessageTx(
		vaultSigner,
		workflowVaultID,
		proof,
		"Test proof",
		1,
	)

	if err != nil {
		t.Error(err)
	}

	err = workflowProofTx.VaultSign(token, vaultID, vaultKeyID)
	if err != nil {
		t.Error(err)
	}

	err = workflowProofTx.Broadcast()
	if err != nil {
		t.Error(err)
	}
}

func TestSubscribeToWorkflow(t *testing.T) {
	setUp()
	proof := []byte{0x05, 0x02, 0x03}
	workflow := hcs.NewWorkflow(hederaClient)
	workflow_ID, _ := workflow.CreateAndBroadcast(mainSigner, mainPrivateKey, []string{mainPublicKey}, workgroupID, "Testing Workflow", 1)

	// Start listening for workflow new proofs
	err := workflow.SubscribeTo(workflow_ID, nil, func(msg hedera.TopicMessage) {
		assert.Equal(t, msg.Contents, proof)
	})

	if err != nil {
		t.Error(err)
	}

	// Submit a new proof
	err = workflow.SubmitMessageAndBroadcast(
		mainSigner,
		mainPrivateKey,
		workflowID,
		proof,
		"Test proof",
		1,
	)

	if err != nil {
		t.Error(err)
	}

	// Wait for receiving the new proof
	time.Sleep(10 * time.Second)
}
