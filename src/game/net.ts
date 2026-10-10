import type { ClientMessage, ServerMessage } from './protocol'

export interface ConnectionHandlers {
  onOpen(): void
  onMessage(message: ServerMessage): void
  onClose(): void
}

/** Unsent bytes above which position updates are skipped (a few updates' worth). */
const STATE_BACKLOG_BYTES = 1024

/**
 * The game's websocket. One JSON message per frame, both ways. The session
 * cookie travels with the handshake, so a logged-in player is recognised
 * without the page handling any token.
 */
export class Connection {
  private readonly socket: WebSocket
  private closedByUs = false

  constructor(
    url: string,
    private readonly handlers: ConnectionHandlers,
  ) {
    this.socket = new WebSocket(url)
    this.socket.addEventListener('open', () => handlers.onOpen())
    this.socket.addEventListener('message', this.onMessage)
    this.socket.addEventListener('close', () => {
      if (!this.closedByUs) handlers.onClose()
    })
  }

  send(message: ClientMessage): void {
    if (this.socket.readyState !== WebSocket.OPEN) return
    // Position updates are snapshots: each one replaces the last. While the
    // socket is still pushing earlier data out (a mobile connection that has
    // stalled), queueing more of them only builds a burst that arrives all
    // at once later - which the server's flood protection may cut off.
    // Skip them until it drains; the next one carries the newest position.
    // Everything else (shots, hits, respawns) must arrive, so always goes.
    if (message.type === 'state' && this.socket.bufferedAmount > STATE_BACKLOG_BYTES) return
    this.socket.send(JSON.stringify(message))
  }

  close(): void {
    this.closedByUs = true
    this.socket.close()
  }

  private onMessage = (event: MessageEvent): void => {
    let message: ServerMessage
    try {
      message = JSON.parse(String(event.data))
    } catch {
      return
    }
    this.handlers.onMessage(message)
  }
}
