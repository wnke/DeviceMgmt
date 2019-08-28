
const SLEEP_TIME_MS =  Number(process.env.SLEEP_TIME_MS) || 10000;

function sleep(millis) {
    return new Promise(resolve => setTimeout(resolve, millis));
}

exports.handler = async function(event, context) {

  for (const record of event.Records) {
    

    const body = JSON.parse(record.body);
    const message =  JSON.parse(body.Message);

    if (message.type == "DeviceCreated"){
	    console.log(`Starting ${message.type} notification of SAP service of device ${message.deviceId} named ${message.name}`);
	    await sleep(SLEEP_TIME_MS);
	    console.log(`Done ${message.type} notification of SAP service of device ${message.deviceId} named ${message.name}`);
  	};
  };

  return {};
}