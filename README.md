# Relay Spine

Relay Spine is an OpenClaw channel bridge for teams that need two ingress modes in one package:

- QR-authenticated long-lived socket sessions for interactive chat delivery
- Encrypted webhook handling for server-driven passive replies

The codebase is organized around runtime services, identity flows, routing, and transport adapters under `src/`, with a thin root entrypoint for plugin loading.

## What It Does

- Acquires and persists channel credentials through a browser QR flow
- Starts and supervises a reconnecting socket client with heartbeat protection
- Converts upstream prompt envelopes into OpenClaw message context
- Streams assistant output and tool activity back to the gateway
- Verifies, decrypts, and responds to encrypted webhook traffic
- Supports account-scoped state files and account-aware session routing

## Install

```bash
openclaw plugins install @henryxiaoyang/wechat-access-unqclawed
openclaw config set channels.wechat-access-unqclawed.enabled true
```

## Login Flow

```bash
openclaw channels login --channel wechat-access-unqclawed
```

The login command prints a QR code and a browser URL. After approval, write the redirected URL or the `code` value into the temporary file shown in the terminal. The plugin exchanges that code for a channel token and stores the result locally.

## Configuration

Example:

```json
{
  "channels": {
    "wechat-access-unqclawed": {
      "enabled": true,
      "environment": "production",
      "token": "",
      "wsUrl": "",
      "authStatePath": "",
      "bypassInvite": false,
      "webhook": {
        "token": "",
        "encodingAESKey": "",
        "receiveId": ""
      },
      "accounts": {
        "default": {
          "token": "",
          "wsUrl": "",
          "authStatePath": ""
        }
      }
    }
  }
}
```

Key fields:

| Field | Purpose |
| --- | --- |
| `token` | Manual channel token override for the socket path |
| `wsUrl` | Socket gateway address override |
| `authStatePath` | Custom path for persisted login state |
| `environment` | Remote profile selection: `production` or `test` |
| `bypassInvite` | Skip invite verification if your backend allows it |
| `webhook.token` | Signature token for webhook validation |
| `webhook.encodingAESKey` | AES key used for encrypted webhook payloads |
| `webhook.receiveId` | Receiver identifier checked during decrypt/encrypt |
| `accounts` | Optional account-scoped overrides and isolated state paths |

## Layout

```text
src/
  bridge/            plugin composition and OpenClaw registration
  identity/          login flow, device identity, remote API, persisted state
  runtime/           runtime binding and agent event subscription
  routing/           inbound context construction and session key strategy
  channels/
    socket/          socket schema, client, prompt orchestration, bridge layer
    webhook/         webhook schema, transport helpers, crypto, reply pipeline
index.ts             root export for the plugin entrypoint
protocol-notes.md    socket envelope protocol reference
```

## Notes

- The repository intentionally keeps the root surface area small. Most behavior lives under `src/`.
- `npm run typecheck` is available, but it still depends on OpenClaw and Node type availability in the local environment.

## Security And Usage Notice

- This project is provided for research, learning, and internal technical evaluation only.
- You are responsible for ensuring that your use complies with local law, platform terms, organizational policy, and any access-control requirements that apply to your environment.
- Do not use this project to obtain unauthorized access, bypass service restrictions, interfere with third-party systems, or process data without permission.
- Protect all tokens, webhook secrets, encryption keys, and persisted session files. Treat them as sensitive credentials.
- Review the code and configuration carefully before running it in any production or externally exposed environment.

## License

MIT
