package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/dynamodb"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
)

type device struct {
	DeviceID string `json:"deviceId"`
}

type inventoryEvent struct {
	Type string `json:"type"`
	device
}

var table = os.Getenv("CONFIGURATION_TABLE")
var db = dynamodb.New(session.New(), aws.NewConfig())

func handler(ctx context.Context, sqsEvent events.SQSEvent) error {
	for _, message := range sqsEvent.Records {

		var notification events.SNSEntity
		err := json.Unmarshal([]byte(message.Body), &notification)
		if err != nil {
			fmt.Printf("Failed to parse notification (skipping) %s : %s \n", message.Body, err)
			continue
		}

		var event inventoryEvent
		err = json.Unmarshal([]byte(notification.Message), &event)
		if err != nil {
			fmt.Printf("Failed to parse message (skipping) %s : %s \n", message.Body, err)
			continue
		}

		fmt.Printf("Inventory event %s for device %s\n", event.Type, event.DeviceID)

		if event.Type == "DeviceCreated" {
			input := &dynamodb.PutItemInput{
				TableName: aws.String(table),
				Item: map[string]*dynamodb.AttributeValue{
					"deviceId": {S: aws.String(event.DeviceID)},
				},
			}
			_, err = db.PutItem(input)
			if err != nil {
				fmt.Printf("Failed to store device %s : %s \n", event.DeviceID, err)
			}
		} else if event.Type == "DeviceDeleted" {
			input := &dynamodb.DeleteItemInput{
				TableName: aws.String(table),
				Key: map[string]*dynamodb.AttributeValue{
					"deviceId": {S: aws.String(event.DeviceID)},
				},
			}
			_, err = db.DeleteItem(input)
			if err != nil {
				fmt.Printf("Failed to delete device %s :%s \n", event.DeviceID, err)
			}

		}
	}

	return nil
}

func main() {
	lambda.Start(handler)
}
