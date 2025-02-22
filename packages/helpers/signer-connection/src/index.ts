import EventEmitter from "eventemitter3";
import { IJsonRpcConnection } from "@json-rpc-tools/types";

import WCRpcConnection from "@walletconnect/rpc-connection";
import { IWCEthRpcConnectionOptions, IWCRpcConnection } from "@walletconnect/types";

export class SignerConnection extends IJsonRpcConnection {
  public events: any = new EventEmitter();

  public accounts: string[] = [];
  public chainId = 1;

  private pending = false;
  private connector: IWCRpcConnection | undefined;
  private opts: IWCEthRpcConnectionOptions | undefined;

  constructor(opts?: IWCEthRpcConnectionOptions) {
    super();
    this.connector = this.register(opts);
  }

  get connected(): boolean {
    return typeof this.connector !== "undefined" && this.connector.connected;
  }

  get connecting(): boolean {
    return this.pending;
  }

  public on(event: string, listener: any) {
    this.events.on(event, listener);
  }

  public once(event: string, listener: any) {
    this.events.once(event, listener);
  }

  public off(event: string, listener: any) {
    this.events.off(event, listener);
  }

  public removeListener(event: string, listener: any) {
    this.events.removeListener(event, listener);
  }

  public async open(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.pending = true;
      if (typeof this.connector === "undefined") {
        this.connector = this.register(this.opts);
      }
      if (this.connector.wc === null) {
        throw new Error("Connector missing or invalid");
      }
      this.connector.wc.on("disconnect", () => {
        this.onClose();
        reject();
      });
      this.connector.wc.on("connect", () => {
        this.onOpen(this.connector);
        resolve();
      });

      this.connector.create();
    });
  }

  public async close() {
    if (typeof this.connector === "undefined") {
      return;
    }
    if (this.connector.wc === null) {
      throw new Error("Connector missing or invalid");
    }
    await this.connector.wc.killSession();
    this.onClose();
  }

  public async send(payload: any) {
    if (typeof this.connector === "undefined") {
      this.connector = this.register(this.opts);
    }
    this.connector.sendPayload(payload).then((res: any) => this.events.emit("payload", res));
  }

  // ---------- Private ----------------------------------------------- //

  private register(opts?: IWCEthRpcConnectionOptions): IWCRpcConnection {
    return new WCRpcConnection(opts);
  }

  private onOpen(connector?: IWCRpcConnection) {
    this.pending = false;
    if (connector) {
      this.connector = connector;
    }
    this.events.emit("open");
    this.registerUpdateEvents();
  }

  private onClose() {
    this.pending = false;
    if (this.connector) {
      this.connector = undefined;
    }
    this.events.emit("close");
  }

  private registerUpdateEvents() {
    if (!this.connector || this.connector.wc === null) return;
    this.connector.wc.on("session_update", (error, payload) => {
      const { accounts, chainId } = payload.params[0];
      if (!this.accounts || (accounts && this.accounts !== accounts)) {
        this.accounts = accounts;
        this.events.emit("accountsChanged", accounts);
      }
      if (!this.chainId || (chainId && this.chainId !== chainId)) {
        this.chainId = chainId;
        this.events.emit("chainChanged", chainId);
      }
    });
  }
}

export default SignerConnection;
