# GhostGraph Prototype v3.1

Minimal neon-black prototype demonstrating the GhostGraph thesis with a decluttered multi-workspace UI:

- User-held keys (local identity vault)
- Encrypted client-side messaging
- Relay only sees ciphertext shards
- Blockchain-style anchoring of encrypted chat hashes
- Portable encrypted vault export

## What changed in v3

- **Focused workspace navigation**: GhostDM / Identity / QR Exchange / GhostChain / Vault-Sync are separate screens
- **Less crowded flow**: only one feature screen is visible at a time
- **Keyboard shortcuts**: press `1-5` to jump between workspaces

## v2 foundations retained

- **Multi-contact list**: Alice, Bob, and Charlie key ring
- **GhostChain Explorer**: each message is anchored in a mined block (toy PoW)
- **QR key exchange flow**: generate/share payload + import scanned payload
- **Vault-Sync export**: encrypted `.ghostvault` backup with passphrase
- **Clone-Gram overlay mode**: UI toggle simulating social-surface skin

## Run

Open `index.html` in a modern browser.

## Demo flow

1. Open **GhostDM** workspace and send encrypted messages.
2. Send a private message.
3. Switch to **GhostChain** workspace to inspect relay shards + anchored block.
4. Switch to **QR Exchange** workspace to copy/import key payloads.
5. Switch to **Vault-Sync** workspace to export encrypted archive.

## Notes

- This is an educational prototype; not production cryptography.
- QR image rendering uses a public QR image service for speed in prototype mode.
