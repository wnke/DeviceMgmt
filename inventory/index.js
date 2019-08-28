const AWS = require('aws-sdk');
const router = require('aws-lambda-router');
const uuidv4 = require('uuid/v4');

const table = process.env.INVENTORY_TABLE;
const topic = process.env.INVENTORY_TOPIC;
const isLocal = process.env.IS_LOCAL;

if (isLocal == "true") {
    console.log("TEST MODE ACTIVE!")
    AWS.config.update({
        region: "us-west-2",
        endpoint: "http://localhost:8000"
    });
};


var dynamo = new AWS.DynamoDB.DocumentClient();
var sns = new AWS.SNS();

async function createDevice(request) {
    const dbParams = {
        TableName: table,
        Item: {
            deviceId: uuidv4(),
            name: request.body.name
        }
    };

    try {
        await dynamo.put(dbParams).promise();
        var statusCode = 201;
        var body = JSON.stringify({ deviceId: dbParams.Item.deviceId });
    } catch (error) {
        var statusCode = 400;
        var body = JSON.stringify({ error: error.stack });
    };

    if (statusCode == 201) {
        const msgParams = {
            Message: JSON.stringify({
                type: "DeviceCreated",
                deviceId: dbParams.Item.deviceId,
                name: dbParams.Item.name
            }),
            TopicArn: topic
        };
        await sns.publish(msgParams).promise();
    };

    var response = {
        "statusCode": statusCode,
        "headers": {},
        "body": body,
        "isBase64Encoded": false
    };
    return response;
}
async function listDevices() {
    var params = {
        TableName: table,
    };

    let scanResults = [];
    let items;
    try {
        do {
            items = await dynamo.scan(params).promise();
            items.Items.forEach((item) => scanResults.push(item));
            params.ExclusiveStartKey = items.LastEvaluatedKey;
        } while (typeof items.LastEvaluatedKey != "undefined");

        var statusCode = 200;
        var body = JSON.stringify({ "inventory":scanResults });
    } catch (error) {
        var statusCode = 400;
        var body = JSON.stringify({ error: error.stack });
    };

    var response = {
        "statusCode": statusCode,
        "headers": {},
        "body": body,
        "isBase64Encoded": false
    };
    return response;
}
async function getDevice(request) {

    const params = {
        TableName: table,
        Key: {
            deviceId: request.paths.id
        }
    };

    try {
        const data = await dynamo.get(params).promise();
        if (data && data.Item) {
            var statusCode = 200;
            var body = JSON.stringify(data.Item);
        } else {
            var statusCode = 404;
            var body = JSON.stringify({ error: "Not Found" });
        }
    } catch (error) {
        var statusCode = 400;
        var body = JSON.stringify({ error: error.stack });
    };

    var response = {
        "statusCode": statusCode,
        "headers": {},
        "body": body,
        "isBase64Encoded": false
    };
    return response;
}
async function deleteDevice(request) {

    const dbParams = {
        TableName: table,
        Key: {
            deviceId: request.paths.id
        },
        ConditionExpression: "#id = :id",
        ExpressionAttributeValues: {
            ":id": request.paths.id
        },
        ExpressionAttributeNames: {
            "#id": "deviceId"
        },
    };
    try {
        const data = await dynamo.delete(dbParams).promise();
        var statusCode = 200;
        var body = JSON.stringify("Deleted");
    } catch (error) {
        var statusCode = 404;
        var body = JSON.stringify({ error: "Not found" });
    };
    if (statusCode == 200) {
        const msgParams = {
            Message: JSON.stringify({
                type: "DeviceDeleted",
                deviceId: request.paths.id,
            }),
            TopicArn: topic
        };
        await sns.publish(msgParams).promise();
    };

    var response = {
        "statusCode": statusCode,
        "headers": {},
        "body": body,
        "isBase64Encoded": false
    };
    return response;
}
async function updateDevice(request) {

    const params = {
        TableName: table,
        Key: {
            deviceId: request.paths.id
        },
        UpdateExpression: "set #n = :n",
        ConditionExpression: "#id = :id",
        ExpressionAttributeValues: {
            ":n": request.body.name,
            ":id": request.paths.id
        },
        ExpressionAttributeNames: {
            "#n": "name",
            "#id": "deviceId"
        },

        ReturnValues: "ALL_NEW"
    };
    try {
        const data = await dynamo.update(params).promise();
        console.log(data);
        var statusCode = 200;
        var body = JSON.stringify({
            "deviceId":request.paths.id,
            "name": request.body.name
        });

    } catch (error) {
        var statusCode = 404; //?
        var body = JSON.stringify({ error: "Not found" });
    };

    var response = {
        "statusCode": statusCode,
        "headers": {},
        "body": body,
        "isBase64Encoded": false
    };
    return response;
}

// handler for an api gateway event
exports.handler = router.handler({
    // for handling an http-call from an AWS API Gateway proxyIntegration
    proxyIntegration: {
        routes: [
            {
                path: '/inventory',
                method: 'POST',
                action: (request, context) => { return createDevice(request); }
            },
            {
                path: '/inventory',
                method: 'GET',
                action: (request, context) => { return listDevices(); }
            },
            {
                path: '/inventory/:id',
                method: 'GET',
                action: (request, context) => { return getDevice(request); }
            },
            {
                path: '/inventory/:id',
                method: 'DELETE',
                action: (request, context) => { return deleteDevice(request); }
            },
            {
                path: '/inventory/:id',
                method: 'PUT',
                action: (request, context) => { return updateDevice(request); }
            },
        ]
    }
})
