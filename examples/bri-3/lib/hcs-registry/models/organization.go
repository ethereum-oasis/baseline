package models

// Organization model
type Organization struct {
	Name     string                 `json:"name"`
	Metadata map[string]interface{} `json:"metadata"`
}
