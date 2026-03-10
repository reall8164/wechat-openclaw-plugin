# Protocol Notes

This document describes the socket envelope used by the relay.

## Connection

- Transport: WebSocket text frames
- Address shape: `ws://host:port/?token={token}`
- Expected routing identifiers: `guid`, `user_id`
- Idle behavior: the client sends heartbeat pings and reconnects on close

## Envelope

All messages use the same outer shape:

```json
{
  "msg_id": "string",
  "guid": "string",
  "user_id": "string",
  "method": "string",
  "payload": {}
}
```

## Downstream Methods

- `session.prompt`
- `session.cancel`

## Upstream Methods

- `session.update`
- `session.promptResponse`

## `session.update`

`payload.update_type` determines which fields are present:

- `message_chunk`: uses `content`
- `tool_call`: uses `tool_call`
- `tool_call_update`: uses `tool_call`

## `session.promptResponse`

Terminal responses use:

- `stop_reason: "end_turn"` for successful completion
- `stop_reason: "cancelled"` for cancellation
- `stop_reason: "error"` for execution failures
- `content` only when there is a final assistant payload

## Tool Payloads

Tool updates may include:

- `tool_call_id`
- `title`
- `kind`
- `status`
- `content`
- `locations`
