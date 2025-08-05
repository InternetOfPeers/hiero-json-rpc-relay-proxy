# todo list

- support removing routes
- the proxy restart from the last non processed message and to up to the latest message (call <https://testnet.mirrornode.hedera.com/api/v1/topics/0.0.6139083/messages?order=desc&limit=1> and get sequence_number). After that, start polling for new messages.
- create a separate package to check the exchange rate every hour at X and 5 minutes and set the custom fees accordingly to keep the custom fees at one dollars

## Example cURL command to send a raw transaction

```shell
curl -X POST http://localhost:3000/ \
 -H "Content-Type: application/json" \
 -d '{"jsonrpc":"2.0","method":"eth_sendRawTransaction","params":["0x02f874820128820134857dba821800857dba821800826b9c944f1a953df9df8d1c6073ce57f7493e50515fa73f8084d0e30db0c001a0ea5ecef0a498846872303b4d75e9d01de7aef6aa4c490e1e7959bdd22b7928ada032be16b65d017d8bff2fae2b29c5dc5305faeb401ba648ad73d65febd8bfc4df"],"id":444}' \
 --max-time 10
```

```shell
curl -X POST http://localhost:3000/ \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_sendRawTransaction","params":["0x02f87c82012882013a8579126a50008579126a5000827583948dd8d76acce4e98023bcd201931f61d3c7be948b883782dace9d90000084d0e30db0c080a0d9388ce73ad8d3815fc7334c010ad3cb19f9bed576a692e04a58fc34ed9ccbcfa0768339b03f06d498e0e472129f4fde615af8b56376f795b9e7e43e6da16cf0b7"],"id":333}'
```

```shell
curl -X POST https://testnet.hashio.io/api \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_call","params":[{"data":"0xae54e32b","to":"0x2ce9791ce19683b641d2b52d16bb0ebfc0765c44"}, "latest"],"id":555}'
```
