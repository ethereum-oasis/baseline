import net, { Socket } from 'net';

export type Records = { [key: string]: any };

export enum ClientState {
    Init,
    Ready,
    Busy,
    Disconnected
}

export class TCPClient {

    private socket: Socket;
    private _PORT: number = 11000;
    private _latest_receivedData: Records;
    private baselineMsgSend: (data:string)=> any;
    get latest_receivedData() {
        return this._latest_receivedData;
    }
    get PORT() {
        return this._PORT;
    }
    private _IP: string = 'localhost'; //'127.0.0.1'; // localhost ip
    get IP() {
        return this._IP;
    }

    constructor(port?: number, ip?: string, baselineMsgSend?: (data:string)=> any )  {
        if (port)
            this._PORT = port;
        if (ip)
            this._IP = ip;
        if(baselineMsgSend){
            this.baselineMsgSend = baselineMsgSend;
        }else{
            this.baselineMsgSend = (data:string) => {console.log('relay to baseline ' + data)};
        }
        this._latest_receivedData = {};
        this.socket = net.connect(this._PORT, this._IP, this.onConnect);
        this.register();
    }

    private connectClient() {
        this.socket = net.connect(this._PORT, this._IP, this.onConnect);
        this.register();
    }

    private register() {
        // register other functions 
        this.socket.on('connect', this.onConnect);
        this.socket.on('data', (data: Buffer) => { this.onReceive(data); });
        this.socket.on('close', (err) => this.onClose(err));
        this.socket.on('error', (e_data: Error) => this.onError(e_data));
        this.socket.on('end', err => this.onEnd(err))
        this.socket.on('timeout', () => { console.log("socket timed out"); });
    }

    private onConnect() {
        //console.log("Excel Server connected!");

    }


    private onReceive(data: Buffer): void {

        //console.log(data.toString());
        this.baselineMsgSend(data.toString());
        this._latest_receivedData = JSON.parse(data.toString());
    }

    private onClose(data: boolean) {
        //console.log("Client disconnected " + data);
    }

    private onError(data: any) {
        //console.log("Client Error " + data)
    }

    private onEnd(end: boolean) {
        //console.log("received end " + end);
    }


    reconnectClient(): boolean {
        this.socket.destroy();
        this.connectClient();
        return true;
    }

    disconnect() {

    }

    async sendRecord(json: Records, reject: any) {
        //console.log('sending ' + JSON.stringify(json));
        this.send(JSON.stringify(json), reject);
    }

    async send(data: string | Uint8Array, reject: any) {
        this.socket.write(data + ';', (err) => this.onSend(reject, err));
        this.socket.setEncoding("utf8")

    }

    private onSend(reject: any, err?: Error) {
        if (err) {
            //console.log("ERROR sending message " + err);
            reject();
            return;
        }
        //console.log("message sent !");
        return;
    }
}
