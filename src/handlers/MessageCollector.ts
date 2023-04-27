import { Client, Message } from "whatsapp-web.js";
import { EventEmitter } from "events";

interface MessageCollectorOptions {
  time?: number;
  filter?: (collectedMessage: Message) => boolean;
}

class MessageCollector extends EventEmitter {
  client: Client;
  filter: (collectedMessage: Message) => boolean;
  time: number;
  timeout: NodeJS.Timeout | null;

  constructor(client: Client, options: MessageCollectorOptions) {
    super();
    this.client = client;
    this.filter = options.filter || (() => true);
    this.time = options.time || 0;
    this.timeout = null;

    this.client.on("message", this.handleMessage.bind(this));

    if (this.time > 0) {
      this.timeout = setTimeout(() => {
        this.stop("time");
      }, this.time);
    }
  }

  handleMessage(message: Message) {
    if (!this.filter(message)) return;
    this.emit("collect", message);
  }

  stop(reason: string) {
    this.client.removeListener("message", this.handleMessage.bind(this));
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
    this.emit("end", reason);
  }
}

export default MessageCollector;
