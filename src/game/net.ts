import type { ClientMessage, ServerMessage } from './protocol'

export interface ConnectionHandlers {
  onOpen(): void
  onMessage(message: ServerMessage): void
  onClose(): void
}

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
    if (this.socket.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message))
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
