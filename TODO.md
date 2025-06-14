# todo list

- support removing routes
- the proxy restart from the last non processed message and to up to the latest message (call <https://testnet.mirrornode.hedera.com/api/v1/topics/0.0.6139083/messages?order=desc&limit=1> and get sequence_number). After that, start polling for new messages.
- create a separate package to check the exchange rate every hour at X and 5 minutes and set the custom fees accordingly to keep the custom fees at one dollars

## Example cURL command to send a raw transaction

```shell
curl -X POST http://localhost:3000/ \
 -H "Content-Type: application/json" \
 -d '{"jsonrpc":"2.0","method":"eth_sendRawTransaction","params":["0x02f874820128820134857dba821800857dba821800826b9c944f1a953df9df8d1c6073ce57f7493e50515fa73f8084d0e30db0c001a0ea5ecef0a498846872303b4d75e9d01de7aef6aa4c490e1e7959bdd22b7928ada032be16b65d017d8bff2fae2b29c5dc5305faeb401ba648ad73d65febd8bfc4df"],"id":1}' \
 --max-time 10
```
