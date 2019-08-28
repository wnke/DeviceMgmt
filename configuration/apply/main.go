package main

import (
	"context"
	"errors"
	"fmt"
	"os"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/dynamodb"
	"github.com/aws/aws-sdk-go/service/dynamodb/dynamodbattribute"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
)

type device struct {
	DeviceID string `json:"deviceId"`
}

var table = os.Getenv("CONFIGURATION_TABLE")
var db = dynamodb.New(session.New(), aws.NewConfig())

func handler(ctx context.Context, cloudWatchEvent events.CloudWatchEvent) error {

	params := &dynamodb.ScanInput{
		TableName: aws.String(table),
	}
	var devices []device
	for {

		result, err := db.Scan(params)
		if err != nil {
			desc := fmt.Sprintf("Failed to scan table : %s \n", err)
			fmt.Printf(desc + "\n")
			return errors.New(desc)
		}

		var items []device
		err = dynamodbattribute.UnmarshalListOfMaps(result.Items, &items)
		if err != nil {
			desc := fmt.Sprintf("Failed to unmarshal table: %s", err)
			fmt.Printf(desc + "\n")
			return errors.New(desc)
		}

		devices = append(devices, items...)

		if result.LastEvaluatedKey == nil {
			break
		} else {
			params.ExclusiveStartKey = result.LastEvaluatedKey
		}
	}

	for _, device := range devices {
		fmt.Printf("Configuring device %s\n", device.DeviceID)
	}

	return nil
}

func main() {
	lambda.Start(handler)
}
